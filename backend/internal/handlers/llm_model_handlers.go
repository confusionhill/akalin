package handlers

import (
	"context"
	"database/sql"
	"net/http"
	"time"

	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/evaluator"
	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/models"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

// -------------------------------------------------------------------------
// LLM Models Handlers — tenant-scoped (global, reusable across projects)
// -------------------------------------------------------------------------

func (h *Handler) GetLLMModels(c echo.Context) error {
	tenantID, _, _, err := h.getAuth(c)
	if err != nil {
		return err
	}

	var llmModels []models.LLMModel
	err = h.DB.Select(&llmModels, "SELECT * FROM llm_models WHERE tenant_id = $1 ORDER BY created_at DESC", tenantID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if llmModels == nil {
		llmModels = []models.LLMModel{}
	}
	return c.JSON(http.StatusOK, llmModels)
}

func (h *Handler) CreateLLMModel(c echo.Context) error {
	tenantID, userID, _, err := h.getAuth(c)
	if err != nil {
		return err
	}

	req := new(models.LLMModel)
	if err := c.Bind(req); err != nil {
		return err
	}
	if err := c.Validate(req); err != nil {
		return err
	}

	query := `
		INSERT INTO llm_models (tenant_id, provider_id, title, model, created_by, updated_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING *
	`
	var llmModel models.LLMModel
	err = h.DB.Get(&llmModel, query, tenantID, req.ProviderID, req.Title, req.Model, userID, userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, llmModel)
}

func (h *Handler) UpdateLLMModel(c echo.Context) error {
	tenantID, userID, _, err := h.getAuth(c)
	if err != nil {
		return err
	}
	modelID, err := uuid.Parse(c.Param("model_id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid model ID")
	}

	req := new(models.LLMModel)
	if err := c.Bind(req); err != nil {
		return err
	}
	if err := c.Validate(req); err != nil {
		return err
	}

	query := `
		UPDATE llm_models
		SET provider_id = $1, title = $2, model = $3, updated_by = $4, updated_at = $5
		WHERE id = $6 AND tenant_id = $7
		RETURNING *
	`
	var llmModel models.LLMModel
	err = h.DB.Get(&llmModel, query, req.ProviderID, req.Title, req.Model, userID, time.Now(), modelID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return echo.NewHTTPError(http.StatusNotFound, "Model not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, llmModel)
}

func (h *Handler) DeleteLLMModel(c echo.Context) error {
	tenantID, _, _, err := h.getAuth(c)
	if err != nil {
		return err
	}
	modelID, err := uuid.Parse(c.Param("model_id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid model ID")
	}

	_, err = h.DB.Exec("DELETE FROM llm_models WHERE id = $1 AND tenant_id = $2", modelID, tenantID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.NoContent(http.StatusNoContent)
}

// TestLLMModelReq is the request body for testing a model connection
type TestLLMModelReq struct {
	ProviderID uuid.UUID `json:"provider_id" validate:"required"`
	Model      string    `json:"model" validate:"required"`
}

// TestLLMModelResp is the response from a model test
type TestLLMModelResp struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

func (h *Handler) TestLLMModel(c echo.Context) error {
	tenantID, _, _, err := h.getAuth(c)
	if err != nil {
		return err
	}

	req := new(TestLLMModelReq)
	if err := c.Bind(req); err != nil {
		return err
	}
	if err := c.Validate(req); err != nil {
		return err
	}

	// Look up the provider
	var provider models.ProviderConfig
	err = h.DB.Get(&provider, "SELECT * FROM provider_configs WHERE id = $1 AND tenant_id = $2", req.ProviderID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusOK, TestLLMModelResp{Success: false, Error: "Provider not found"})
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	// Create LLM client and send a minimal test message
	client := evaluator.NewLLMClient(provider.BaseURL, provider.APIKey, provider.CustomHeaders)
	ctx, cancel := context.WithTimeout(c.Request().Context(), 30*time.Second)
	defer cancel()

	_, _, err = client.Generate(ctx, req.Model, "", "Hello", 0.0)
	if err != nil {
		return c.JSON(http.StatusOK, TestLLMModelResp{Success: false, Error: err.Error()})
	}

	return c.JSON(http.StatusOK, TestLLMModelResp{Success: true})
}
