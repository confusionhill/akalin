package tool

import (
	"context"

	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/models"
	"github.com/google/uuid"
)

type Usecase interface {
	GetTools(ctx context.Context, tenantID uuid.UUID) ([]models.Tool, error)
	CreateTool(ctx context.Context, tenantID, userID uuid.UUID, req models.Tool) (*models.Tool, error)
	UpdateTool(ctx context.Context, toolID, tenantID, userID uuid.UUID, req models.Tool) (*models.Tool, error)
	DeleteTool(ctx context.Context, toolID, tenantID uuid.UUID) error
	GetProjectTools(ctx context.Context, projectID uuid.UUID) ([]models.Tool, error)
	UpdateProjectTools(ctx context.Context, projectID uuid.UUID, toolIDs []uuid.UUID) ([]models.Tool, error)
}

type usecase struct {
	repo Repository
}

func NewUsecase(repo Repository) Usecase {
	return &usecase{repo: repo}
}

func (u *usecase) GetTools(ctx context.Context, tenantID uuid.UUID) ([]models.Tool, error) {
	return u.repo.GetTools(ctx, tenantID)
}

func (u *usecase) CreateTool(ctx context.Context, tenantID, userID uuid.UUID, req models.Tool) (*models.Tool, error) {
	return u.repo.CreateTool(ctx, tenantID, userID, req)
}

func (u *usecase) UpdateTool(ctx context.Context, toolID, tenantID, userID uuid.UUID, req models.Tool) (*models.Tool, error) {
	return u.repo.UpdateTool(ctx, toolID, tenantID, userID, req)
}

func (u *usecase) DeleteTool(ctx context.Context, toolID, tenantID uuid.UUID) error {
	return u.repo.DeleteTool(ctx, toolID, tenantID)
}

func (u *usecase) GetProjectTools(ctx context.Context, projectID uuid.UUID) ([]models.Tool, error) {
	return u.repo.GetProjectTools(ctx, projectID)
}

func (u *usecase) UpdateProjectTools(ctx context.Context, projectID uuid.UUID, toolIDs []uuid.UUID) ([]models.Tool, error) {
	return u.repo.UpdateProjectTools(ctx, projectID, toolIDs)
}
