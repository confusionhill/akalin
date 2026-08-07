package llmmodel

import (
	"context"

	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/service/evaluator"
	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/models"
	"github.com/google/uuid"
)

type TestLLMModelReq struct {
	ProviderID uuid.UUID `json:"provider_id" validate:"required"`
	Model      string    `json:"model" validate:"required"`
}

type TestLLMModelResp struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

type Usecase interface {
	GetLLMModels(ctx context.Context, tenantID uuid.UUID) ([]models.LLMModel, error)
	CreateLLMModel(ctx context.Context, tenantID, userID uuid.UUID, req models.LLMModel) (*models.LLMModel, error)
	UpdateLLMModel(ctx context.Context, modelID, tenantID, userID uuid.UUID, req models.LLMModel) (*models.LLMModel, error)
	DeleteLLMModel(ctx context.Context, modelID, tenantID uuid.UUID) error
	TestLLMModel(ctx context.Context, tenantID uuid.UUID, req TestLLMModelReq) (*TestLLMModelResp, error)
}

type usecase struct {
	repo Repository
}

func NewUsecase(repo Repository) Usecase {
	return &usecase{repo: repo}
}

func (u *usecase) GetLLMModels(ctx context.Context, tenantID uuid.UUID) ([]models.LLMModel, error) {
	return u.repo.GetLLMModels(ctx, tenantID)
}

func (u *usecase) CreateLLMModel(ctx context.Context, tenantID, userID uuid.UUID, req models.LLMModel) (*models.LLMModel, error) {
	return u.repo.CreateLLMModel(ctx, tenantID, userID, req)
}

func (u *usecase) UpdateLLMModel(ctx context.Context, modelID, tenantID, userID uuid.UUID, req models.LLMModel) (*models.LLMModel, error) {
	return u.repo.UpdateLLMModel(ctx, modelID, tenantID, userID, req)
}

func (u *usecase) DeleteLLMModel(ctx context.Context, modelID, tenantID uuid.UUID) error {
	return u.repo.DeleteLLMModel(ctx, modelID, tenantID)
}

func (u *usecase) TestLLMModel(ctx context.Context, tenantID uuid.UUID, req TestLLMModelReq) (*TestLLMModelResp, error) {
	provider, err := u.repo.GetProvider(ctx, req.ProviderID, tenantID)
	if err != nil {
		return &TestLLMModelResp{Success: false, Error: "Provider not found"}, nil
	}

	client := evaluator.NewLLMClient(provider.BaseURL, provider.APIKey, provider.CustomHeaders)
	_, _, err = client.Generate(ctx, req.Model, "", "Hello", 0.0)
	if err != nil {
		return &TestLLMModelResp{Success: false, Error: err.Error()}, nil
	}

	return &TestLLMModelResp{Success: true}, nil
}
