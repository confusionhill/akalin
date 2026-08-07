package prompt

import (
	"database/sql"
	"errors"
	"net/http"

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

func (h *Handler) GetSystemPrompts(c echo.Context) error {
	_, _, _, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}

	prompts, err := h.usecase.GetSystemPrompts(c.Request().Context(), projectID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, prompts)
}

func (h *Handler) CreateSystemPrompt(c echo.Context) error {
	_, userID, _, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}

	req := new(models.SystemPrompt)
	if err := c.Bind(req); err != nil {
		return err
	}
	if err := c.Validate(req); err != nil {
		return err
	}

	prompt, err := h.usecase.CreateSystemPrompt(c.Request().Context(), projectID, userID, req.Content)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, prompt)
}

func (h *Handler) UpdateSystemPrompt(c echo.Context) error {
	_, _, _, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}
	promptID, err := uuid.Parse(c.Param("prompt_id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid prompt ID")
	}

	req := new(models.SystemPrompt)
	if err := c.Bind(req); err != nil {
		return err
	}
	if err := c.Validate(req); err != nil {
		return err
	}

	prompt, err := h.usecase.UpdateSystemPrompt(c.Request().Context(), promptID, projectID, req.Content)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return echo.NewHTTPError(http.StatusNotFound, "System prompt not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, prompt)
}

func (h *Handler) GetEvaluationPrompts(c echo.Context) error {
	_, _, _, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}

	prompts, err := h.usecase.GetEvaluationPrompts(c.Request().Context(), projectID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, prompts)
}

func (h *Handler) CreateEvaluationPrompt(c echo.Context) error {
	_, userID, _, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}

	req := new(models.EvaluationPrompt)
	if err := c.Bind(req); err != nil {
		return err
	}
	if err := c.Validate(req); err != nil {
		return err
	}

	prompt, err := h.usecase.CreateEvaluationPrompt(c.Request().Context(), projectID, userID, req.Content)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, prompt)
}

func (h *Handler) UpdateEvaluationPrompt(c echo.Context) error {
	_, _, _, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}
	promptID, err := uuid.Parse(c.Param("prompt_id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid prompt ID")
	}

	req := new(models.EvaluationPrompt)
	if err := c.Bind(req); err != nil {
		return err
	}
	if err := c.Validate(req); err != nil {
		return err
	}

	prompt, err := h.usecase.UpdateEvaluationPrompt(c.Request().Context(), promptID, projectID, req.Content)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return echo.NewHTTPError(http.StatusNotFound, "Evaluation prompt not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, prompt)
}
