package main

import (
	"fmt"
	"log"

	"github.com/go-playground/validator/v10"
	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/config"
	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/db"
	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/handlers"
	authMW "github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/middleware"
	valBridge "github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/validator"
)

func main() {
	// Load .env file if it exists (locally)
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	cfg := config.Load()

	port := cfg.Port
	if port == "" {
		port = "8080"
	}

	// Connect to Database
	dbConn, err := db.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer dbConn.Close()

	// Initialize Echo
	e := echo.New()

	// Setup custom validation bridge
	e.Validator = &valBridge.CustomValidator{
		Validator: validator.New(),
	}

	// Middleware
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{"*"},
		AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization, "X-Tenant-ID", "X-User-ID"},
		AllowMethods: []string{echo.GET, echo.POST, echo.PUT, echo.DELETE, echo.OPTIONS},
	}))

	// Auth middleware - protects all routes except login/register
	authMiddleware := authMW.NewAuthMiddleware()
	e.Use(authMiddleware.RequireAuth)

	// Register Routes
	h := handlers.NewHandler(cfg, dbConn)

	api := e.Group("/api")

	// Authentication
	api.POST("/auth/login", h.Login)
	api.POST("/auth/register", h.Register)

	// Projects
	api.GET("/projects", h.GetProjects)
	api.POST("/projects", h.CreateProject)
	api.GET("/projects/:id", h.GetProject)
	api.PUT("/projects/:id", h.UpdateProject)

	// System Prompts
	api.GET("/projects/:id/prompts", h.GetSystemPrompts)
	api.POST("/projects/:id/prompts", h.CreateSystemPrompt)
	api.PUT("/projects/:id/prompts/:prompt_id", h.UpdateSystemPrompt)

	// Evaluation Prompts
	api.GET("/projects/:id/evaluation-prompts", h.GetEvaluationPrompts)
	api.POST("/projects/:id/evaluation-prompts", h.CreateEvaluationPrompt)
	api.PUT("/projects/:id/evaluation-prompts/:prompt_id", h.UpdateEvaluationPrompt)

	// Test Cases
	api.GET("/projects/:id/test-cases", h.GetTestCases)
	api.POST("/projects/:id/test-cases", h.CreateTestCase)
	api.PUT("/projects/:id/test-cases/:tc_id", h.UpdateTestCase)
	api.DELETE("/projects/:id/test-cases/:tc_id", h.DeleteTestCase)

	// Providers (BYOK) — tenant-scoped (global)
	api.GET("/providers", h.GetProviders)
	api.POST("/providers", h.CreateProvider)
	api.PUT("/providers/:provider_id", h.UpdateProvider)
	api.DELETE("/providers/:provider_id", h.DeleteProvider)

	// Evaluations
	api.GET("/projects/:id/evaluations", h.GetEvaluations)
	api.POST("/projects/:id/evaluations", h.CreateEvaluation)
	api.GET("/projects/:id/evaluations/:run_id", h.GetEvaluationDetails)
	api.DELETE("/projects/:id/evaluations/:run_id", h.DeleteEvaluation)

	// Start Server
	serverAddr := fmt.Sprintf(":%s", port)
	log.Printf("Starting API server on %s", serverAddr)
	if err := e.Start(serverAddr); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
