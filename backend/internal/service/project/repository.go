package project

import (
	"context"
	"time"

	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository interface {
	GetProjects(ctx context.Context, tenantID uuid.UUID) ([]models.Project, error)
	CreateProject(ctx context.Context, tenantID, userID uuid.UUID, name, description string) (*models.Project, error)
	GetProjectByID(ctx context.Context, projectID, tenantID uuid.UUID) (*models.Project, error)
	UpdateProject(ctx context.Context, projectID, tenantID, userID uuid.UUID, name, description string) (*models.Project, error)
}

type repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) Repository {
	return &repository{db: db}
}

func (r *repository) GetProjects(ctx context.Context, tenantID uuid.UUID) ([]models.Project, error) {
	var projects []models.Project
	err := r.db.SelectContext(ctx, &projects, "SELECT * FROM projects WHERE tenant_id = $1 ORDER BY created_at DESC", tenantID)
	if err != nil {
		return nil, err
	}
	if projects == nil {
		projects = []models.Project{}
	}
	return projects, nil
}

func (r *repository) CreateProject(ctx context.Context, tenantID, userID uuid.UUID, name, description string) (*models.Project, error) {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	query := `
		INSERT INTO projects (tenant_id, name, description, created_by, updated_by)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING *
	`
	var project models.Project
	err = tx.GetContext(ctx, &project, query, tenantID, name, description, userID, userID)
	if err != nil {
		return nil, err
	}

	// Seed default system prompt
	defaultSysPromptQuery := `
		INSERT INTO system_prompts (project_id, content, version, created_by)
		VALUES ($1, 'You are a helpful assistant.', 1, $2)
	`
	_, _ = tx.ExecContext(ctx, defaultSysPromptQuery, project.ID, userID)

	// Seed default evaluation prompt
	defaultEvalPromptQuery := `
		INSERT INTO evaluation_prompts (project_id, content, version, created_by)
		VALUES ($1, 'Rate the match on a continuous scale from 0.0 to 1.0 in 0.1 increments:
- 0.0: completely wrong or irrelevant
- 0.1: almost entirely wrong with one barely recognizable element
- 0.2: mostly wrong with a few correct fragments
- 0.3: incorrect overall but contains some relevant points
- 0.4: below average; more wrong than right but heading in the right direction
- 0.5: partially correct; hits some key elements but misses others
- 0.6: slightly above average; mostly correct with notable gaps
- 0.7: good; covers most key points with minor inaccuracies
- 0.8: very good; nearly complete with only slight omissions
- 0.9: excellent; almost identical in meaning, facts, and tone
- 1.0: perfect; identical in meaning, facts, and tone

Use the full range.', 1, $2)
	`
	_, _ = tx.ExecContext(ctx, defaultEvalPromptQuery, project.ID, userID)

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &project, nil
}

func (r *repository) GetProjectByID(ctx context.Context, projectID, tenantID uuid.UUID) (*models.Project, error) {
	var project models.Project
	err := r.db.GetContext(ctx, &project, "SELECT * FROM projects WHERE id = $1 AND tenant_id = $2", projectID, tenantID)
	if err != nil {
		return nil, err
	}
	return &project, nil
}

func (r *repository) UpdateProject(ctx context.Context, projectID, tenantID, userID uuid.UUID, name, description string) (*models.Project, error) {
	query := `
		UPDATE projects SET name = $1, description = $2, updated_by = $3, updated_at = $4
		WHERE id = $5 AND tenant_id = $6
		RETURNING *
	`
	var project models.Project
	err := r.db.GetContext(ctx, &project, query, name, description, userID, time.Now(), projectID, tenantID)
	if err != nil {
		return nil, err
	}
	return &project, nil
}
