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

// GetAuth extracts user context from JWT token (helper function)
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
			return echo.NewHTTPError(http.StatusConflict, err.Error())
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, resp)
}

func (h *Handler) UpdateProfile(c echo.Context) error {
	tenantID, userID, _, err := h.GetAuth(c)
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

	err = h.usecase.UpdateProfile(c.Request().Context(), tenantID, userID, *req)
	if err != nil {
		if errors.Is(err, ErrEmailTaken) || errors.Is(err, ErrHandleTaken) {
			return echo.NewHTTPError(http.StatusConflict, err.Error())
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Profile updated successfully"})
}

func (h *Handler) UpdatePassword(c echo.Context) error {
	tenantID, userID, _, err := h.GetAuth(c)
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

	err = h.usecase.UpdatePassword(c.Request().Context(), tenantID, userID, *req)
	if err != nil {
		if errors.Is(err, ErrInvalidCredentials) {
			return echo.NewHTTPError(http.StatusUnauthorized, "Current password is incorrect")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Password updated successfully"})
}
