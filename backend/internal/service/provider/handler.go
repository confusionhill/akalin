package provider

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

func (h *Handler) GetProviders(c echo.Context) error {
	tenantID, _, _, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}

	providers, err := h.usecase.GetProviders(c.Request().Context(), tenantID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, providers)
}

func (h *Handler) CreateProvider(c echo.Context) error {
	tenantID, userID, accessRole, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}
	if accessRole < 60 {
		return echo.NewHTTPError(http.StatusForbidden, "Forbidden: Only workspace admins or owners can configure providers")
	}

	req := new(models.ProviderConfig)
	if err := c.Bind(req); err != nil {
		return err
	}
	if err := c.Validate(req); err != nil {
		return err
	}

	provider, err := h.usecase.CreateProvider(c.Request().Context(), tenantID, userID, *req)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, provider)
}

func (h *Handler) UpdateProvider(c echo.Context) error {
	tenantID, userID, accessRole, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}
	if accessRole < 60 {
		return echo.NewHTTPError(http.StatusForbidden, "Forbidden: Only workspace admins or owners can configure providers")
	}
	providerID, err := uuid.Parse(c.Param("provider_id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid provider ID")
	}

	req := new(models.ProviderConfig)
	if err := c.Bind(req); err != nil {
		return err
	}
	if err := c.Validate(req); err != nil {
		return err
	}

	provider, err := h.usecase.UpdateProvider(c.Request().Context(), providerID, tenantID, userID, *req)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return echo.NewHTTPError(http.StatusNotFound, "Provider not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, provider)
}

func (h *Handler) DeleteProvider(c echo.Context) error {
	tenantID, _, accessRole, err := h.authHandler.GetAuth(c)
	if err != nil {
		return err
	}
	if accessRole < 60 {
		return echo.NewHTTPError(http.StatusForbidden, "Forbidden: Only workspace admins or owners can configure providers")
	}
	providerID, err := uuid.Parse(c.Param("provider_id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid provider ID")
	}

	err = h.usecase.DeleteProvider(c.Request().Context(), providerID, tenantID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.NoContent(http.StatusNoContent)
}
