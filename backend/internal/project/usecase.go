package project

import (
	"context"

	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/models"
	"github.com/google/uuid"
)

type Usecase interface {
	GetProjects(ctx context.Context, tenantID uuid.UUID) ([]models.Project, error)
	CreateProject(ctx context.Context, tenantID, userID uuid.UUID, req models.Project) (*models.Project, error)
	GetProject(ctx context.Context, projectID, tenantID uuid.UUID) (*models.Project, error)
	UpdateProject(ctx context.Context, projectID, tenantID, userID uuid.UUID, req models.Project) (*models.Project, error)
}

type usecase struct {
	repo Repository
}

func NewUsecase(repo Repository) Usecase {
	return &usecase{repo: repo}
}

func (u *usecase) GetProjects(ctx context.Context, tenantID uuid.UUID) ([]models.Project, error) {
	return u.repo.GetProjects(ctx, tenantID)
}

func (u *usecase) CreateProject(ctx context.Context, tenantID, userID uuid.UUID, req models.Project) (*models.Project, error) {
	return u.repo.CreateProject(ctx, tenantID, userID, req.Name, req.Description)
}

func (u *usecase) GetProject(ctx context.Context, projectID, tenantID uuid.UUID) (*models.Project, error) {
	return u.repo.GetProjectByID(ctx, projectID, tenantID)
}

func (u *usecase) UpdateProject(ctx context.Context, projectID, tenantID, userID uuid.UUID, req models.Project) (*models.Project, error) {
	return u.repo.UpdateProject(ctx, projectID, tenantID, userID, req.Name, req.Description)
}
