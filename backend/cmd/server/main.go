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
	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/pkg/cache"
	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/service/auth"
	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/service/evaluation"
	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/service/llmmodel"
	authMW "github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/middleware"
	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/service/project"
	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/service/prompt"
	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/service/provider"
	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/service/rubric"
	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/service/testcase"
	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/service/tool"
	valBridge "github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/validator"
	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/service/worker"
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

	// Initialize Domain Repositories, Usecases & Handlers
	authRepo := auth.NewRepository(dbConn)
	authUsecase := auth.NewUsecase(authRepo, cfg)
	authHandler := auth.NewHandler(authUsecase, cfg)

	projectRepo := project.NewRepository(dbConn)
	projectUsecase := project.NewUsecase(projectRepo)
	projectHandler := project.NewHandler(projectUsecase, authHandler)

	promptCache := cache.NewPromptCache()
	promptRepo := prompt.NewRepository(dbConn)
	promptUsecase := prompt.NewUsecase(promptRepo, promptCache)
	promptHandler := prompt.NewHandler(promptUsecase, authHandler)

	testcaseRepo := testcase.NewRepository(dbConn)
	testcaseUsecase := testcase.NewUsecase(testcaseRepo)
	testcaseHandler := testcase.NewHandler(testcaseUsecase, authHandler)

	evalRepo := evaluation.NewRepository(dbConn)
	evalUsecase := evaluation.NewUsecase(evalRepo)
	evalHandler := evaluation.NewHandler(evalUsecase, authHandler)

	rubricRepo := rubric.NewRepository(dbConn)
	rubricUsecase := rubric.NewUsecase(rubricRepo)
	rubricHandler := rubric.NewHandler(rubricUsecase, authHandler)

	providerRepo := provider.NewRepository(dbConn)
	providerUsecase := provider.NewUsecase(providerRepo)
	providerHandler := provider.NewHandler(providerUsecase, authHandler)

	toolRepo := tool.NewRepository(dbConn)
	toolUsecase := tool.NewUsecase(toolRepo)
	toolHandler := tool.NewHandler(toolUsecase, authHandler)

	llmmodelRepo := llmmodel.NewRepository(dbConn)
	llmmodelUsecase := llmmodel.NewUsecase(llmmodelRepo)
	llmmodelHandler := llmmodel.NewHandler(llmmodelUsecase, authHandler)

	api := e.Group("/api")

	// Authentication
	authGroup := api.Group("/auth")
	authGroup.POST("/login", authHandler.Login)
	authGroup.POST("/register", authHandler.Register)

	// Multi-Tenant & Workspace Session Routes
	authGroup.POST("/tenant", authHandler.CreateTenant, authMiddleware.RequireAuth)
	authGroup.GET("/tenants", authHandler.GetMyTenants, authMiddleware.RequireAuth)
	authGroup.POST("/tenant/switch", authHandler.SwitchTenant, authMiddleware.RequireAuth)
	authGroup.GET("/tenant/users", authHandler.GetTenantUsers, authMiddleware.RequireAuth)
	authGroup.PUT("/tenant/users/:user_id/role", authHandler.UpdateTenantUserRole, authMiddleware.RequireAuth)
	authGroup.DELETE("/tenant/users/:user_id", authHandler.RemoveTenantUser, authMiddleware.RequireAuth)
	authGroup.POST("/tenant/invites", authHandler.CreateInvitation, authMiddleware.RequireAuth)
	authGroup.POST("/tenant/join", authHandler.JoinTenant, authMiddleware.RequireAuth)

	// User Settings
	userGroup := api.Group("/users/me", authMiddleware.RequireAuth)
	userGroup.PUT("/profile", authHandler.UpdateProfile)
	userGroup.PUT("/password", authHandler.UpdatePassword)
	userGroup.POST("/api-keys", authHandler.CreateAPIKey)
	userGroup.GET("/api-keys", authHandler.GetAPIKeys)
	userGroup.DELETE("/api-keys/:id", authHandler.DeleteAPIKey)

	// Projects
	projectGroup := api.Group("/projects", authMiddleware.RequireAuth)
	projectGroup.GET("", projectHandler.GetProjects)
	projectGroup.POST("", projectHandler.CreateProject)
	projectGroup.GET("/:id", projectHandler.GetProject)
	projectGroup.PUT("/:id", projectHandler.UpdateProject)

	// System Prompts
	projectGroup.GET("/:id/prompts", promptHandler.GetSystemPrompts)
	projectGroup.POST("/:id/prompts", promptHandler.CreateSystemPrompt)
	projectGroup.PUT("/:id/prompts/:prompt_id", promptHandler.UpdateSystemPrompt)
	projectGroup.POST("/:id/prompts/publish", promptHandler.PublishSystemPrompts)

	// API System Prompt
	// GET /api/v1/projects/:id/active-prompt (using authMiddleware for internal UI or API key for external clients)
	// We map it outside projectGroup to support API keys
	api.GET("/v1/projects/:id/active-prompt", promptHandler.GetActiveSystemPrompt, authHandler.APIKeyMiddleware)

	// Evaluation Prompts
	projectGroup.GET("/:id/evaluation-prompts", promptHandler.GetEvaluationPrompts)
	projectGroup.POST("/:id/evaluation-prompts", promptHandler.CreateEvaluationPrompt)
	projectGroup.PUT("/:id/evaluation-prompts/:prompt_id", promptHandler.UpdateEvaluationPrompt)

	// Test Cases
	projectGroup.GET("/:id/test-cases", testcaseHandler.GetTestCases)
	projectGroup.POST(":id/test-cases", testcaseHandler.CreateTestCase)
	projectGroup.PUT("/:id/test-cases/:tc_id", testcaseHandler.UpdateTestCase)
	projectGroup.DELETE("/:id/test-cases/:tc_id", testcaseHandler.DeleteTestCase)

	// Evaluations
	projectGroup.GET("/:id/evaluations", evalHandler.GetEvaluations)
	projectGroup.GET("/:id/evaluations-summary", evalHandler.GetEvaluationsSummary)
	projectGroup.POST("/:id/evaluations", evalHandler.CreateEvaluation)
	projectGroup.GET("/:id/evaluations/:run_id", evalHandler.GetEvaluationDetails)
	projectGroup.POST("/:id/evaluations/:run_id/cancel", evalHandler.CancelEvaluation)
	projectGroup.DELETE("/:id/evaluations/:run_id", evalHandler.DeleteEvaluation)

	// Evaluation Config Presets
	projectGroup.GET("/:id/configs", evalHandler.GetConfigs)
	projectGroup.POST("/:id/configs", evalHandler.CreateConfig)
	projectGroup.PUT("/:id/configs/:config_id", evalHandler.UpdateConfig)
	projectGroup.DELETE("/:id/configs/:config_id", evalHandler.DeleteConfig)

	// Rubric Auto-Refinement
	projectGroup.POST("/:id/evaluations/:run_id/refine-rubric", rubricHandler.RefineEvaluationPrompt)
	projectGroup.POST("/:id/calibrate-rubric", rubricHandler.CalibrateEvaluationPrompt)
	projectGroup.GET("/:id/rubric-drafts", rubricHandler.GetRubricDrafts)
	projectGroup.GET("/:id/rubric-drafts/:draft_id", rubricHandler.GetRubricDraft)
	projectGroup.POST("/:id/rubric-drafts/:draft_id/cancel", rubricHandler.CancelRubricDraft)
	projectGroup.POST("/:id/rubric-drafts/:draft_id/retry", rubricHandler.RetryRubricDraft)
	projectGroup.DELETE("/:id/rubric-drafts/:draft_id", rubricHandler.DeleteRubricDraft)

	// Providers (BYOK) — tenant-scoped (global)
	providerGroup := api.Group("/providers", authMiddleware.RequireAuth)
	providerGroup.GET("", providerHandler.GetProviders)
	providerGroup.POST("", providerHandler.CreateProvider)
	providerGroup.PUT("/:provider_id", providerHandler.UpdateProvider)
	providerGroup.DELETE("/:provider_id", providerHandler.DeleteProvider)

	// Global Tools — tenant-scoped
	toolsGroup := api.Group("/tools", authMiddleware.RequireAuth)
	toolsGroup.GET("", toolHandler.GetTools)
	toolsGroup.POST("", toolHandler.CreateTool)
	toolsGroup.PUT("/:tool_id", toolHandler.UpdateTool)
	toolsGroup.DELETE("/:tool_id", toolHandler.DeleteTool)

	// LLM Models — tenant-scoped (global)
	modelsGroup := api.Group("/models", authMiddleware.RequireAuth)
	modelsGroup.GET("", llmmodelHandler.GetLLMModels)
	modelsGroup.POST("", llmmodelHandler.CreateLLMModel)
	modelsGroup.PUT("/:model_id", llmmodelHandler.UpdateLLMModel)
	modelsGroup.DELETE("/:model_id", llmmodelHandler.DeleteLLMModel)
	modelsGroup.POST("/test", llmmodelHandler.TestLLMModel)

	// Project Tools
	projectGroup.GET("/:id/tools", toolHandler.GetProjectTools)
	projectGroup.PUT("/:id/tools", toolHandler.UpdateProjectTools)

	api.GET("/rubric-template.csv", rubricHandler.DownloadCSVTemplate)

	// Start Background Worker Pool for Evaluations
	go worker.StartEvaluationWorkers(dbConn, 3)

	// Start Server
	serverAddr := fmt.Sprintf(":%s", port)
	log.Printf("Starting API server on %s", serverAddr)
	if err := e.Start(serverAddr); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
