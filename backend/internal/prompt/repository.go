package prompt

import (
	"context"

	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository interface {
	GetSystemPrompts(ctx context.Context, projectID uuid.UUID) ([]models.SystemPrompt, error)
	CreateSystemPrompt(ctx context.Context, projectID, userID uuid.UUID, content string) (*models.SystemPrompt, error)
	UpdateSystemPrompt(ctx context.Context, promptID, projectID uuid.UUID, content string) (*models.SystemPrompt, error)

	GetEvaluationPrompts(ctx context.Context, projectID uuid.UUID) ([]models.EvaluationPrompt, error)
	CreateEvaluationPrompt(ctx context.Context, projectID, userID uuid.UUID, content string) (*models.EvaluationPrompt, error)
	UpdateEvaluationPrompt(ctx context.Context, promptID, projectID uuid.UUID, content string) (*models.EvaluationPrompt, error)
}

type repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) Repository {
	return &repository{db: db}
}

func (r *repository) GetSystemPrompts(ctx context.Context, projectID uuid.UUID) ([]models.SystemPrompt, error) {
	var prompts []models.SystemPrompt
	err := r.db.SelectContext(ctx, &prompts, "SELECT * FROM system_prompts WHERE project_id = $1 ORDER BY version DESC", projectID)
	if err != nil {
		return nil, err
	}
	if prompts == nil {
		prompts = []models.SystemPrompt{}
	}
	return prompts, nil
}

func (r *repository) CreateSystemPrompt(ctx context.Context, projectID, userID uuid.UUID, content string) (*models.SystemPrompt, error) {
	var maxVersion int
	err := r.db.GetContext(ctx, &maxVersion, "SELECT COALESCE(MAX(version), 0) FROM system_prompts WHERE project_id = $1", projectID)
	if err != nil {
		return nil, err
	}

	query := `
		INSERT INTO system_prompts (project_id, content, version, created_by)
		VALUES ($1, $2, $3, $4)
		RETURNING *
	`
	var prompt models.SystemPrompt
	err = r.db.GetContext(ctx, &prompt, query, projectID, content, maxVersion+1, userID)
	if err != nil {
		return nil, err
	}
	return &prompt, nil
}

func (r *repository) UpdateSystemPrompt(ctx context.Context, promptID, projectID uuid.UUID, content string) (*models.SystemPrompt, error) {
	query := `
		UPDATE system_prompts SET content = $1
		WHERE id = $2 AND project_id = $3
		RETURNING *
	`
	var prompt models.SystemPrompt
	err := r.db.GetContext(ctx, &prompt, query, content, promptID, projectID)
	if err != nil {
		return nil, err
	}
	return &prompt, nil
}

func (r *repository) GetEvaluationPrompts(ctx context.Context, projectID uuid.UUID) ([]models.EvaluationPrompt, error) {
	var prompts []models.EvaluationPrompt
	err := r.db.SelectContext(ctx, &prompts, "SELECT * FROM evaluation_prompts WHERE project_id = $1 ORDER BY version DESC", projectID)
	if err != nil {
		return nil, err
	}
	if prompts == nil {
		prompts = []models.EvaluationPrompt{}
	}
	return prompts, nil
}

func (r *repository) CreateEvaluationPrompt(ctx context.Context, projectID, userID uuid.UUID, content string) (*models.EvaluationPrompt, error) {
	var maxVersion int
	err := r.db.GetContext(ctx, &maxVersion, "SELECT COALESCE(MAX(version), 0) FROM evaluation_prompts WHERE project_id = $1", projectID)
	if err != nil {
		return nil, err
	}

	query := `
		INSERT INTO evaluation_prompts (project_id, content, version, created_by)
		VALUES ($1, $2, $3, $4)
		RETURNING *
	`
	var prompt models.EvaluationPrompt
	err = r.db.GetContext(ctx, &prompt, query, projectID, content, maxVersion+1, userID)
	if err != nil {
		return nil, err
	}
	return &prompt, nil
}

func (r *repository) UpdateEvaluationPrompt(ctx context.Context, promptID, projectID uuid.UUID, content string) (*models.EvaluationPrompt, error) {
	query := `
		UPDATE evaluation_prompts SET content = $1
		WHERE id = $2 AND project_id = $3
		RETURNING *
	`
	var prompt models.EvaluationPrompt
	err := r.db.GetContext(ctx, &prompt, query, content, promptID, projectID)
	if err != nil {
		return nil, err
	}
	return &prompt, nil
}
