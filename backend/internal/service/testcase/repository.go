package testcase

import (
	"context"
	"time"

	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository interface {
	GetTestCases(ctx context.Context, projectID uuid.UUID) ([]models.TestCase, error)
	CreateTestCase(ctx context.Context, projectID, userID uuid.UUID, inputPrompt, expectedOutput, expectedFormat string) (*models.TestCase, error)
	UpdateTestCase(ctx context.Context, tcID, projectID, userID uuid.UUID, inputPrompt, expectedOutput, expectedFormat string) (*models.TestCase, error)
	DeleteTestCase(ctx context.Context, tcID, projectID uuid.UUID) error
}

type repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) Repository {
	return &repository{db: db}
}

func (r *repository) GetTestCases(ctx context.Context, projectID uuid.UUID) ([]models.TestCase, error) {
	var testCases []models.TestCase
	err := r.db.SelectContext(ctx, &testCases, "SELECT * FROM test_cases WHERE project_id = $1 ORDER BY created_at DESC", projectID)
	if err != nil {
		return nil, err
	}
	if testCases == nil {
		testCases = []models.TestCase{}
	}
	return testCases, nil
}

func (r *repository) CreateTestCase(ctx context.Context, projectID, userID uuid.UUID, inputPrompt, expectedOutput, expectedFormat string) (*models.TestCase, error) {
	if expectedFormat == "" {
		expectedFormat = "plain_text"
	}

	query := `
		INSERT INTO test_cases (project_id, input_prompt, expected_output, expected_format, created_by, updated_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING *
	`
	var tc models.TestCase
	err := r.db.GetContext(ctx, &tc, query, projectID, inputPrompt, expectedOutput, expectedFormat, userID, userID)
	if err != nil {
		return nil, err
	}
	return &tc, nil
}

func (r *repository) UpdateTestCase(ctx context.Context, tcID, projectID, userID uuid.UUID, inputPrompt, expectedOutput, expectedFormat string) (*models.TestCase, error) {
	if expectedFormat == "" {
		expectedFormat = "plain_text"
	}

	query := `
		UPDATE test_cases 
		SET input_prompt = $1, expected_output = $2, expected_format = $3, updated_by = $4, updated_at = $5 
		WHERE id = $6 AND project_id = $7
		RETURNING *
	`
	var tc models.TestCase
	err := r.db.GetContext(ctx, &tc, query, inputPrompt, expectedOutput, expectedFormat, userID, time.Now(), tcID, projectID)
	if err != nil {
		return nil, err
	}
	return &tc, nil
}

func (r *repository) DeleteTestCase(ctx context.Context, tcID, projectID uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM test_cases WHERE id = $1 AND project_id = $2", tcID, projectID)
	return err
}
