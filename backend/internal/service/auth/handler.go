package auth

import (
	"errors"
	"net/http"
	"strings"

	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/config"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

type Handler struct {
	usecase Usecase
	cfg     *config.Config
}

func NewHandler(u Usecase, cfg *config.Config) *Handler {
	return &Handler{
		usecase: u,
		cfg:     cfg,
	}
}

// GetUserAuth extracts user context from JWT token (only requires user_id)
func (h *Handler) GetUserAuth(c echo.Context) (uuid.UUID, error) {
	authHeader := c.Request().Header.Get("Authorization")
	if authHeader == "" {
		return uuid.Nil, echo.NewHTTPError(http.StatusUnauthorized, "Missing Authorization header")
	}

	tokenString := strings.TrimPrefix(authHeader, "Bearer ")
	if tokenString == authHeader {
		return uuid.Nil, echo.NewHTTPError(http.StatusUnauthorized, "Invalid Authorization header format")
	}

	jwtManager := NewJWTManager(h.cfg.JWTSigningKey, int(h.cfg.JWTExpiration))
	claims, err := jwtManager.ValidateToken(tokenString)
	if err != nil {
		return uuid.Nil, echo.NewHTTPError(http.StatusUnauthorized, "Invalid or expired token")
	}

	c.Set("user_id", claims.UserID)
	return claims.UserID, nil
}

// GetAuth extracts full tenant session context from JWT token
func (h *Handler) GetAuth(c echo.Context) (uuid.UUID, uuid.UUID, int, error) {
	authHeader := c.Request().Header.Get("Authorization")
	if authHeader == "" {
		return uuid.Nil, uuid.Nil, 0, echo.NewHTTPError(http.StatusUnauthorized, "Missing Authorization header")
	}

	tokenString := strings.TrimPrefix(authHeader, "Bearer ")
	if tokenString == authHeader {
		return uuid.Nil, uuid.Nil, 0, echo.NewHTTPError(http.StatusUnauthorized, "Invalid Authorization header format")
	}

	jwtManager := NewJWTManager(h.cfg.JWTSigningKey, int(h.cfg.JWTExpiration))
	claims, err := jwtManager.ValidateToken(tokenString)
	if err != nil {
		return uuid.Nil, uuid.Nil, 0, echo.NewHTTPError(http.StatusUnauthorized, "Invalid or expired token")
	}

	if claims.TenantID == uuid.Nil {
		return uuid.Nil, claims.UserID, 0, echo.NewHTTPError(http.StatusForbidden, "No active workspace session selected. Please select a workspace.")
	}

	c.Set("tenant_id", claims.TenantID)
	c.Set("user_id", claims.UserID)
	c.Set("access_role", claims.AccessRole)

	return claims.TenantID, claims.UserID, claims.AccessRole, nil
}

func (h *Handler) Login(c echo.Context) error {
	req := new(LoginReq)
	if err := c.Bind(req); err != nil {
		return err
	}
	if err := c.Validate(req); err != nil {
		return err
	}

	resp, err := h.usecase.Login(c.Request().Context(), *req)
	if err != nil {
		if errors.Is(err, ErrInvalidCredentials) {
			return echo.NewHTTPError(http.StatusUnauthorized, err.Error())
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, resp)
}

func (h *Handler) Register(c echo.Context) error {
	req := new(RegisterReq)
	if err := c.Bind(req); err != nil {
		return err
	}
	if err := c.Validate(req); err != nil {
		return err
	}

	resp, err := h.usecase.Register(c.Request().Context(), *req)
	if err != nil {
		if errors.Is(err, ErrEmailTaken) || errors.Is(err, ErrHandleTaken) {
			return echo.NewHTTPError(http.StatusBadRequest, err.Error())
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, resp)
}

func (h *Handler) CreateTenant(c echo.Context) error {
	userID, err := h.GetUserAuth(c)
	if err != nil {
		return err
	}

	req := new(CreateTenantReq)
	if err := c.Bind(req); err != nil {
		return err
	}
	if err := c.Validate(req); err != nil {
		return err
	}

	tenant, err := h.usecase.CreateTenant(c.Request().Context(), userID, *req)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, tenant)
}

func (h *Handler) GetMyTenants(c echo.Context) error {
	userID, err := h.GetUserAuth(c)
	if err != nil {
		return err
	}

	tenants, err := h.usecase.GetMyTenants(c.Request().Context(), userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, tenants)
}

func (h *Handler) SwitchTenant(c echo.Context) error {
	userID, err := h.GetUserAuth(c)
	if err != nil {
		return err
	}

	req := new(SwitchTenantReq)
	if err := c.Bind(req); err != nil {
		return err
	}
	if err := c.Validate(req); err != nil {
		return err
	}

	sess, err := h.usecase.SwitchTenant(c.Request().Context(), userID, *req)
	if err != nil {
		if errors.Is(err, ErrNotMember) {
			return echo.NewHTTPError(http.StatusForbidden, err.Error())
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, sess)
}

func (h *Handler) GetTenantUsers(c echo.Context) error {
	tenantID, _, _, err := h.GetAuth(c)
	if err != nil {
		return err
	}

	users, err := h.usecase.GetTenantUsers(c.Request().Context(), tenantID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, users)
}

func (h *Handler) RemoveTenantUser(c echo.Context) error {
	tenantID, actorID, _, err := h.GetAuth(c)
	if err != nil {
		return err
	}

	targetUserID, err := uuid.Parse(c.Param("user_id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid user ID")
	}

	err = h.usecase.RemoveTenantUser(c.Request().Context(), tenantID, actorID, targetUserID)
	if err != nil {
		if errors.Is(err, ErrUnauthorizedAction) {
			return echo.NewHTTPError(http.StatusForbidden, err.Error())
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.NoContent(http.StatusNoContent)
}

func (h *Handler) UpdateTenantUserRole(c echo.Context) error {
	tenantID, actorID, _, err := h.GetAuth(c)
	if err != nil {
		return err
	}

	targetUserID, err := uuid.Parse(c.Param("user_id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid user ID")
	}

	req := new(UpdateMemberRoleReq)
	if err := c.Bind(req); err != nil {
		return err
	}
	if err := c.Validate(req); err != nil {
		return err
	}

	err = h.usecase.UpdateTenantUserRole(c.Request().Context(), tenantID, actorID, targetUserID, req.AccessRole)
	if err != nil {
		if errors.Is(err, ErrUnauthorizedAction) {
			return echo.NewHTTPError(http.StatusForbidden, err.Error())
		}
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	return c.NoContent(http.StatusNoContent)
}

func (h *Handler) CreateInvitation(c echo.Context) error {
	tenantID, actorID, _, err := h.GetAuth(c)
	if err != nil {
		return err
	}

	req := new(CreateInvitationReq)
	if err := c.Bind(req); err != nil {
		return err
	}
	if err := c.Validate(req); err != nil {
		return err
	}

	invite, err := h.usecase.CreateInvitation(c.Request().Context(), tenantID, actorID, *req)
	if err != nil {
		if errors.Is(err, ErrUnauthorizedAction) {
			return echo.NewHTTPError(http.StatusForbidden, err.Error())
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, invite)
}

func (h *Handler) JoinTenant(c echo.Context) error {
	userID, err := h.GetUserAuth(c)
	if err != nil {
		return err
	}

	req := new(JoinTenantReq)
	if err := c.Bind(req); err != nil {
		return err
	}
	if err := c.Validate(req); err != nil {
		return err
	}

	tenant, err := h.usecase.JoinTenant(c.Request().Context(), userID, *req)
	if err != nil {
		if errors.Is(err, ErrInvitationExpired) || errors.Is(err, ErrInvitationInvalid) {
			return echo.NewHTTPError(http.StatusBadRequest, err.Error())
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, tenant)
}

func (h *Handler) UpdateProfile(c echo.Context) error {
	_, userID, _, err := h.GetAuth(c)
	if err != nil {
		return err
	}

	req := new(UpdateProfileReq)
	if err := c.Bind(req); err != nil {
		return err
	}
	if err := c.Validate(req); err != nil {
		return err
	}

	err = h.usecase.UpdateProfile(c.Request().Context(), userID, *req)
	if err != nil {
		if errors.Is(err, ErrEmailTaken) || errors.Is(err, ErrHandleTaken) {
			return echo.NewHTTPError(http.StatusBadRequest, err.Error())
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{
		"email":     req.Email,
		"handle":    req.Handle,
		"full_name": req.FullName,
	})
}

func (h *Handler) UpdatePassword(c echo.Context) error {
	_, userID, _, err := h.GetAuth(c)
	if err != nil {
		return err
	}

	req := new(UpdatePasswordReq)
	if err := c.Bind(req); err != nil {
		return err
	}
	if err := c.Validate(req); err != nil {
		return err
	}

	err = h.usecase.UpdatePassword(c.Request().Context(), userID, *req)
	if err != nil {
		if errors.Is(err, ErrInvalidCredentials) {
			return echo.NewHTTPError(http.StatusUnauthorized, err.Error())
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Password updated successfully",
	})
}

func (h *Handler) CreateAPIKey(c echo.Context) error {
	// Either GetAuth or GetUserAuth, but GetUserAuth is better since API Keys are user-level, not tenant-level
	userID, err := h.GetUserAuth(c)
	if err != nil {
		return err
	}

	req := new(CreateAPIKeyReq)
	if err := c.Bind(req); err != nil {
		return err
	}
	if err := c.Validate(req); err != nil {
		return err
	}

	resp, err := h.usecase.CreateAPIKey(c.Request().Context(), userID, *req)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, resp)
}

func (h *Handler) GetAPIKeys(c echo.Context) error {
	userID, err := h.GetUserAuth(c)
	if err != nil {
		return err
	}

	keys, err := h.usecase.GetAPIKeys(c.Request().Context(), userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, keys)
}

func (h *Handler) DeleteAPIKey(c echo.Context) error {
	userID, err := h.GetUserAuth(c)
	if err != nil {
		return err
	}

	keyID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid key ID")
	}

	err = h.usecase.DeleteAPIKey(c.Request().Context(), userID, keyID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.NoContent(http.StatusNoContent)
}

func (h *Handler) APIKeyMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		authHeader := c.Request().Header.Get("Authorization")
		if authHeader == "" {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing Authorization header")
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			return echo.NewHTTPError(http.StatusUnauthorized, "Invalid Authorization header format")
		}

		// API Keys start with "ak-"
		if !strings.HasPrefix(tokenString, "ak-") {
			return echo.NewHTTPError(http.StatusUnauthorized, "Invalid API key format")
		}

		userID, err := h.usecase.ValidateAPIKey(c.Request().Context(), tokenString)
		if err != nil {
			if errors.Is(err, ErrInvalidCredentials) {
				return echo.NewHTTPError(http.StatusUnauthorized, "Invalid or expired API key")
			}
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to validate API key")
		}

		c.Set("user_id", userID)
		return next(c)
	}
}
