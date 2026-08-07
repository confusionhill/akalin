package testcase

import (
	"context"

	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/models"
	"github.com/google/uuid"
)

type Usecase interface {
	GetTestCases(ctx context.Context, projectID uuid.UUID) ([]models.TestCase, error)
	CreateTestCase(ctx context.Context, projectID, userID uuid.UUID, req models.TestCase) (*models.TestCase, error)
	UpdateTestCase(ctx context.Context, tcID, projectID, userID uuid.UUID, req models.TestCase) (*models.TestCase, error)
	DeleteTestCase(ctx context.Context, tcID, projectID uuid.UUID) error
}

type usecase struct {
	repo Repository
}

func NewUsecase(repo Repository) Usecase {
	return &usecase{repo: repo}
}

func (u *usecase) GetTestCases(ctx context.Context, projectID uuid.UUID) ([]models.TestCase, error) {
	return u.repo.GetTestCases(ctx, projectID)
}

func (u *usecase) CreateTestCase(ctx context.Context, projectID, userID uuid.UUID, req models.TestCase) (*models.TestCase, error) {
	return u.repo.CreateTestCase(ctx, projectID, userID, req.InputPrompt, req.ExpectedOutput, req.ExpectedFormat)
}

func (u *usecase) UpdateTestCase(ctx context.Context, tcID, projectID, userID uuid.UUID, req models.TestCase) (*models.TestCase, error) {
	return u.repo.UpdateTestCase(ctx, tcID, projectID, userID, req.InputPrompt, req.ExpectedOutput, req.ExpectedFormat)
}

func (u *usecase) DeleteTestCase(ctx context.Context, tcID, projectID uuid.UUID) error {
	return u.repo.DeleteTestCase(ctx, tcID, projectID)
}
