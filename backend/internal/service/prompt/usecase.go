package prompt

import (
	"context"
	"errors"

	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/models"
	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/pkg/cache"
	"github.com/google/uuid"
)

type Usecase interface {
	GetSystemPrompts(ctx context.Context, projectID uuid.UUID) ([]models.SystemPrompt, error)
	CreateSystemPrompt(ctx context.Context, projectID, userID uuid.UUID, content string) (*models.SystemPrompt, error)
	UpdateSystemPrompt(ctx context.Context, promptID, projectID uuid.UUID, content string) (*models.SystemPrompt, error)
	
	PublishSystemPrompts(ctx context.Context, projectID uuid.UUID, distributions map[uuid.UUID]int) error
	GetActiveSystemPrompt(ctx context.Context, projectID uuid.UUID) (*models.SystemPrompt, error)

	GetEvaluationPrompts(ctx context.Context, projectID uuid.UUID) ([]models.EvaluationPrompt, error)
	CreateEvaluationPrompt(ctx context.Context, projectID, userID uuid.UUID, content string) (*models.EvaluationPrompt, error)
	UpdateEvaluationPrompt(ctx context.Context, promptID, projectID uuid.UUID, content string) (*models.EvaluationPrompt, error)
}

type usecase struct {
	repo  Repository
	cache cache.PromptCache
}

func NewUsecase(repo Repository, c cache.PromptCache) Usecase {
	return &usecase{
		repo:  repo,
		cache: c,
	}
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

func (u *usecase) PublishSystemPrompts(ctx context.Context, projectID uuid.UUID, distributions map[uuid.UUID]int) error {
	totalWeight := 0
	for _, weight := range distributions {
		if weight < 0 || weight > 100 {
			return errors.New("weights must be between 0 and 100")
		}
		totalWeight += weight
	}
	if totalWeight != 100 && totalWeight != 0 {
		return errors.New("total weight must be exactly 100 (or 0 to unpublish all)")
	}

	err := u.repo.UpdateSystemPromptWeights(ctx, projectID, distributions)
	if err != nil {
		return err
	}

	// Fetch active and update cache
	active, err := u.repo.GetActiveSystemPrompts(ctx, projectID)
	if err == nil {
		u.cache.SetActivePrompts(projectID, active)
	}

	return nil
}

func (u *usecase) GetActiveSystemPrompt(ctx context.Context, projectID uuid.UUID) (*models.SystemPrompt, error) {
	prompt, ok := u.cache.PickRandomPrompt(projectID)
	if ok {
		return prompt, nil
	}

	// Cache miss or not available, fetch from DB
	active, err := u.repo.GetActiveSystemPrompts(ctx, projectID)
	if err != nil {
		return nil, err
	}

	u.cache.SetActivePrompts(projectID, active)

	prompt, ok = u.cache.PickRandomPrompt(projectID)
	if !ok {
		return nil, errors.New("no active system prompt found for this project")
	}

	return prompt, nil
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
