package main

import (
	"fmt"
	"log"
	"os"
	"strconv"

	"github.com/go-playground/validator/v10"
	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/db"
	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/handlers"
	valBridge "github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/validator"
)

func main() {
	// Load .env file if it exists (locally)
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dbHost := os.Getenv("DB_HOST")
	if dbHost == "" {
		dbHost = "localhost"
	}

	dbPortStr := os.Getenv("DB_PORT")
	if dbPortStr == "" {
		dbPortStr = "5432"
	}
	dbPort, err := strconv.Atoi(dbPortStr)
	if err != nil {
		log.Fatalf("Invalid DB_PORT: %v", err)
	}

	dbUser := os.Getenv("DB_USER")
	if dbUser == "" {
		dbUser = "postgres"
	}

	dbPassword := os.Getenv("DB_PASSWORD")
	if dbPassword == "" {
		dbPassword = "postgres"
	}

	dbName := os.Getenv("DB_NAME")
	if dbName == "" {
		dbName = "llm_eval"
	}

	sslMode := os.Getenv("SSL_MODE")
	if sslMode == "" {
		sslMode = "disable"
	}

	// Connect to Database
	dbConn, err := db.Connect(dbHost, dbPort, dbUser, dbPassword, dbName, sslMode)
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

	// Register Routes
	h := handlers.NewHandler(dbConn)

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
