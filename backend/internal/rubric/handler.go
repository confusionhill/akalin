package rubric

import (
	"database/sql"
	"errors"
	"net/http"

	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/auth"
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

func (h *Handler) RefineEvaluationPrompt(c echo.Context) error {
	_, userID, _, err := h.authHandler.GetAuth(c)
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

	req := new(RefineRubricRequest)
	if err := c.Bind(req); err != nil {
		return err
	}

	draftID, err := h.usecase.RefineEvaluationPrompt(c.Request().Context(), projectID, runID, userID, *req)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return echo.NewHTTPError(http.StatusNotFound, "Run not found")
		}
		if errors.Is(err, ErrRunIncomplete) || errors.Is(err, ErrInvalidBasePrompt) || errors.Is(err, ErrNoResultsToAnalyze) {
			return echo.NewHTTPError(http.StatusBadRequest, err.Error())
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusAccepted, map[string]uuid.UUID{"draft_id": draftID})
}

func (h *Handler) CalibrateEvaluationPrompt(c echo.Context) error {
	_, userID, _, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}

	req := new(CalibrateRubricRequest)
	if err := c.Bind(req); err != nil {
		return err
	}

	if req.ProviderID == uuid.Nil || req.Model == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "provider_id and model are required")
	}

	if len(req.Rows) == 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "At least one row of training data is required")
	}
	if len(req.Rows) > 100 {
		return echo.NewHTTPError(http.StatusBadRequest, "Maximum 100 rows supported")
	}

	draftID, err := h.usecase.CalibrateEvaluationPrompt(c.Request().Context(), projectID, userID, *req)
	if err != nil {
		if errors.Is(err, ErrInvalidBasePrompt) {
			return echo.NewHTTPError(http.StatusBadRequest, err.Error())
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusAccepted, map[string]uuid.UUID{"draft_id": draftID})
}

func (h *Handler) GetRubricDrafts(c echo.Context) error {
	_, _, _, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}

	drafts, err := h.usecase.GetRubricDrafts(c.Request().Context(), projectID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, drafts)
}

func (h *Handler) DeleteRubricDraft(c echo.Context) error {
	_, _, _, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}
	draftID, err := uuid.Parse(c.Param("draft_id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid draft ID")
	}

	deleted, err := h.usecase.DeleteRubricDraft(c.Request().Context(), draftID, projectID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if !deleted {
		return echo.NewHTTPError(http.StatusNotFound, "Rubric draft not found")
	}

	return c.NoContent(http.StatusNoContent)
}

func (h *Handler) RetryRubricDraft(c echo.Context) error {
	_, _, _, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}
	draftID, err := uuid.Parse(c.Param("draft_id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid draft ID")
	}

	newDraftID, err := h.usecase.RetryRubricDraft(c.Request().Context(), draftID, projectID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return echo.NewHTTPError(http.StatusNotFound, "Rubric draft not found")
		}
		if errors.Is(err, ErrDraftNotRetriable) || errors.Is(err, ErrMissingPayload) {
			return echo.NewHTTPError(http.StatusBadRequest, err.Error())
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusAccepted, map[string]uuid.UUID{"draft_id": newDraftID})
}

func (h *Handler) GetRubricDraft(c echo.Context) error {
	_, _, _, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}
	draftID, err := uuid.Parse(c.Param("draft_id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid draft ID")
	}

	draft, err := h.usecase.GetRubricDraft(c.Request().Context(), draftID, projectID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return echo.NewHTTPError(http.StatusNotFound, "Rubric draft not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, draft)
}

func (h *Handler) CancelRubricDraft(c echo.Context) error {
	_, _, _, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}
	draftID, err := uuid.Parse(c.Param("draft_id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid draft ID")
	}

	_, err = h.usecase.CancelRubricDraft(c.Request().Context(), draftID, projectID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.NoContent(http.StatusOK)
}

func (h *Handler) DownloadCSVTemplate(c echo.Context) error {
	template := "input,expected_output,actual_output,score,reasoning\n"
	c.Response().Header().Set("Content-Type", "text/csv")
	c.Response().Header().Set("Content-Disposition", "attachment; filename=\"rubric_training_template.csv\"")
	return c.String(http.StatusOK, template)
}
