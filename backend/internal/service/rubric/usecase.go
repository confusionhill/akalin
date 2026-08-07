package rubric

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"

	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/service/evaluator"
	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/models"
	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/service/worker"
	"github.com/google/uuid"
)

var (
	ErrRunIncomplete     = errors.New("cannot refine rubric from an incomplete run")
	ErrNoResultsToAnalyze = errors.New("no valid results found in this run to analyze")
	ErrInvalidBasePrompt = errors.New("invalid base prompt ID")
	ErrDraftNotRetriable = errors.New("can only retry failed or cancelled drafts")
	ErrMissingPayload    = errors.New("cannot retry draft because payload is missing")
)

type RefineRubricRequest struct {
	BasePromptID       *uuid.UUID `json:"base_prompt_id"`
	CustomInstructions string     `json:"custom_instructions"`
}

type CalibrateRubricRequest struct {
	ProviderID         uuid.UUID                     `json:"provider_id"`
	Model              string                        `json:"model"`
	BasePromptID       *uuid.UUID                    `json:"base_prompt_id"`
	CustomInstructions string                        `json:"custom_instructions"`
	Rows               []evaluator.RubricTrainingRow `json:"rows"`
	AdvancedSettings   *models.AdvancedSettings      `json:"advanced_settings"`
}

type Usecase interface {
	RefineEvaluationPrompt(ctx context.Context, projectID, runID, userID uuid.UUID, req RefineRubricRequest) (uuid.UUID, error)
	CalibrateEvaluationPrompt(ctx context.Context, projectID, userID uuid.UUID, req CalibrateRubricRequest) (uuid.UUID, error)
	GetRubricDrafts(ctx context.Context, projectID uuid.UUID) ([]models.RubricDraft, error)
	GetRubricDraft(ctx context.Context, draftID, projectID uuid.UUID) (*models.RubricDraft, error)
	DeleteRubricDraft(ctx context.Context, draftID, projectID uuid.UUID) (bool, error)
	RetryRubricDraft(ctx context.Context, draftID, projectID uuid.UUID) (uuid.UUID, error)
	CancelRubricDraft(ctx context.Context, draftID, projectID uuid.UUID) (bool, error)
}

type usecase struct {
	repo Repository
}

func NewUsecase(repo Repository) Usecase {
	return &usecase{repo: repo}
}

func (u *usecase) RefineEvaluationPrompt(ctx context.Context, projectID, runID, userID uuid.UUID, req RefineRubricRequest) (uuid.UUID, error) {
	run, err := u.repo.GetRun(ctx, runID, projectID)
	if err != nil {
		return uuid.Nil, err
	}
	if run.Status != "completed" {
		return uuid.Nil, ErrRunIncomplete
	}

	var basePromptVersion *int
	var existingRubric string
	actualBasePromptID := run.EvaluationPromptID
	if req.BasePromptID != nil {
		actualBasePromptID = *req.BasePromptID
	}

	basePrompt, err := u.repo.GetBasePrompt(ctx, actualBasePromptID, projectID)
	if err == nil {
		basePromptVersion = &basePrompt.Version
		existingRubric = basePrompt.Content
	} else if req.BasePromptID != nil {
		return uuid.Nil, ErrInvalidBasePrompt
	}

	detailedResults, err := u.repo.GetDetailedResults(ctx, runID)
	if err != nil {
		return uuid.Nil, err
	}

	var rows []evaluator.RubricTrainingRow
	for _, res := range detailedResults {
		if res.GeneratedOutput == nil || res.Score == nil || res.EvaluatorReasoning == nil {
			continue
		}
		rows = append(rows, evaluator.RubricTrainingRow{
			Input:          res.InputPrompt,
			ExpectedOutput: res.ExpectedOutput,
			ActualOutput:   *res.GeneratedOutput,
			Score:          fmt.Sprintf("%.2f", *res.Score),
			Reasoning:      *res.EvaluatorReasoning,
		})
	}

	if len(rows) == 0 {
		return uuid.Nil, ErrNoResultsToAnalyze
	}

	evaluatorProvider, err := u.repo.GetProviderConfig(ctx, run.EvaluatorProviderID)
	if err != nil {
		return uuid.Nil, err
	}

	resultsAnalyzed := len(rows)
	payloadBytes, _ := json.Marshal(req)

	var actualBasePromptIDPtr *uuid.UUID
	if actualBasePromptID != uuid.Nil {
		actualBasePromptIDPtr = &actualBasePromptID
	}

	draftID, err := u.repo.CreateDraft(ctx, projectID, &runID, actualBasePromptIDPtr, basePromptVersion, resultsAnalyzed, payloadBytes, userID)
	if err != nil {
		return uuid.Nil, err
	}

	asyncCtx, cancel := context.WithCancel(context.Background())
	worker.StoreActiveRubricDraft(draftID, cancel)

	go u.generateRubricDraftAsync(asyncCtx, draftID, *evaluatorProvider, run.EvaluatorModel, existingRubric, req.CustomInstructions, rows, nil)

	return draftID, nil
}

func (u *usecase) CalibrateEvaluationPrompt(ctx context.Context, projectID, userID uuid.UUID, req CalibrateRubricRequest) (uuid.UUID, error) {
	var basePromptVersion *int
	var existingRubric string
	if req.BasePromptID != nil {
		basePrompt, err := u.repo.GetBasePrompt(ctx, *req.BasePromptID, projectID)
		if err == nil {
			basePromptVersion = &basePrompt.Version
			existingRubric = basePrompt.Content
		} else {
			return uuid.Nil, ErrInvalidBasePrompt
		}
	}

	evaluatorProvider, err := u.repo.GetProviderConfig(ctx, req.ProviderID)
	if err != nil {
		return uuid.Nil, err
	}

	resultsAnalyzed := len(req.Rows)
	payloadBytes, _ := json.Marshal(req)

	draftID, err := u.repo.CreateDraft(ctx, projectID, nil, req.BasePromptID, basePromptVersion, resultsAnalyzed, payloadBytes, userID)
	if err != nil {
		return uuid.Nil, err
	}

	asyncCtx, cancel := context.WithCancel(context.Background())
	worker.StoreActiveRubricDraft(draftID, cancel)

	go u.generateRubricDraftAsync(asyncCtx, draftID, *evaluatorProvider, req.Model, existingRubric, req.CustomInstructions, req.Rows, req.AdvancedSettings)

	return draftID, nil
}

func (u *usecase) GetRubricDrafts(ctx context.Context, projectID uuid.UUID) ([]models.RubricDraft, error) {
	return u.repo.GetDrafts(ctx, projectID)
}

func (u *usecase) GetRubricDraft(ctx context.Context, draftID, projectID uuid.UUID) (*models.RubricDraft, error) {
	return u.repo.GetDraft(ctx, draftID, projectID)
}

func (u *usecase) DeleteRubricDraft(ctx context.Context, draftID, projectID uuid.UUID) (bool, error) {
	return u.repo.DeleteDraft(ctx, draftID, projectID)
}

func (u *usecase) RetryRubricDraft(ctx context.Context, draftID, projectID uuid.UUID) (uuid.UUID, error) {
	draft, err := u.repo.GetDraft(ctx, draftID, projectID)
	if err != nil {
		return uuid.Nil, err
	}

	if draft.Status != "failed" && draft.Status != "cancelled" {
		return uuid.Nil, ErrDraftNotRetriable
	}

	if draft.Payload == nil {
		return uuid.Nil, ErrMissingPayload
	}

	var req CalibrateRubricRequest
	if err := json.Unmarshal(*draft.Payload, &req); err != nil {
		return uuid.Nil, fmt.Errorf("failed to unmarshal draft payload: %w", err)
	}

	return u.CalibrateEvaluationPrompt(ctx, projectID, *draft.CreatedBy, req)
}

func (u *usecase) CancelRubricDraft(ctx context.Context, draftID, projectID uuid.UUID) (bool, error) {
	cancelled, err := u.repo.CancelDraft(ctx, draftID, projectID)
	if err != nil {
		return false, err
	}
	if cancelled {
		worker.CancelRubricGeneration(draftID)
	}
	return cancelled, nil
}

func (u *usecase) generateRubricDraftAsync(ctx context.Context, draftID uuid.UUID, provider models.ProviderConfig, model, existingRubric, customInstructions string, rows []evaluator.RubricTrainingRow, adv *models.AdvancedSettings) {
	defer worker.DeleteActiveRubricDraft(draftID)

	err := u.repo.UpdateDraftStatus(ctx, draftID, "running", nil)
	if err != nil {
		log.Printf("[rubric %s] failed to update status to running: %v", draftID, err)
		return
	}

	client := evaluator.NewLLMClient(provider.BaseURL, provider.APIKey, provider.CustomHeaders)
	draftContent, err := evaluator.GenerateRefinedRubric(ctx, client, model, existingRubric, customInstructions, rows, adv)

	if err != nil {
		if ctx.Err() != nil {
			log.Printf("[rubric %s] generation cancelled", draftID)
			return
		}
		log.Printf("[rubric %s] generation failed: %v", draftID, err)
		errMsg := err.Error()
		u.repo.UpdateDraftStatus(ctx, draftID, "failed", &errMsg)
		return
	}

	err = u.repo.SaveCompletedDraft(ctx, draftID, draftContent)
	if err != nil {
		log.Printf("[rubric %s] failed to save completed draft: %v", draftID, err)
	}
	log.Printf("[rubric %s] generation completed", draftID)
}
