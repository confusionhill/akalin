package evaluation

import (
	"context"

	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/models"
	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/worker"
	"github.com/google/uuid"
)

type Usecase interface {
	GetEvaluations(ctx context.Context, projectID uuid.UUID) ([]models.EvaluationRun, error)
	CreateEvaluation(ctx context.Context, projectID, userID uuid.UUID, req models.EvaluationRun) (*models.EvaluationRun, error)
	CancelEvaluation(ctx context.Context, runID, projectID uuid.UUID) (bool, error)
	GetEvaluationDetails(ctx context.Context, runID, projectID uuid.UUID) (*RunDetailsResponse, error)
	DeleteEvaluation(ctx context.Context, runID, projectID uuid.UUID) error
}

type usecase struct {
	repo Repository
}

func NewUsecase(repo Repository) Usecase {
	return &usecase{repo: repo}
}

func (u *usecase) GetEvaluations(ctx context.Context, projectID uuid.UUID) ([]models.EvaluationRun, error) {
	return u.repo.GetEvaluations(ctx, projectID)
}

func (u *usecase) CreateEvaluation(ctx context.Context, projectID, userID uuid.UUID, req models.EvaluationRun) (*models.EvaluationRun, error) {
	return u.repo.CreateEvaluation(ctx, req, projectID, userID)
}

func (u *usecase) CancelEvaluation(ctx context.Context, runID, projectID uuid.UUID) (bool, error) {
	cancelled, err := u.repo.CancelEvaluation(ctx, runID, projectID)
	if err != nil {
		return false, err
	}
	if cancelled {
		worker.CancelRun(runID)
	}
	return cancelled, nil
}

func (u *usecase) GetEvaluationDetails(ctx context.Context, runID, projectID uuid.UUID) (*RunDetailsResponse, error) {
	return u.repo.GetEvaluationDetails(ctx, runID, projectID)
}

func (u *usecase) DeleteEvaluation(ctx context.Context, runID, projectID uuid.UUID) error {
	return u.repo.DeleteEvaluation(ctx, runID, projectID)
}
