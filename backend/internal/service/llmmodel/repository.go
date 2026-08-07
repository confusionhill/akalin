package llmmodel

import (
	"context"
	"time"

	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository interface {
	GetLLMModels(ctx context.Context, tenantID uuid.UUID) ([]models.LLMModel, error)
	CreateLLMModel(ctx context.Context, tenantID, userID uuid.UUID, req models.LLMModel) (*models.LLMModel, error)
	UpdateLLMModel(ctx context.Context, modelID, tenantID, userID uuid.UUID, req models.LLMModel) (*models.LLMModel, error)
	DeleteLLMModel(ctx context.Context, modelID, tenantID uuid.UUID) error
	GetProvider(ctx context.Context, providerID, tenantID uuid.UUID) (*models.ProviderConfig, error)
}

type repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) Repository {
	return &repository{db: db}
}

func (r *repository) GetLLMModels(ctx context.Context, tenantID uuid.UUID) ([]models.LLMModel, error) {
	var llmModels []models.LLMModel
	err := r.db.SelectContext(ctx, &llmModels, "SELECT * FROM llm_models WHERE tenant_id = $1 ORDER BY created_at DESC", tenantID)
	if err != nil {
		return nil, err
	}
	if llmModels == nil {
		llmModels = []models.LLMModel{}
	}
	return llmModels, nil
}

func (r *repository) CreateLLMModel(ctx context.Context, tenantID, userID uuid.UUID, req models.LLMModel) (*models.LLMModel, error) {
	query := `
		INSERT INTO llm_models (tenant_id, provider_id, title, model, created_by, updated_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING *
	`
	var llmModel models.LLMModel
	err := r.db.GetContext(ctx, &llmModel, query, tenantID, req.ProviderID, req.Title, req.Model, userID, userID)
	if err != nil {
		return nil, err
	}
	return &llmModel, nil
}

func (r *repository) UpdateLLMModel(ctx context.Context, modelID, tenantID, userID uuid.UUID, req models.LLMModel) (*models.LLMModel, error) {
	query := `
		UPDATE llm_models
		SET provider_id = $1, title = $2, model = $3, updated_by = $4, updated_at = $5
		WHERE id = $6 AND tenant_id = $7
		RETURNING *
	`
	var llmModel models.LLMModel
	err := r.db.GetContext(ctx, &llmModel, query, req.ProviderID, req.Title, req.Model, userID, time.Now(), modelID, tenantID)
	if err != nil {
		return nil, err
	}
	return &llmModel, nil
}

func (r *repository) DeleteLLMModel(ctx context.Context, modelID, tenantID uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM llm_models WHERE id = $1 AND tenant_id = $2", modelID, tenantID)
	return err
}

func (r *repository) GetProvider(ctx context.Context, providerID, tenantID uuid.UUID) (*models.ProviderConfig, error) {
	var provider models.ProviderConfig
	err := r.db.GetContext(ctx, &provider, "SELECT * FROM provider_configs WHERE id = $1 AND tenant_id = $2", providerID, tenantID)
	if err != nil {
		return nil, err
	}
	return &provider, nil
}
