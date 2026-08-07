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
	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/worker"
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

	// Register Routes
	h := handlers.NewHandler(cfg, dbConn)

	api := e.Group("/api")

	// Authentication
	authGroup := api.Group("/auth")
	authGroup.POST("/login", h.Login)
	authGroup.POST("/register", h.Register)

	// User Settings
	userGroup := api.Group("/users/me", authMiddleware.RequireAuth)
	userGroup.PUT("/profile", h.UpdateProfile)
	userGroup.PUT("/password", h.UpdatePassword)

	// Projects
	projectGroup := api.Group("/projects", authMiddleware.RequireAuth)
	projectGroup.GET("", h.GetProjects)
	projectGroup.POST("", h.CreateProject)
	projectGroup.GET("/:id", h.GetProject)
	projectGroup.PUT("/:id", h.UpdateProject)

	// System Prompts
	projectGroup.GET("/:id/prompts", h.GetSystemPrompts)
	projectGroup.POST(":id/prompts", h.CreateSystemPrompt)
	projectGroup.PUT("/:id/prompts/:prompt_id", h.UpdateSystemPrompt)

	// Evaluation Prompts
	projectGroup.GET("/:id/evaluation-prompts", h.GetEvaluationPrompts)
	projectGroup.POST(":id/evaluation-prompts", h.CreateEvaluationPrompt)
	projectGroup.PUT("/:id/evaluation-prompts/:prompt_id", h.UpdateEvaluationPrompt)

	// Test Cases
	projectGroup.GET("/:id/test-cases", h.GetTestCases)
	projectGroup.POST(":id/test-cases", h.CreateTestCase)
	projectGroup.PUT("/:id/test-cases/:tc_id", h.UpdateTestCase)
	projectGroup.DELETE("/:id/test-cases/:tc_id", h.DeleteTestCase)

	// Evaluations
	projectGroup.GET("/:id/evaluations", h.GetEvaluations)
	projectGroup.POST("/:id/evaluations", h.CreateEvaluation)
	projectGroup.GET("/:id/evaluations/:run_id", h.GetEvaluationDetails)
	projectGroup.POST("/:id/evaluations/:run_id/cancel", h.CancelEvaluation)
	projectGroup.DELETE("/:id/evaluations/:run_id", h.DeleteEvaluation)

	// Rubric Auto-Refinement
	projectGroup.POST("/:id/evaluations/:run_id/refine-rubric", h.RefineEvaluationPrompt)
	projectGroup.POST("/:id/calibrate-rubric", h.CalibrateEvaluationPrompt)
	projectGroup.GET("/:id/rubric-drafts", h.GetRubricDrafts)
	projectGroup.GET("/:id/rubric-drafts/:draft_id", h.GetRubricDraft)
	projectGroup.POST("/:id/rubric-drafts/:draft_id/cancel", h.CancelRubricDraft)
	projectGroup.POST("/:id/rubric-drafts/:draft_id/retry", h.RetryRubricDraft)
	projectGroup.DELETE("/:id/rubric-drafts/:draft_id", h.DeleteRubricDraft)

	// Providers (BYOK) — tenant-scoped (global)
	providerGroup := api.Group("/providers", authMiddleware.RequireAuth)
	providerGroup.GET("", h.GetProviders)
	providerGroup.POST("", h.CreateProvider)
	providerGroup.PUT("/:provider_id", h.UpdateProvider)
	providerGroup.DELETE("/:provider_id", h.DeleteProvider)

	// Global Tools — tenant-scoped
	toolsGroup := api.Group("/tools", authMiddleware.RequireAuth)
	toolsGroup.GET("", h.GetTools)
	toolsGroup.POST("", h.CreateTool)
	toolsGroup.PUT("/:tool_id", h.UpdateTool)
	toolsGroup.DELETE("/:tool_id", h.DeleteTool)

	// LLM Models — tenant-scoped (global)
	modelsGroup := api.Group("/models", authMiddleware.RequireAuth)
	modelsGroup.GET("", h.GetLLMModels)
	modelsGroup.POST("", h.CreateLLMModel)
	modelsGroup.PUT("/:model_id", h.UpdateLLMModel)
	modelsGroup.DELETE("/:model_id", h.DeleteLLMModel)
	modelsGroup.POST("/test", h.TestLLMModel)

	// Project Tools
	projectGroup.GET("/:id/tools", h.GetProjectTools)
	projectGroup.PUT("/:id/tools", h.UpdateProjectTools)

	api.GET("/rubric-template.csv", h.DownloadCSVTemplate)

	// Start Background Worker Pool for Evaluations
	go worker.StartEvaluationWorkers(dbConn, 3)

	// Start Server
	serverAddr := fmt.Sprintf(":%s", port)
	log.Printf("Starting API server on %s", serverAddr)
	if err := e.Start(serverAddr); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
