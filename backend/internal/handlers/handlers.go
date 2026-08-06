package handlers

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/config"
	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/auth"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/models"
	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/worker"
)

type Handler struct {
	Cfg *config.Config
	DB  *sqlx.DB
}

func NewHandler(cfg *config.Config, db *sqlx.DB) *Handler {
	return &Handler{Cfg: cfg, DB: db}
}

// getAuth extracts user context from JWT token
func (h *Handler) getAuth(c echo.Context) (uuid.UUID, uuid.UUID, int, error) {
	// Get JWT token from Authorization header
	authHeader := c.Request().Header.Get("Authorization")
	if authHeader == "" {
		return uuid.Nil, uuid.Nil, 0, echo.NewHTTPError(http.StatusUnauthorized, "Missing Authorization header")
	}

	// Extract token (format: "Bearer <token>")
	tokenString := strings.TrimPrefix(authHeader, "Bearer ")
	if tokenString == authHeader {
		return uuid.Nil, uuid.Nil, 0, echo.NewHTTPError(http.StatusUnauthorized, "Invalid Authorization header format")
	}

	// Validate JWT token
	jwtManager := auth.NewJWTManager(h.Cfg.JWTSigningKey, int(h.Cfg.JWTExpiration))
	claims, err := jwtManager.ValidateToken(tokenString)
	if err != nil {
		return uuid.Nil, uuid.Nil, 0, echo.NewHTTPError(http.StatusUnauthorized, "Invalid or expired token")
	}

	// Store tenant_id, user_id, and access_role in context for middleware access
	c.Set("tenant_id", claims.TenantID)
	c.Set("user_id", claims.UserID)
	c.Set("access_role", claims.AccessRole)

	return claims.TenantID, claims.UserID, claims.AccessRole, nil
}

// -------------------------------------------------------------------------
// Authentication Handlers
// -------------------------------------------------------------------------

type LoginReq struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type RegisterReq struct {
	TenantName string `json:"tenant_name" validate:"required"`
	Email      string `json:"email" validate:"required,email"`
	Handle     string `json:"handle" validate:"required"`
	FullName   string `json:"full_name" validate:"required"`
	Password   string `json:"password" validate:"required"`
}

func (h *Handler) Login(c echo.Context) error {
	req := new(LoginReq)
	if err := c.Bind(req); err != nil {
		return err
	}
	if err := c.Validate(req); err != nil {
		return err
	}

	var user models.User
	err := h.DB.Get(&user, "SELECT * FROM users WHERE email = $1", req.Email)
	if err != nil {
		if err == sql.ErrNoRows {
			return echo.NewHTTPError(http.StatusUnauthorized, "Invalid credentials")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	// Local seed user bypasses standard bcrypt hashes
	if user.PasswordHash == "$2a$10$uRqdKxM/8fX8699hKj7qUeM7j052uF7c.jE.m574J2yqX0eE8d89O" || user.PasswordHash == "hashedpassword" {
		if req.Password != "password" && req.Password != "admin" {
			return echo.NewHTTPError(http.StatusUnauthorized, "Invalid credentials")
		}
	} else {
		err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password))
		if err != nil {
			return echo.NewHTTPError(http.StatusUnauthorized, "Invalid credentials")
		}
	}

	// Generate JWT token including access_role
	jwtManager := auth.NewJWTManager(h.Cfg.JWTSigningKey, int(h.Cfg.JWTExpiration))
	token, err := jwtManager.GenerateToken(user.TenantID, user.ID, user.AccessRole)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate token")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"id":          user.ID,
		"email":       user.Email,
		"handle":      user.Handle,
		"full_name":   user.FullName,
		"access_role": user.AccessRole,
		"token":       token,
	})
}

func (h *Handler) Register(c echo.Context) error {
	req := new(RegisterReq)
	if err := c.Bind(req); err != nil {
		return err
	}
	if err := c.Validate(req); err != nil {
		return err
	}

	var count int
	err := h.DB.Get(&count, "SELECT COUNT(*) FROM users WHERE email = $1", req.Email)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if count > 0 {
		return echo.NewHTTPError(http.StatusConflict, "Email already registered")
	}

	var handleCount int
	err = h.DB.Get(&handleCount, "SELECT COUNT(*) FROM users WHERE handle = $1", req.Handle)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if handleCount > 0 {
		return echo.NewHTTPError(http.StatusConflict, "Handle already taken")
	}

	bytes, err := bcrypt.GenerateFromPassword([]byte(req.Password), 10)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to hash password")
	}
	hash := string(bytes)

	tx, err := h.DB.Beginx()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	defer tx.Rollback()

	var tenantID uuid.UUID
	err = tx.Get(&tenantID, "INSERT INTO tenants (name) VALUES ($1) RETURNING id", req.TenantName)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	// First tenant user gets tenant master / admin role (60)
	var user models.User
	err = tx.Get(&user, "INSERT INTO users (tenant_id, email, handle, full_name, password_hash, access_role) VALUES ($1, $2, $3, $4, $5, 60) RETURNING *", tenantID, req.Email, req.Handle, req.FullName, hash)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	// Set tenant master_user_id
	_, err = tx.Exec("UPDATE tenants SET master_user_id = $1 WHERE id = $2", user.ID, tenantID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	if err := tx.Commit(); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	// Generate JWT token including access_role
	jwtManager := auth.NewJWTManager(h.Cfg.JWTSigningKey, int(h.Cfg.JWTExpiration))
	token, err := jwtManager.GenerateToken(user.TenantID, user.ID, user.AccessRole)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate token")
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"id":          user.ID,
		"email":       user.Email,
		"handle":      user.Handle,
		"full_name":   user.FullName,
		"access_role": user.AccessRole,
		"token":       token,
	})
}

// -------------------------------------------------------------------------
// User Settings Handlers
// -------------------------------------------------------------------------

type UpdateProfileReq struct {
	Email    string `json:"email" validate:"required,email"`
	Handle   string `json:"handle" validate:"required"`
	FullName string `json:"full_name" validate:"required"`
}

type UpdatePasswordReq struct {
	CurrentPassword string `json:"current_password" validate:"required"`
	NewPassword     string `json:"new_password" validate:"required,min=6"`
}

func (h *Handler) UpdateProfile(c echo.Context) error {
	tenantID, userID, _, err := h.getAuth(c)
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

	// Check if email is taken by another user
	var count int
	err = h.DB.Get(&count, "SELECT COUNT(*) FROM users WHERE email = $1 AND id != $2", req.Email, userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if count > 0 {
		return echo.NewHTTPError(http.StatusConflict, "Email already taken")
	}

	// Check if handle is taken by another user
	var handleCount int
	err = h.DB.Get(&handleCount, "SELECT COUNT(*) FROM users WHERE handle = $1 AND id != $2", req.Handle, userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if handleCount > 0 {
		return echo.NewHTTPError(http.StatusConflict, "Handle already taken")
	}

	_, err = h.DB.Exec("UPDATE users SET email = $1, handle = $2, full_name = $3, updated_at = NOW() WHERE id = $4 AND tenant_id = $5", req.Email, req.Handle, req.FullName, userID, tenantID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"email":     req.Email,
		"handle":    req.Handle,
		"full_name": req.FullName,
	})
}

func (h *Handler) UpdatePassword(c echo.Context) error {
	tenantID, userID, _, err := h.getAuth(c)
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

	var user models.User
	err = h.DB.Get(&user, "SELECT * FROM users WHERE id = $1 AND tenant_id = $2", userID, tenantID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "User not found")
	}

	// Verify current password (with bypass for local seed users if needed)
	if user.PasswordHash == "$2a$10$uRqdKxM/8fX8699hKj7qUeM7j052uF7c.jE.m574J2yqX0eE8d89O" || user.PasswordHash == "hashedpassword" {
		if req.CurrentPassword != "password" && req.CurrentPassword != "admin" {
			return echo.NewHTTPError(http.StatusUnauthorized, "Invalid current password")
		}
	} else {
		err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.CurrentPassword))
		if err != nil {
			return echo.NewHTTPError(http.StatusUnauthorized, "Invalid current password")
		}
	}

	bytes, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), 10)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to hash password")
	}
	hash := string(bytes)

	_, err = h.DB.Exec("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3", hash, userID, tenantID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.NoContent(http.StatusOK)
}

// -------------------------------------------------------------------------
// Projects Handlers
// -------------------------------------------------------------------------

func (h *Handler) GetProjects(c echo.Context) error {
	tenantID, _, _, err := h.getAuth(c)
	if err != nil {
		return err
	}
	var projects []models.Project
	err = h.DB.Select(&projects, "SELECT * FROM projects WHERE tenant_id = $1 ORDER BY created_at DESC", tenantID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if projects == nil {
		projects = []models.Project{}
	}
	return c.JSON(http.StatusOK, projects)
}

func (h *Handler) CreateProject(c echo.Context) error {
	tenantID, userID, _, err := h.getAuth(c)
	if err != nil {
		return err
	}

	req := new(models.Project)
	if err := c.Bind(req); err != nil {
		return err
	}
	if err := c.Validate(req); err != nil {
		return err
	}

	query := `
		INSERT INTO projects (tenant_id, name, description, created_by, updated_by)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING *
	`
	var project models.Project
	err = h.DB.Get(&project, query, tenantID, req.Name, req.Description, userID, userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	// Seed default system prompt and evaluation prompt on project creation
	defaultSysPromptQuery := `
		INSERT INTO system_prompts (project_id, content, version, created_by)
		VALUES ($1, 'You are a helpful assistant.', 1, $2)
	`
	_, _ = h.DB.Exec(defaultSysPromptQuery, project.ID, userID)

	defaultEvalPromptQuery := `
		INSERT INTO evaluation_prompts (project_id, content, version, created_by)
		VALUES ($1, 'Rate the match on a continuous scale from 0.0 to 1.0 in 0.1 increments:
- 0.0: completely wrong or irrelevant
- 0.1: almost entirely wrong with one barely recognizable element
- 0.2: mostly wrong with a few correct fragments
- 0.3: incorrect overall but contains some relevant points
- 0.4: below average; more wrong than right but heading in the right direction
- 0.5: partially correct; hits some key elements but misses others
- 0.6: slightly above average; mostly correct with notable gaps
- 0.7: good; covers most key points with minor inaccuracies
- 0.8: very good; nearly complete with only slight omissions
- 0.9: excellent; almost identical in meaning, facts, and tone
- 1.0: perfect; identical in meaning, facts, and tone

Use the full range.', 1, $2)
	`
	_, _ = h.DB.Exec(defaultEvalPromptQuery, project.ID, userID)

	return c.JSON(http.StatusCreated, project)
}

func (h *Handler) GetProject(c echo.Context) error {
	tenantID, _, _, err := h.getAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}

	var project models.Project
	err = h.DB.Get(&project, "SELECT * FROM projects WHERE id = $1 AND tenant_id = $2", projectID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return echo.NewHTTPError(http.StatusNotFound, "Project not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, project)
}

func (h *Handler) UpdateProject(c echo.Context) error {
	tenantID, userID, _, err := h.getAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}

	req := new(models.Project)
	if err := c.Bind(req); err != nil {
		return err
	}
	if err := c.Validate(req); err != nil {
		return err
	}

	query := `
		UPDATE projects SET name = $1, description = $2, updated_by = $3, updated_at = $4
		WHERE id = $5 AND tenant_id = $6
		RETURNING *
	`
	var project models.Project
	err = h.DB.Get(&project, query, req.Name, req.Description, userID, time.Now(), projectID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return echo.NewHTTPError(http.StatusNotFound, "Project not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, project)
}

// -------------------------------------------------------------------------
// System Prompts Handlers
// -------------------------------------------------------------------------

func (h *Handler) GetSystemPrompts(c echo.Context) error {
	_, _, _, err := h.getAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}

	var prompts []models.SystemPrompt
	err = h.DB.Select(&prompts, "SELECT * FROM system_prompts WHERE project_id = $1 ORDER BY version DESC", projectID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if prompts == nil {
		prompts = []models.SystemPrompt{}
	}
	return c.JSON(http.StatusOK, prompts)
}

func (h *Handler) CreateSystemPrompt(c echo.Context) error {
	_, userID, _, err := h.getAuth(c)
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

	var maxVersion int
	err = h.DB.Get(&maxVersion, "SELECT COALESCE(MAX(version), 0) FROM system_prompts WHERE project_id = $1", projectID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	query := `
		INSERT INTO system_prompts (project_id, content, version, created_by)
		VALUES ($1, $2, $3, $4)
		RETURNING *
	`
	var prompt models.SystemPrompt
	err = h.DB.Get(&prompt, query, projectID, req.Content, maxVersion+1, userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, prompt)
}

func (h *Handler) UpdateSystemPrompt(c echo.Context) error {
	_, _, _, err := h.getAuth(c)
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

	query := `
		UPDATE system_prompts SET content = $1
		WHERE id = $2 AND project_id = $3
		RETURNING *
	`
	var prompt models.SystemPrompt
	err = h.DB.Get(&prompt, query, req.Content, promptID, projectID)
	if err != nil {
		if err == sql.ErrNoRows {
			return echo.NewHTTPError(http.StatusNotFound, "System prompt not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, prompt)
}

// -------------------------------------------------------------------------
// Evaluation Prompts Handlers
// -------------------------------------------------------------------------

func (h *Handler) GetEvaluationPrompts(c echo.Context) error {
	_, _, _, err := h.getAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}

	var prompts []models.EvaluationPrompt
	err = h.DB.Select(&prompts, "SELECT * FROM evaluation_prompts WHERE project_id = $1 ORDER BY version DESC", projectID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if prompts == nil {
		prompts = []models.EvaluationPrompt{}
	}
	return c.JSON(http.StatusOK, prompts)
}

func (h *Handler) CreateEvaluationPrompt(c echo.Context) error {
	_, userID, _, err := h.getAuth(c)
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

	var maxVersion int
	err = h.DB.Get(&maxVersion, "SELECT COALESCE(MAX(version), 0) FROM evaluation_prompts WHERE project_id = $1", projectID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	query := `
		INSERT INTO evaluation_prompts (project_id, content, version, created_by)
		VALUES ($1, $2, $3, $4)
		RETURNING *
	`
	var prompt models.EvaluationPrompt
	err = h.DB.Get(&prompt, query, projectID, req.Content, maxVersion+1, userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, prompt)
}

func (h *Handler) UpdateEvaluationPrompt(c echo.Context) error {
	_, _, _, err := h.getAuth(c)
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

	query := `
		UPDATE evaluation_prompts SET content = $1
		WHERE id = $2 AND project_id = $3
		RETURNING *
	`
	var prompt models.EvaluationPrompt
	err = h.DB.Get(&prompt, query, req.Content, promptID, projectID)
	if err != nil {
		if err == sql.ErrNoRows {
			return echo.NewHTTPError(http.StatusNotFound, "Evaluation prompt not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, prompt)
}

// -------------------------------------------------------------------------
// Test Cases Handlers
// -------------------------------------------------------------------------

func (h *Handler) GetTestCases(c echo.Context) error {
	_, _, _, err := h.getAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}

	var testCases []models.TestCase
	err = h.DB.Select(&testCases, "SELECT * FROM test_cases WHERE project_id = $1 ORDER BY created_at DESC", projectID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if testCases == nil {
		testCases = []models.TestCase{}
	}
	return c.JSON(http.StatusOK, testCases)
}

func (h *Handler) CreateTestCase(c echo.Context) error {
	_, userID, _, err := h.getAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}

	req := new(models.TestCase)
	if err := c.Bind(req); err != nil {
		return err
	}
	if err := c.Validate(req); err != nil {
		return err
	}

	query := `
		INSERT INTO test_cases (project_id, input_prompt, expected_output, created_by, updated_by)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING *
	`
	var tc models.TestCase
	err = h.DB.Get(&tc, query, projectID, req.InputPrompt, req.ExpectedOutput, userID, userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, tc)
}

func (h *Handler) UpdateTestCase(c echo.Context) error {
	_, userID, _, err := h.getAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}
	tcID, err := uuid.Parse(c.Param("tc_id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid test case ID")
	}

	req := new(models.TestCase)
	if err := c.Bind(req); err != nil {
		return err
	}
	if err := c.Validate(req); err != nil {
		return err
	}

	query := `
		UPDATE test_cases 
		SET input_prompt = $1, expected_output = $2, updated_by = $3, updated_at = $4 
		WHERE id = $5 AND project_id = $6
		RETURNING *
	`
	var tc models.TestCase
	err = h.DB.Get(&tc, query, req.InputPrompt, req.ExpectedOutput, userID, time.Now(), tcID, projectID)
	if err != nil {
		if err == sql.ErrNoRows {
			return echo.NewHTTPError(http.StatusNotFound, "Test case not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, tc)
}

func (h *Handler) DeleteTestCase(c echo.Context) error {
	_, _, _, err := h.getAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}
	tcID, err := uuid.Parse(c.Param("tc_id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid test case ID")
	}

	_, err = h.DB.Exec("DELETE FROM test_cases WHERE id = $1 AND project_id = $2", tcID, projectID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.NoContent(http.StatusNoContent)
}

// -------------------------------------------------------------------------
// Providers (BYOK) Handlers — tenant-scoped (global, reusable across projects)
// -------------------------------------------------------------------------

func (h *Handler) GetProviders(c echo.Context) error {
	tenantID, _, _, err := h.getAuth(c)
	if err != nil {
		return err
	}

	var providers []models.ProviderConfig
	err = h.DB.Select(&providers, "SELECT * FROM provider_configs WHERE tenant_id = $1 ORDER BY created_at DESC", tenantID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if providers == nil {
		providers = []models.ProviderConfig{}
	}
	return c.JSON(http.StatusOK, providers)
}

func (h *Handler) CreateProvider(c echo.Context) error {
	tenantID, userID, _, err := h.getAuth(c)
	if err != nil {
		return err
	}

	req := new(models.ProviderConfig)
	if err := c.Bind(req); err != nil {
		return err
	}
	if err := c.Validate(req); err != nil {
		return err
	}

	query := `
		INSERT INTO provider_configs (tenant_id, name, base_url, api_key, custom_headers, created_by, updated_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING *
	`
	var provider models.ProviderConfig
	err = h.DB.Get(&provider, query, tenantID, req.Name, req.BaseURL, req.APIKey, req.CustomHeaders, userID, userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, provider)
}

func (h *Handler) UpdateProvider(c echo.Context) error {
	tenantID, userID, _, err := h.getAuth(c)
	if err != nil {
		return err
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

	query := `
		UPDATE provider_configs
		SET name = $1, base_url = $2, api_key = $3, custom_headers = $4, updated_by = $5, updated_at = $6
		WHERE id = $7 AND tenant_id = $8
		RETURNING *
	`
	var provider models.ProviderConfig
	err = h.DB.Get(&provider, query, req.Name, req.BaseURL, req.APIKey, req.CustomHeaders, userID, time.Now(), providerID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return echo.NewHTTPError(http.StatusNotFound, "Provider not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, provider)
}

func (h *Handler) DeleteProvider(c echo.Context) error {
	tenantID, _, _, err := h.getAuth(c)
	if err != nil {
		return err
	}
	providerID, err := uuid.Parse(c.Param("provider_id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid provider ID")
	}

	_, err = h.DB.Exec("DELETE FROM provider_configs WHERE id = $1 AND tenant_id = $2", providerID, tenantID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.NoContent(http.StatusNoContent)
}

// -------------------------------------------------------------------------
// Evaluations Handlers
// -------------------------------------------------------------------------

type DetailedResult struct {
	models.EvaluationResult
	InputPrompt    string `db:"input_prompt" json:"input_prompt"`
	ExpectedOutput string `db:"expected_output" json:"expected_output"`
}

type RunDetailsResponse struct {
	models.EvaluationRun
	Results []DetailedResult `json:"results"`
}

func (h *Handler) GetEvaluations(c echo.Context) error {
	_, _, _, err := h.getAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}

	var runs []models.EvaluationRun
	err = h.DB.Select(&runs, "SELECT * FROM evaluation_runs WHERE project_id = $1 ORDER BY created_at DESC", projectID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if runs == nil {
		runs = []models.EvaluationRun{}
	}
	return c.JSON(http.StatusOK, runs)
}

func (h *Handler) CreateEvaluation(c echo.Context) error {
	_, userID, _, err := h.getAuth(c)
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

	query := `
		INSERT INTO evaluation_runs (
			project_id, system_prompt_id, evaluation_prompt_id,
			target_provider_id, target_model, evaluator_provider_id,
			evaluator_model, model_used, status, pass_threshold, run_by, blacklisted_test_case_ids, blacklisted_tool_ids, enable_memory
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $7, 'pending', $8, $9, $10, $11, $12)
		RETURNING *
	`
	var run models.EvaluationRun
	err = h.DB.Get(&run, query,
		projectID, req.SystemPromptID, req.EvaluationPromptID,
		req.TargetProviderID, req.TargetModel, req.EvaluatorProviderID,
		req.EvaluatorModel, req.PassThreshold, userID, req.BlacklistedTestCaseIDs, req.BlacklistedToolIDs, req.EnableMemory,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	// Pipeline will be picked up by background worker pool

	return c.JSON(http.StatusAccepted, run)
}

func (h *Handler) CancelEvaluation(c echo.Context) error {
	_, _, _, err := h.getAuth(c)
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

	// 1. Update database state if it's currently pending or running
	res, err := h.DB.Exec(`
		UPDATE evaluation_runs 
		SET status = 'cancelled', failure_reason = 'Cancelled by user', completed_at = NOW() 
		WHERE id = $1 AND project_id = $2 AND status IN ('pending', 'running')
	`, runID, projectID)
	
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	if rowsAffected == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "Run not found or cannot be cancelled")
	}

	// 2. Abort active execution context if running in this instance
	worker.CancelRun(runID)

	return c.NoContent(http.StatusOK)
}

func (h *Handler) GetEvaluationDetails(c echo.Context) error {
	_, _, _, err := h.getAuth(c)
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

	var run models.EvaluationRun
	err = h.DB.Get(&run, "SELECT * FROM evaluation_runs WHERE id = $1 AND project_id = $2", runID, projectID)
	if err != nil {
		if err == sql.ErrNoRows {
			return echo.NewHTTPError(http.StatusNotFound, "Evaluation run not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	var results []DetailedResult
	resultQuery := `
		SELECT 
			er.id, er.run_id, er.test_case_id, er.generated_output, er.score, 
			er.is_passed, er.evaluator_reasoning, er.tools_called, er.trace, er.created_at,
			tc.input_prompt, tc.expected_output
		FROM evaluation_results er 
		JOIN test_cases tc ON er.test_case_id = tc.id 
		WHERE er.run_id = $1 
		ORDER BY er.created_at ASC
	`
	err = h.DB.Select(&results, resultQuery, runID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if results == nil {
		results = []DetailedResult{}
	}


	resp := RunDetailsResponse{
		EvaluationRun: run,
		Results:       results,
	}

	return c.JSON(http.StatusOK, resp)
}

func (h *Handler) DeleteEvaluation(c echo.Context) error {
	_, _, _, err := h.getAuth(c)
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

	// evaluation_results cascade-delete via ON DELETE CASCADE on run_id
	_, err = h.DB.Exec(
		"DELETE FROM evaluation_runs WHERE id = $1 AND project_id = $2",
		runID, projectID,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.NoContent(http.StatusNoContent)
}

// -------------------------------------------------------------------------
// Tools Handlers
// -------------------------------------------------------------------------

func (h *Handler) GetTools(c echo.Context) error {
	tenantID, _, _, err := h.getAuth(c)
	if err != nil {
		return err
	}

	var tools []models.Tool
	err = h.DB.Select(&tools, "SELECT * FROM tools WHERE tenant_id = $1 ORDER BY name ASC", tenantID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if tools == nil {
		tools = []models.Tool{}
	}
	return c.JSON(http.StatusOK, tools)
}

func (h *Handler) CreateTool(c echo.Context) error {
	tenantID, userID, _, err := h.getAuth(c)
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

	query := `
		INSERT INTO tools (tenant_id, name, description, result, created_by, updated_by)
		VALUES ($1, $2, $3, $4, $5, $5)
		RETURNING *
	`
	var tool models.Tool
	err = h.DB.Get(&tool, query, tenantID, req.Name, req.Description, req.Result, userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, tool)
}

func (h *Handler) UpdateTool(c echo.Context) error {
	tenantID, userID, _, err := h.getAuth(c)
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

	query := `
		UPDATE tools
		SET name = $1, description = $2, result = $3, updated_by = $4, updated_at = $5
		WHERE id = $6 AND tenant_id = $7
		RETURNING *
	`
	var tool models.Tool
	err = h.DB.Get(&tool, query, req.Name, req.Description, req.Result, userID, time.Now(), toolID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return echo.NewHTTPError(http.StatusNotFound, "Tool not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, tool)
}

func (h *Handler) DeleteTool(c echo.Context) error {
	tenantID, _, _, err := h.getAuth(c)
	if err != nil {
		return err
	}
	toolID, err := uuid.Parse(c.Param("tool_id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid tool ID")
	}

	_, err = h.DB.Exec("DELETE FROM tools WHERE id = $1 AND tenant_id = $2", toolID, tenantID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.NoContent(http.StatusNoContent)
}

// -------------------------------------------------------------------------
// Project Tools Handlers
// -------------------------------------------------------------------------

func (h *Handler) GetProjectTools(c echo.Context) error {
	_, _, _, err := h.getAuth(c)
	if err != nil {
		return err
	}
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid project ID")
	}

	var tools []models.Tool
	query := `
		SELECT t.* FROM tools t
		JOIN project_tools pt ON t.id = pt.tool_id
		WHERE pt.project_id = $1
		ORDER BY t.name ASC
	`
	err = h.DB.Select(&tools, query, projectID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if tools == nil {
		tools = []models.Tool{}
	}
	return c.JSON(http.StatusOK, tools)
}

type UpdateProjectToolsReq struct {
	ToolIDs []uuid.UUID `json:"tool_ids"`
}

func (h *Handler) UpdateProjectTools(c echo.Context) error {
	_, _, _, err := h.getAuth(c)
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

	tx, err := h.DB.Beginx()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	defer tx.Rollback()

	_, err = tx.Exec("DELETE FROM project_tools WHERE project_id = $1", projectID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	for _, toolID := range req.ToolIDs {
		_, err = tx.Exec("INSERT INTO project_tools (project_id, tool_id) VALUES ($1, $2)", projectID, toolID)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
		}
	}

	if err := tx.Commit(); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return h.GetProjectTools(c)
}

