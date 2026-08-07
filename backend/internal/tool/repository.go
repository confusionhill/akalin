package tool

import (
	"context"
	"time"

	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository interface {
	GetTools(ctx context.Context, tenantID uuid.UUID) ([]models.Tool, error)
	CreateTool(ctx context.Context, tenantID, userID uuid.UUID, req models.Tool) (*models.Tool, error)
	UpdateTool(ctx context.Context, toolID, tenantID, userID uuid.UUID, req models.Tool) (*models.Tool, error)
	DeleteTool(ctx context.Context, toolID, tenantID uuid.UUID) error
	GetProjectTools(ctx context.Context, projectID uuid.UUID) ([]models.Tool, error)
	UpdateProjectTools(ctx context.Context, projectID uuid.UUID, toolIDs []uuid.UUID) ([]models.Tool, error)
}

type repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) Repository {
	return &repository{db: db}
}

func (r *repository) GetTools(ctx context.Context, tenantID uuid.UUID) ([]models.Tool, error) {
	var tools []models.Tool
	err := r.db.SelectContext(ctx, &tools, "SELECT * FROM tools WHERE tenant_id = $1 ORDER BY name ASC", tenantID)
	if err != nil {
		return nil, err
	}
	if tools == nil {
		tools = []models.Tool{}
	}
	return tools, nil
}

func (r *repository) CreateTool(ctx context.Context, tenantID, userID uuid.UUID, req models.Tool) (*models.Tool, error) {
	query := `
		INSERT INTO tools (tenant_id, name, description, result, created_by, updated_by)
		VALUES ($1, $2, $3, $4, $5, $5)
		RETURNING *
	`
	var tool models.Tool
	err := r.db.GetContext(ctx, &tool, query, tenantID, req.Name, req.Description, req.Result, userID)
	if err != nil {
		return nil, err
	}
	return &tool, nil
}

func (r *repository) UpdateTool(ctx context.Context, toolID, tenantID, userID uuid.UUID, req models.Tool) (*models.Tool, error) {
	query := `
		UPDATE tools
		SET name = $1, description = $2, result = $3, updated_by = $4, updated_at = $5
		WHERE id = $6 AND tenant_id = $7
		RETURNING *
	`
	var tool models.Tool
	err := r.db.GetContext(ctx, &tool, query, req.Name, req.Description, req.Result, userID, time.Now(), toolID, tenantID)
	if err != nil {
		return nil, err
	}
	return &tool, nil
}

func (r *repository) DeleteTool(ctx context.Context, toolID, tenantID uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM tools WHERE id = $1 AND tenant_id = $2", toolID, tenantID)
	return err
}

func (r *repository) GetProjectTools(ctx context.Context, projectID uuid.UUID) ([]models.Tool, error) {
	var tools []models.Tool
	query := `
		SELECT t.* FROM tools t
		JOIN project_tools pt ON t.id = pt.tool_id
		WHERE pt.project_id = $1
		ORDER BY t.name ASC
	`
	err := r.db.SelectContext(ctx, &tools, query, projectID)
	if err != nil {
		return nil, err
	}
	if tools == nil {
		tools = []models.Tool{}
	}
	return tools, nil
}

func (r *repository) UpdateProjectTools(ctx context.Context, projectID uuid.UUID, toolIDs []uuid.UUID) ([]models.Tool, error) {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(ctx, "DELETE FROM project_tools WHERE project_id = $1", projectID)
	if err != nil {
		return nil, err
	}

	for _, toolID := range toolIDs {
		_, err = tx.ExecContext(ctx, "INSERT INTO project_tools (project_id, tool_id) VALUES ($1, $2)", projectID, toolID)
		if err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return r.GetProjectTools(ctx, projectID)
}
