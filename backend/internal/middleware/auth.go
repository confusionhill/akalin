package middleware

import (
	"log"
	"net/http"

	"github.com/labstack/echo/v4"
)

type AuthMiddleware struct{}

func NewAuthMiddleware() *AuthMiddleware {
	return &AuthMiddleware{}
}

func (m *AuthMiddleware) RequireAuth(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		// Allow access to public endpoints
		path := c.Path()
		if path == "/api/auth/login" || path == "/api/auth/register" {
			return next(c)
		}

		// Check for JWT token in Authorization header
		authHeader := c.Request().Header.Get("Authorization")
		if authHeader == "" {
			log.Printf("Auth failed: missing Authorization header for path %s", path)
			return c.JSON(http.StatusUnauthorized, map[string]string{
				"message": "Authentication required. Please provide Authorization header with Bearer token.",
			})
		}

		// Extract token (format: "Bearer <token>")
		tokenString := c.Request().Header.Get("Authorization")
		if len(tokenString) < 7 || tokenString[:7] != "Bearer " {
			log.Printf("Auth failed: invalid Authorization header format for path %s", path)
			return c.JSON(http.StatusUnauthorized, map[string]string{
				"message": "Invalid Authorization header format. Use 'Bearer <token>'",
			})
		}

		// Token is extracted; tenant_id and user_id will be validated in getAuth
		return next(c)
	}
}