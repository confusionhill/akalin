package evaluation

import (
	"database/sql"
	"errors"
	"net/http"

	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/auth"
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

func (h *Handler) GetEvaluations(c echo.Context) error {
	_, _, _, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}

	runs, err := h.usecase.GetEvaluations(c.Request().Context(), projectID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, runs)
}

func (h *Handler) CreateEvaluation(c echo.Context) error {
	_, userID, _, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}

	req := new(models.EvaluationRun)
	if err := c.Bind(req); err != nil {
		return err
	}
	if err := c.Validate(req); err != nil {
		return err
	}

	run, err := h.usecase.CreateEvaluation(c.Request().Context(), projectID, userID, *req)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusAccepted, run)
}

func (h *Handler) CancelEvaluation(c echo.Context) error {
	_, _, _, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}
	runID, err := uuid.Parse(c.Param("run_id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid run ID")
	}

	cancelled, err := h.usecase.CancelEvaluation(c.Request().Context(), runID, projectID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if !cancelled {
		return echo.NewHTTPError(http.StatusNotFound, "Run not found or cannot be cancelled")
	}

	return c.NoContent(http.StatusOK)
}

func (h *Handler) GetEvaluationDetails(c echo.Context) error {
	_, _, _, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}
	runID, err := uuid.Parse(c.Param("run_id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid run ID")
	}

	details, err := h.usecase.GetEvaluationDetails(c.Request().Context(), runID, projectID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return echo.NewHTTPError(http.StatusNotFound, "Evaluation run not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, details)
}

func (h *Handler) DeleteEvaluation(c echo.Context) error {
	_, _, _, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}
	runID, err := uuid.Parse(c.Param("run_id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid run ID")
	}

	err = h.usecase.DeleteEvaluation(c.Request().Context(), runID, projectID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.NoContent(http.StatusNoContent)
}

func (h *Handler) GetConfigs(c echo.Context) error {
	_, _, _, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}

	configs, err := h.usecase.GetConfigs(c.Request().Context(), projectID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, configs)
}

func (h *Handler) CreateConfig(c echo.Context) error {
	_, userID, _, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}

	req := new(models.EvaluationConfig)
	if err := c.Bind(req); err != nil {
		return err
	}
	if err := c.Validate(req); err != nil {
		return err
	}

	cfg, err := h.usecase.CreateConfig(c.Request().Context(), projectID, userID, *req)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, cfg)
}

func (h *Handler) UpdateConfig(c echo.Context) error {
	_, userID, _, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}
	configID, err := uuid.Parse(c.Param("config_id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid config ID")
	}

	req := new(models.EvaluationConfig)
	if err := c.Bind(req); err != nil {
		return err
	}
	if err := c.Validate(req); err != nil {
		return err
	}

	cfg, err := h.usecase.UpdateConfig(c.Request().Context(), configID, projectID, userID, *req)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, cfg)
}

func (h *Handler) DeleteConfig(c echo.Context) error {
	_, _, _, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}
	configID, err := uuid.Parse(c.Param("config_id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid config ID")
	}

	err = h.usecase.DeleteConfig(c.Request().Context(), configID, projectID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.NoContent(http.StatusNoContent)
}
