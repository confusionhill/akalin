package provider

import (
	"context"

	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/models"
	"github.com/google/uuid"
)

type Usecase interface {
	GetProviders(ctx context.Context, tenantID uuid.UUID) ([]models.ProviderConfig, error)
	CreateProvider(ctx context.Context, tenantID, userID uuid.UUID, req models.ProviderConfig) (*models.ProviderConfig, error)
	UpdateProvider(ctx context.Context, providerID, tenantID, userID uuid.UUID, req models.ProviderConfig) (*models.ProviderConfig, error)
	DeleteProvider(ctx context.Context, providerID, tenantID uuid.UUID) error
}

type usecase struct {
	repo Repository
}

func NewUsecase(repo Repository) Usecase {
	return &usecase{repo: repo}
}

func (u *usecase) GetProviders(ctx context.Context, tenantID uuid.UUID) ([]models.ProviderConfig, error) {
	return u.repo.GetProviders(ctx, tenantID)
}

func (u *usecase) CreateProvider(ctx context.Context, tenantID, userID uuid.UUID, req models.ProviderConfig) (*models.ProviderConfig, error) {
	return u.repo.CreateProvider(ctx, tenantID, userID, req)
}

func (u *usecase) UpdateProvider(ctx context.Context, providerID, tenantID, userID uuid.UUID, req models.ProviderConfig) (*models.ProviderConfig, error) {
	return u.repo.UpdateProvider(ctx, providerID, tenantID, userID, req)
}

func (u *usecase) DeleteProvider(ctx context.Context, providerID, tenantID uuid.UUID) error {
	return u.repo.DeleteProvider(ctx, providerID, tenantID)
}
