package provider

import (
	"context"
	"time"

	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository interface {
	GetProviders(ctx context.Context, tenantID uuid.UUID) ([]models.ProviderConfig, error)
	CreateProvider(ctx context.Context, tenantID, userID uuid.UUID, req models.ProviderConfig) (*models.ProviderConfig, error)
	UpdateProvider(ctx context.Context, providerID, tenantID, userID uuid.UUID, req models.ProviderConfig) (*models.ProviderConfig, error)
	DeleteProvider(ctx context.Context, providerID, tenantID uuid.UUID) error
}

type repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) Repository {
	return &repository{db: db}
}

func (r *repository) GetProviders(ctx context.Context, tenantID uuid.UUID) ([]models.ProviderConfig, error) {
	var providers []models.ProviderConfig
	err := r.db.SelectContext(ctx, &providers, "SELECT * FROM provider_configs WHERE tenant_id = $1 ORDER BY created_at DESC", tenantID)
	if err != nil {
		return nil, err
	}
	if providers == nil {
		providers = []models.ProviderConfig{}
	}
	return providers, nil
}

func (r *repository) CreateProvider(ctx context.Context, tenantID, userID uuid.UUID, req models.ProviderConfig) (*models.ProviderConfig, error) {
	query := `
		INSERT INTO provider_configs (tenant_id, name, base_url, api_key, custom_headers, created_by, updated_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING *
	`
	var provider models.ProviderConfig
	err := r.db.GetContext(ctx, &provider, query, tenantID, req.Name, req.BaseURL, req.APIKey, req.CustomHeaders, userID, userID)
	if err != nil {
		return nil, err
	}
	return &provider, nil
}

func (r *repository) UpdateProvider(ctx context.Context, providerID, tenantID, userID uuid.UUID, req models.ProviderConfig) (*models.ProviderConfig, error) {
	query := `
		UPDATE provider_configs
		SET name = $1, base_url = $2, api_key = $3, custom_headers = $4, updated_by = $5, updated_at = $6
		WHERE id = $7 AND tenant_id = $8
		RETURNING *
	`
	var provider models.ProviderConfig
	err := r.db.GetContext(ctx, &provider, query, req.Name, req.BaseURL, req.APIKey, req.CustomHeaders, userID, time.Now(), providerID, tenantID)
	if err != nil {
		return nil, err
	}
	return &provider, nil
}

func (r *repository) DeleteProvider(ctx context.Context, providerID, tenantID uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM provider_configs WHERE id = $1 AND tenant_id = $2", providerID, tenantID)
	return err
}
