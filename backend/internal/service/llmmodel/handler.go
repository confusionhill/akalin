package llmmodel

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"time"

	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/service/auth"
	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/models"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

type Handler struct {
	usecase     Usecase
	authHandler *auth.Handler
}

func NewHandler(u Usecase, authHandler *auth.Handler) *Handler {
	return &Handler{
		usecase:     u,
		authHandler: authHandler,
	}
}

func (h *Handler) GetLLMModels(c echo.Context) error {
	tenantID, _, _, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}

	llmModels, err := h.usecase.GetLLMModels(c.Request().Context(), tenantID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, llmModels)
}

func (h *Handler) CreateLLMModel(c echo.Context) error {
	tenantID, userID, _, err := h.authHandler.GetAuth(c)
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

	llmModel, err := h.usecase.CreateLLMModel(c.Request().Context(), tenantID, userID, *req)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, llmModel)
}

func (h *Handler) UpdateLLMModel(c echo.Context) error {
	tenantID, userID, _, err := h.authHandler.GetAuth(c)
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

	llmModel, err := h.usecase.UpdateLLMModel(c.Request().Context(), modelID, tenantID, userID, *req)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return echo.NewHTTPError(http.StatusNotFound, "Model not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, llmModel)
}

func (h *Handler) DeleteLLMModel(c echo.Context) error {
	tenantID, _, _, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}
	modelID, err := uuid.Parse(c.Param("model_id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid model ID")
	}

	err = h.usecase.DeleteLLMModel(c.Request().Context(), modelID, tenantID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.NoContent(http.StatusNoContent)
}

func (h *Handler) TestLLMModel(c echo.Context) error {
	tenantID, _, _, err := h.authHandler.GetAuth(c)
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

	ctx, cancel := context.WithTimeout(c.Request().Context(), 30*time.Second)
	defer cancel()

	resp, err := h.usecase.TestLLMModel(ctx, tenantID, *req)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, resp)
}
