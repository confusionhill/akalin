package prompt

import (
	"context"

	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/models"
	"github.com/google/uuid"
)

type Usecase interface {
	GetSystemPrompts(ctx context.Context, projectID uuid.UUID) ([]models.SystemPrompt, error)
	CreateSystemPrompt(ctx context.Context, projectID, userID uuid.UUID, content string) (*models.SystemPrompt, error)
	UpdateSystemPrompt(ctx context.Context, promptID, projectID uuid.UUID, content string) (*models.SystemPrompt, error)

	GetEvaluationPrompts(ctx context.Context, projectID uuid.UUID) ([]models.EvaluationPrompt, error)
	CreateEvaluationPrompt(ctx context.Context, projectID, userID uuid.UUID, content string) (*models.EvaluationPrompt, error)
	UpdateEvaluationPrompt(ctx context.Context, promptID, projectID uuid.UUID, content string) (*models.EvaluationPrompt, error)
}

type usecase struct {
	repo Repository
}

func NewUsecase(repo Repository) Usecase {
	return &usecase{repo: repo}
}

func (u *usecase) GetSystemPrompts(ctx context.Context, projectID uuid.UUID) ([]models.SystemPrompt, error) {
	return u.repo.GetSystemPrompts(ctx, projectID)
}

func (u *usecase) CreateSystemPrompt(ctx context.Context, projectID, userID uuid.UUID, content string) (*models.SystemPrompt, error) {
	return u.repo.CreateSystemPrompt(ctx, projectID, userID, content)
}

func (u *usecase) UpdateSystemPrompt(ctx context.Context, promptID, projectID uuid.UUID, content string) (*models.SystemPrompt, error) {
	return u.repo.UpdateSystemPrompt(ctx, promptID, projectID, content)
}

func (u *usecase) GetEvaluationPrompts(ctx context.Context, projectID uuid.UUID) ([]models.EvaluationPrompt, error) {
	return u.repo.GetEvaluationPrompts(ctx, projectID)
}

func (u *usecase) CreateEvaluationPrompt(ctx context.Context, projectID, userID uuid.UUID, content string) (*models.EvaluationPrompt, error) {
	return u.repo.CreateEvaluationPrompt(ctx, projectID, userID, content)
}

func (u *usecase) UpdateEvaluationPrompt(ctx context.Context, promptID, projectID uuid.UUID, content string) (*models.EvaluationPrompt, error) {
	return u.repo.UpdateEvaluationPrompt(ctx, promptID, projectID, content)
}
