package tool

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

type UpdateProjectToolsReq struct {
	ToolIDs []uuid.UUID `json:"tool_ids"`
}

func (h *Handler) GetTools(c echo.Context) error {
	tenantID, _, _, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}

	tools, err := h.usecase.GetTools(c.Request().Context(), tenantID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, tools)
}

func (h *Handler) CreateTool(c echo.Context) error {
	tenantID, userID, _, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}

	req := new(models.Tool)
	if err := c.Bind(req); err != nil {
		return err
	}
	if err := c.Validate(req); err != nil {
		return err
	}

	tool, err := h.usecase.CreateTool(c.Request().Context(), tenantID, userID, *req)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, tool)
}

func (h *Handler) UpdateTool(c echo.Context) error {
	tenantID, userID, _, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}
	toolID, err := uuid.Parse(c.Param("tool_id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid tool ID")
	}

	req := new(models.Tool)
	if err := c.Bind(req); err != nil {
		return err
	}
	if err := c.Validate(req); err != nil {
		return err
	}

	tool, err := h.usecase.UpdateTool(c.Request().Context(), toolID, tenantID, userID, *req)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return echo.NewHTTPError(http.StatusNotFound, "Tool not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, tool)
}

func (h *Handler) DeleteTool(c echo.Context) error {
	tenantID, _, _, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}
	toolID, err := uuid.Parse(c.Param("tool_id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid tool ID")
	}

	err = h.usecase.DeleteTool(c.Request().Context(), toolID, tenantID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.NoContent(http.StatusNoContent)
}

func (h *Handler) GetProjectTools(c echo.Context) error {
	_, _, _, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}

	tools, err := h.usecase.GetProjectTools(c.Request().Context(), projectID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, tools)
}

func (h *Handler) UpdateProjectTools(c echo.Context) error {
	_, _, _, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}

	req := new(UpdateProjectToolsReq)
	if err := c.Bind(req); err != nil {
		return err
	}

	tools, err := h.usecase.UpdateProjectTools(c.Request().Context(), projectID, req.ToolIDs)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, tools)
}
