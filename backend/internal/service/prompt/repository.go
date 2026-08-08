package prompt

import (
	"context"

	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository interface {
	GetSystemPrompts(ctx context.Context, projectID uuid.UUID) ([]models.SystemPrompt, error)
	GetActiveSystemPrompts(ctx context.Context, projectID uuid.UUID) ([]models.SystemPrompt, error)
	CreateSystemPrompt(ctx context.Context, projectID, userID uuid.UUID, content string) (*models.SystemPrompt, error)
	UpdateSystemPrompt(ctx context.Context, promptID, projectID uuid.UUID, content string) (*models.SystemPrompt, error)
	UpdateSystemPromptWeights(ctx context.Context, projectID uuid.UUID, weights map[uuid.UUID]int) error

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
	query := `
		SELECT sp.*, COALESCE(pp.traffic_weight, 0) AS traffic_weight 
		FROM system_prompts sp 
		LEFT JOIN project_publications pp ON sp.id = pp.prompt_id 
		WHERE sp.project_id = $1 
		ORDER BY sp.version DESC
	`
	err := r.db.SelectContext(ctx, &prompts, query, projectID)
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

func (r *repository) GetActiveSystemPrompts(ctx context.Context, projectID uuid.UUID) ([]models.SystemPrompt, error) {
	var prompts []models.SystemPrompt
	query := `
		SELECT sp.*, pp.traffic_weight 
		FROM system_prompts sp 
		INNER JOIN project_publications pp ON sp.id = pp.prompt_id 
		WHERE sp.project_id = $1 AND pp.traffic_weight > 0 
		ORDER BY sp.version DESC
	`
	err := r.db.SelectContext(ctx, &prompts, query, projectID)
	if err != nil {
		return nil, err
	}
	if prompts == nil {
		prompts = []models.SystemPrompt{}
	}
	return prompts, nil
}

func (r *repository) UpdateSystemPromptWeights(ctx context.Context, projectID uuid.UUID, weights map[uuid.UUID]int) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// First, remove all existing weights for the project
	_, err = tx.ExecContext(ctx, "DELETE FROM project_publications WHERE project_id = $1", projectID)
	if err != nil {
		return err
	}

	// Then insert the new active weights
	for promptID, weight := range weights {
		if weight > 0 {
			_, err = tx.ExecContext(ctx, "INSERT INTO project_publications (project_id, prompt_id, traffic_weight) VALUES ($1, $2, $3)", projectID, promptID, weight)
			if err != nil {
				return err
			}
		}
	}

	return tx.Commit()
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
