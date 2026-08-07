package rubric

import (
	"context"

	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/service/evaluation"
	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository interface {
	GetRun(ctx context.Context, runID, projectID uuid.UUID) (*models.EvaluationRun, error)
	GetBasePrompt(ctx context.Context, promptID, projectID uuid.UUID) (*models.EvaluationPrompt, error)
	GetDetailedResults(ctx context.Context, runID uuid.UUID) ([]evaluation.DetailedResult, error)
	GetProviderConfig(ctx context.Context, providerID uuid.UUID) (*models.ProviderConfig, error)
	CreateDraft(ctx context.Context, projectID uuid.UUID, sourceRunID *uuid.UUID, basePromptID *uuid.UUID, basePromptVersion *int, resultsAnalyzed int, payload []byte, userID uuid.UUID) (uuid.UUID, error)
	GetDrafts(ctx context.Context, projectID uuid.UUID) ([]models.RubricDraft, error)
	GetDraft(ctx context.Context, draftID, projectID uuid.UUID) (*models.RubricDraft, error)
	DeleteDraft(ctx context.Context, draftID, projectID uuid.UUID) (bool, error)
	CancelDraft(ctx context.Context, draftID, projectID uuid.UUID) (bool, error)
	UpdateDraftStatus(ctx context.Context, draftID uuid.UUID, status string, failureReason *string) error
	SaveCompletedDraft(ctx context.Context, draftID uuid.UUID, content string) error
}

type repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) Repository {
	return &repository{db: db}
}

func (r *repository) GetRun(ctx context.Context, runID, projectID uuid.UUID) (*models.EvaluationRun, error) {
	var run models.EvaluationRun
	err := r.db.GetContext(ctx, &run, "SELECT * FROM evaluation_runs WHERE id = $1 AND project_id = $2", runID, projectID)
	if err != nil {
		return nil, err
	}
	return &run, nil
}

func (r *repository) GetBasePrompt(ctx context.Context, promptID, projectID uuid.UUID) (*models.EvaluationPrompt, error) {
	var basePrompt models.EvaluationPrompt
	err := r.db.GetContext(ctx, &basePrompt, "SELECT * FROM evaluation_prompts WHERE id = $1 AND project_id = $2", promptID, projectID)
	if err != nil {
		return nil, err
	}
	return &basePrompt, nil
}

func (r *repository) GetDetailedResults(ctx context.Context, runID uuid.UUID) ([]evaluation.DetailedResult, error) {
	var results []evaluation.DetailedResult
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
	err := r.db.SelectContext(ctx, &results, resultQuery, runID)
	if err != nil {
		return nil, err
	}
	return results, nil
}

func (r *repository) GetProviderConfig(ctx context.Context, providerID uuid.UUID) (*models.ProviderConfig, error) {
	var provider models.ProviderConfig
	err := r.db.GetContext(ctx, &provider, "SELECT * FROM provider_configs WHERE id = $1", providerID)
	if err != nil {
		return nil, err
	}
	return &provider, nil
}

func (r *repository) CreateDraft(ctx context.Context, projectID uuid.UUID, sourceRunID *uuid.UUID, basePromptID *uuid.UUID, basePromptVersion *int, resultsAnalyzed int, payload []byte, userID uuid.UUID) (uuid.UUID, error) {
	query := `
		INSERT INTO rubric_drafts (project_id, status, source_run_id, base_prompt_id, base_prompt_version, results_analyzed, payload, created_by)
		VALUES ($1, 'pending', $2, $3, $4, $5, $6, $7)
		RETURNING id
	`
	var draftID uuid.UUID
	err := r.db.GetContext(ctx, &draftID, query, projectID, sourceRunID, basePromptID, basePromptVersion, resultsAnalyzed, payload, userID)
	if err != nil {
		return uuid.Nil, err
	}
	return draftID, nil
}

func (r *repository) GetDrafts(ctx context.Context, projectID uuid.UUID) ([]models.RubricDraft, error) {
	var drafts []models.RubricDraft
	query := `
		SELECT * FROM rubric_drafts 
		WHERE project_id = $1 
		ORDER BY created_at DESC
	`
	err := r.db.SelectContext(ctx, &drafts, query, projectID)
	if err != nil {
		return nil, err
	}
	if drafts == nil {
		drafts = []models.RubricDraft{}
	}
	return drafts, nil
}

func (r *repository) GetDraft(ctx context.Context, draftID, projectID uuid.UUID) (*models.RubricDraft, error) {
	var draft models.RubricDraft
	err := r.db.GetContext(ctx, &draft, "SELECT * FROM rubric_drafts WHERE id = $1 AND project_id = $2", draftID, projectID)
	if err != nil {
		return nil, err
	}
	return &draft, nil
}

func (r *repository) DeleteDraft(ctx context.Context, draftID, projectID uuid.UUID) (bool, error) {
	res, err := r.db.ExecContext(ctx, "DELETE FROM rubric_drafts WHERE id = $1 AND project_id = $2", draftID, projectID)
	if err != nil {
		return false, err
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return false, err
	}
	return rowsAffected > 0, nil
}

func (r *repository) CancelDraft(ctx context.Context, draftID, projectID uuid.UUID) (bool, error) {
	res, err := r.db.ExecContext(ctx, `
		UPDATE rubric_drafts 
		SET status = 'cancelled', failure_reason = 'Cancelled by user', completed_at = NOW() 
		WHERE id = $1 AND project_id = $2 AND status IN ('pending', 'running')
	`, draftID, projectID)
	if err != nil {
		return false, err
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return false, err
	}
	return rowsAffected > 0, nil
}

func (r *repository) UpdateDraftStatus(ctx context.Context, draftID uuid.UUID, status string, failureReason *string) error {
	if failureReason != nil {
		_, err := r.db.ExecContext(ctx, "UPDATE rubric_drafts SET status = $1, failure_reason = $2, completed_at = NOW() WHERE id = $3", status, *failureReason, draftID)
		return err
	}
	_, err := r.db.ExecContext(ctx, "UPDATE rubric_drafts SET status = $1 WHERE id = $2", status, draftID)
	return err
}

func (r *repository) SaveCompletedDraft(ctx context.Context, draftID uuid.UUID, content string) error {
	_, err := r.db.ExecContext(ctx, "UPDATE rubric_drafts SET status = 'completed', draft_content = $1, completed_at = NOW() WHERE id = $2", content, draftID)
	return err
}
