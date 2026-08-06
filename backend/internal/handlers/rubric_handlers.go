package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/evaluator"
	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/models"
	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/worker"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
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
}

func (h *Handler) RefineEvaluationPrompt(c echo.Context) error {
	_, userID, _, err := h.getAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}
	runID, err := uuid.Parse(c.Param("run_id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid run ID")
	}

	req := new(RefineRubricRequest)
	if err := c.Bind(req); err != nil {
		return err
	}

	// 1. Fetch the run
	var run models.EvaluationRun
	err = h.DB.Get(&run, "SELECT * FROM evaluation_runs WHERE id = $1 AND project_id = $2", runID, projectID)
	if err != nil {
		if err == sql.ErrNoRows {
			return echo.NewHTTPError(http.StatusNotFound, "Run not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if run.Status != "completed" {
		return echo.NewHTTPError(http.StatusBadRequest, "Cannot refine rubric from an incomplete run")
	}

	// 2. Fetch base prompt version info if requested
	var basePromptVersion *int
	var existingRubric string
	actualBasePromptID := run.EvaluationPromptID
	if req.BasePromptID != nil {
		actualBasePromptID = *req.BasePromptID
	}
	
	var basePrompt models.EvaluationPrompt
	err = h.DB.Get(&basePrompt, "SELECT * FROM evaluation_prompts WHERE id = $1 AND project_id = $2", actualBasePromptID, projectID)
	if err == nil {
		basePromptVersion = &basePrompt.Version
		existingRubric = basePrompt.Content
	} else if req.BasePromptID != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid base prompt ID")
	}

	// 3. Fetch detailed results
	var detailedResults []DetailedResult
	resultQuery := `
		SELECT 
			er.id, er.run_id, er.test_case_id, er.generated_output, er.score, 
			er.is_passed, er.evaluator_reasoning, er.tools_called, er.trace, er.created_at,
			tc.input_prompt, tc.expected_output, tc.expected_format
		FROM evaluation_results er 
		JOIN test_cases tc ON er.test_case_id = tc.id 
		WHERE er.run_id = $1 
		ORDER BY er.created_at ASC
	`
	err = h.DB.Select(&detailedResults, resultQuery, runID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	
	var rows []evaluator.RubricTrainingRow
	for _, res := range detailedResults {
		if res.GeneratedOutput == nil || res.Score == nil || res.EvaluatorReason == nil {
			continue
		}
		rows = append(rows, evaluator.RubricTrainingRow{
			Input:          res.InputPrompt,
			ExpectedOutput: res.ExpectedOutput,
			ActualOutput:   *res.GeneratedOutput,
			Score:          fmt.Sprintf("%.2f", *res.Score),
			Reasoning:      *res.EvaluatorReason,
		})
	}
	
	if len(rows) == 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "No valid results found in this run to analyze")
	}

	// 4. Fetch evaluator provider config
	var evaluatorProvider models.ProviderConfig
	err = h.DB.Get(&evaluatorProvider, "SELECT * FROM provider_configs WHERE id = $1", run.EvaluatorProviderID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch evaluator provider config")
	}

	// 5. Create rubric_drafts row
	resultsAnalyzed := len(rows)
	
	payloadBytes, _ := json.Marshal(req)
	
	query := `
		INSERT INTO rubric_drafts (project_id, status, source_run_id, base_prompt_id, base_prompt_version, results_analyzed, payload, created_by)
		VALUES ($1, 'pending', $2, $3, $4, $5, $6, $7)
		RETURNING id
	`
	var draftID uuid.UUID
	var actualBasePromptIDPtr *uuid.UUID
	if actualBasePromptID != uuid.Nil {
		actualBasePromptIDPtr = &actualBasePromptID
	}
	err = h.DB.Get(&draftID, query, projectID, runID, actualBasePromptIDPtr, basePromptVersion, resultsAnalyzed, payloadBytes, userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	// 6. Kick off async goroutine
	ctx, cancel := context.WithCancel(context.Background())
	worker.StoreActiveRubricDraft(draftID, cancel)

	go h.generateRubricDraftAsync(ctx, draftID, evaluatorProvider, run.EvaluatorModel, existingRubric, req.CustomInstructions, rows)

	return c.JSON(http.StatusAccepted, map[string]uuid.UUID{"draft_id": draftID})
}

func (h *Handler) CalibrateEvaluationPrompt(c echo.Context) error {
	_, userID, _, err := h.getAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}

	req := new(CalibrateRubricRequest)
	if err := c.Bind(req); err != nil {
		return err
	}

	if req.ProviderID == uuid.Nil || req.Model == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "provider_id and model are required")
	}

	var basePromptVersion *int
	var existingRubric string
	if req.BasePromptID != nil {
		var basePrompt models.EvaluationPrompt
		err = h.DB.Get(&basePrompt, "SELECT * FROM evaluation_prompts WHERE id = $1 AND project_id = $2", *req.BasePromptID, projectID)
		if err == nil {
			basePromptVersion = &basePrompt.Version
			existingRubric = basePrompt.Content
		} else {
			return echo.NewHTTPError(http.StatusBadRequest, "Invalid base prompt ID")
		}
	}

	if len(req.Rows) == 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "At least one row of training data is required")
	}
	if len(req.Rows) > 100 {
		return echo.NewHTTPError(http.StatusBadRequest, "Maximum 100 rows supported")
	}

	var evaluatorProvider models.ProviderConfig
	err = h.DB.Get(&evaluatorProvider, "SELECT * FROM provider_configs WHERE id = $1", req.ProviderID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch evaluator provider config")
	}

	resultsAnalyzed := len(req.Rows)
	
	payloadBytes, _ := json.Marshal(req)
	
	query := `
		INSERT INTO rubric_drafts (project_id, status, base_prompt_id, base_prompt_version, results_analyzed, payload, created_by)
		VALUES ($1, 'pending', $2, $3, $4, $5, $6)
		RETURNING id
	`
	var draftID uuid.UUID
	err = h.DB.Get(&draftID, query, projectID, req.BasePromptID, basePromptVersion, resultsAnalyzed, payloadBytes, userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	ctx, cancel := context.WithCancel(context.Background())
	worker.StoreActiveRubricDraft(draftID, cancel)

	go h.generateRubricDraftAsync(ctx, draftID, evaluatorProvider, req.Model, existingRubric, req.CustomInstructions, req.Rows)

	return c.JSON(http.StatusAccepted, map[string]uuid.UUID{"draft_id": draftID})
}

func (h *Handler) GetRubricDrafts(c echo.Context) error {
	_, _, _, err := h.getAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}

	var drafts []models.RubricDraft
	query := `
		SELECT * FROM rubric_drafts 
		WHERE project_id = $1 
		ORDER BY created_at DESC
	`
	err = h.DB.Select(&drafts, query, projectID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	
	// Ensure we return an empty array, not null
	if drafts == nil {
		drafts = []models.RubricDraft{}
	}

	return c.JSON(http.StatusOK, drafts)
}

func (h *Handler) DeleteRubricDraft(c echo.Context) error {
	_, _, _, err := h.getAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}
	draftID, err := uuid.Parse(c.Param("draft_id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid draft ID")
	}

	result, err := h.DB.Exec("DELETE FROM rubric_drafts WHERE id = $1 AND project_id = $2", draftID, projectID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "Rubric draft not found")
	}

	return c.NoContent(http.StatusNoContent)
}

func (h *Handler) RetryRubricDraft(c echo.Context) error {
	_, _, _, err := h.getAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}
	draftID, err := uuid.Parse(c.Param("draft_id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid draft ID")
	}

	var draft models.RubricDraft
	err = h.DB.Get(&draft, "SELECT * FROM rubric_drafts WHERE id = $1 AND project_id = $2", draftID, projectID)
	if err != nil {
		if err == sql.ErrNoRows {
			return echo.NewHTTPError(http.StatusNotFound, "Rubric draft not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	if draft.Status != "failed" && draft.Status != "cancelled" {
		return echo.NewHTTPError(http.StatusBadRequest, "Can only retry failed or cancelled drafts")
	}

	if draft.Payload == nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Cannot retry draft because payload is missing")
	}

	var req CalibrateRubricRequest
	if err := json.Unmarshal(*draft.Payload, &req); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to parse stored payload")
	}
	
	var evaluatorProvider models.ProviderConfig
	err = h.DB.Get(&evaluatorProvider, "SELECT * FROM provider_configs WHERE id = $1", req.ProviderID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch evaluator provider config")
	}
	
	var existingRubric string
	if req.BasePromptID != nil {
		var basePrompt models.EvaluationPrompt
		err = h.DB.Get(&basePrompt, "SELECT content FROM evaluation_prompts WHERE id = $1 AND project_id = $2", *req.BasePromptID, projectID)
		if err == nil {
			existingRubric = basePrompt.Content
		}
	}

	// Update status to pending
	_, err = h.DB.Exec("UPDATE rubric_drafts SET status = 'pending', failure_reason = NULL WHERE id = $1", draftID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	ctx, cancel := context.WithCancel(context.Background())
	worker.StoreActiveRubricDraft(draftID, cancel)

	go h.generateRubricDraftAsync(ctx, draftID, evaluatorProvider, req.Model, existingRubric, req.CustomInstructions, req.Rows)

	return c.JSON(http.StatusAccepted, map[string]uuid.UUID{"draft_id": draftID})
}

func (h *Handler) GetRubricDraft(c echo.Context) error {
	_, _, _, err := h.getAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}
	draftID, err := uuid.Parse(c.Param("draft_id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid draft ID")
	}

	var draft models.RubricDraft
	err = h.DB.Get(&draft, "SELECT * FROM rubric_drafts WHERE id = $1 AND project_id = $2", draftID, projectID)
	if err != nil {
		if err == sql.ErrNoRows {
			return echo.NewHTTPError(http.StatusNotFound, "Rubric draft not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, draft)
}

func (h *Handler) CancelRubricDraft(c echo.Context) error {
	_, _, _, err := h.getAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}
	draftID, err := uuid.Parse(c.Param("draft_id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid draft ID")
	}

	res, err := h.DB.Exec(`
		UPDATE rubric_drafts 
		SET status = 'cancelled', failure_reason = 'Cancelled by user', completed_at = NOW() 
		WHERE id = $1 AND project_id = $2 AND status IN ('pending', 'running')
	`, draftID, projectID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	if rowsAffected > 0 {
		worker.CancelRubricGeneration(draftID)
	}

	return c.NoContent(http.StatusOK)
}

func (h *Handler) DownloadCSVTemplate(c echo.Context) error {
	// Serve an empty CSV with correct headers
	template := "input,expected_output,actual_output,score,reasoning\n"
	c.Response().Header().Set("Content-Type", "text/csv")
	c.Response().Header().Set("Content-Disposition", "attachment; filename=\"rubric_training_template.csv\"")
	return c.String(http.StatusOK, template)
}

func (h *Handler) generateRubricDraftAsync(ctx context.Context, draftID uuid.UUID, provider models.ProviderConfig, model, existingRubric, customInstructions string, rows []evaluator.RubricTrainingRow) {
	defer worker.DeleteActiveRubricDraft(draftID)

	_, err := h.DB.Exec("UPDATE rubric_drafts SET status = 'running' WHERE id = $1", draftID)
	if err != nil {
		log.Printf("[rubric %s] failed to update status to running: %v", draftID, err)
		return
	}

	client := evaluator.NewLLMClient(provider.BaseURL, provider.APIKey, provider.CustomHeaders)
	draftContent, err := evaluator.GenerateRefinedRubric(ctx, client, model, existingRubric, customInstructions, rows)

	if err != nil {
		if ctx.Err() != nil {
			// Cancelled by user, handled by CancelRubricDraft handler
			log.Printf("[rubric %s] generation cancelled", draftID)
			return
		}
		log.Printf("[rubric %s] generation failed: %v", draftID, err)
		h.DB.Exec("UPDATE rubric_drafts SET status = 'failed', failure_reason = $1, completed_at = NOW() WHERE id = $2", err.Error(), draftID)
		return
	}

	_, err = h.DB.Exec("UPDATE rubric_drafts SET status = 'completed', draft_content = $1, completed_at = NOW() WHERE id = $2", draftContent, draftID)
	if err != nil {
		log.Printf("[rubric %s] failed to save completed draft: %v", draftID, err)
	}
	log.Printf("[rubric %s] generation completed", draftID)
}
