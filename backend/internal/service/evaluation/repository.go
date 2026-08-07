package evaluation

import (
	"context"
	"time"

	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type DetailedResult struct {
	ID                 uuid.UUID          `db:"id" json:"id"`
	RunID              uuid.UUID          `db:"run_id" json:"run_id"`
	TestCaseID         uuid.UUID          `db:"test_case_id" json:"test_case_id"`
	GeneratedOutput    *string            `db:"generated_output" json:"generated_output"`
	Score              *float64           `db:"score" json:"score"`
	IsPassed           *bool              `db:"is_passed" json:"is_passed"`
	EvaluatorReasoning *string            `db:"evaluator_reasoning" json:"evaluator_reasoning"`
	ToolsCalled        models.StringArray `db:"tools_called" json:"tools_called"`
	Trace              models.TraceArray  `db:"trace" json:"trace"`
	CreatedAt          time.Time          `db:"created_at" json:"created_at"`

	InputPrompt    string `db:"input_prompt" json:"input_prompt"`
	ExpectedOutput string `db:"expected_output" json:"expected_output"`
	ExpectedFormat string `db:"expected_format" json:"expected_format"`
}

type RunDetailsResponse struct {
	models.EvaluationRun
	Results []DetailedResult `json:"results"`
}

type ModelPerformanceSummary struct {
	Model        string  `db:"model" json:"model"`
	Runs         int     `db:"runs" json:"runs"`
	AverageScore float64 `db:"average_score" json:"averageScore"`
	BestScore    float64 `db:"best_score" json:"bestScore"`
	WorstScore   float64 `db:"worst_score" json:"worstScore"`
}

type Repository interface {
	GetEvaluations(ctx context.Context, projectID uuid.UUID) ([]models.EvaluationRun, error)
	CreateEvaluation(ctx context.Context, req models.EvaluationRun, projectID, userID uuid.UUID) (*models.EvaluationRun, error)
	CancelEvaluation(ctx context.Context, runID, projectID uuid.UUID) (bool, error)
	GetEvaluationDetails(ctx context.Context, runID, projectID uuid.UUID) (*RunDetailsResponse, error)
	DeleteEvaluation(ctx context.Context, runID, projectID uuid.UUID) error
	GetModelPerformanceSummary(ctx context.Context, projectID uuid.UUID) ([]ModelPerformanceSummary, error)

	// Evaluation Config Presets
	GetConfigs(ctx context.Context, projectID uuid.UUID) ([]models.EvaluationConfig, error)
	GetConfigByID(ctx context.Context, configID, projectID uuid.UUID) (*models.EvaluationConfig, error)
	CreateConfig(ctx context.Context, req models.EvaluationConfig, projectID, userID uuid.UUID) (*models.EvaluationConfig, error)
	UpdateConfig(ctx context.Context, req models.EvaluationConfig, configID, projectID, userID uuid.UUID) (*models.EvaluationConfig, error)
	DeleteConfig(ctx context.Context, configID, projectID uuid.UUID) error
}

type repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) Repository {
	return &repository{db: db}
}

func (r *repository) GetEvaluations(ctx context.Context, projectID uuid.UUID) ([]models.EvaluationRun, error) {
	var runs []models.EvaluationRun
	err := r.db.SelectContext(ctx, &runs, "SELECT * FROM evaluation_runs WHERE project_id = $1 ORDER BY created_at DESC", projectID)
	if err != nil {
		return nil, err
	}
	if runs == nil {
		runs = []models.EvaluationRun{}
	}
	return runs, nil
}

func (r *repository) GetModelPerformanceSummary(ctx context.Context, projectID uuid.UUID) ([]ModelPerformanceSummary, error) {
	var summary []ModelPerformanceSummary
	query := `
		SELECT 
			model_used as model, 
			COUNT(id) as runs, 
			AVG(average_score) as average_score, 
			MAX(average_score) as best_score, 
			MIN(average_score) as worst_score 
		FROM evaluation_runs 
		WHERE project_id = $1 AND status = 'completed' AND average_score IS NOT NULL 
		GROUP BY model_used 
		ORDER BY average_score DESC
	`
	err := r.db.SelectContext(ctx, &summary, query, projectID)
	if err != nil {
		return nil, err
	}
	if summary == nil {
		summary = []ModelPerformanceSummary{}
	}
	return summary, nil
}

func (r *repository) CreateEvaluation(ctx context.Context, req models.EvaluationRun, projectID, userID uuid.UUID) (*models.EvaluationRun, error) {
	query := `
		INSERT INTO evaluation_runs (
			project_id, config_id, system_prompt_id, evaluation_prompt_id,
			target_provider_id, target_model, evaluator_provider_id,
			evaluator_model, model_used, status, pass_threshold, run_by, blacklisted_test_case_ids, blacklisted_tool_ids, enable_memory, advanced_settings
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $6, 'pending', $9, $10, $11, $12, $13, $14)
		RETURNING *
	`
	var run models.EvaluationRun
	err := r.db.GetContext(ctx, &run, query,
		projectID, req.ConfigID, req.SystemPromptID, req.EvaluationPromptID,
		req.TargetProviderID, req.TargetModel, req.EvaluatorProviderID,
		req.EvaluatorModel, req.PassThreshold, userID, req.BlacklistedTestCaseIDs, req.BlacklistedToolIDs, req.EnableMemory, req.AdvancedSettings,
	)
	if err != nil {
		return nil, err
	}
	return &run, nil
}

func (r *repository) CancelEvaluation(ctx context.Context, runID, projectID uuid.UUID) (bool, error) {
	res, err := r.db.ExecContext(ctx, `
		UPDATE evaluation_runs 
		SET status = 'cancelled', failure_reason = 'Cancelled by user', completed_at = NOW() 
		WHERE id = $1 AND project_id = $2 AND status IN ('pending', 'running')
	`, runID, projectID)
	if err != nil {
		return false, err
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return false, err
	}

	return rowsAffected > 0, nil
}

func (r *repository) GetEvaluationDetails(ctx context.Context, runID, projectID uuid.UUID) (*RunDetailsResponse, error) {
	var run models.EvaluationRun
	err := r.db.GetContext(ctx, &run, "SELECT * FROM evaluation_runs WHERE id = $1 AND project_id = $2", runID, projectID)
	if err != nil {
		return nil, err
	}

	var results []DetailedResult
	resultQuery := `
		SELECT 
			er.id, er.run_id, er.test_case_id, er.generated_output, er.score, 
			er.is_passed, er.evaluator_reasoning, er.tools_called, er.trace, er.created_at,
			tc.input_prompt, tc.expected_output, tc.expected_format
		FROM evaluation_results er 
		JOIN test_cases tc ON er.test_case_id = tc.id 
		WHERE er.run_id = $1 
		ORDER BY er.created_at ASC
	`
	err = r.db.SelectContext(ctx, &results, resultQuery, runID)
	if err != nil {
		return nil, err
	}
	if results == nil {
		results = []DetailedResult{}
	}

	return &RunDetailsResponse{
		EvaluationRun: run,
		Results:       results,
	}, nil
}

func (r *repository) DeleteEvaluation(ctx context.Context, runID, projectID uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM evaluation_runs WHERE id = $1 AND project_id = $2", runID, projectID)
	return err
}

func (r *repository) GetConfigs(ctx context.Context, projectID uuid.UUID) ([]models.EvaluationConfig, error) {
	var configs []models.EvaluationConfig
	err := r.db.SelectContext(ctx, &configs, "SELECT * FROM evaluation_configs WHERE project_id = $1 ORDER BY updated_at DESC", projectID)
	if err != nil {
		return nil, err
	}
	if configs == nil {
		configs = []models.EvaluationConfig{}
	}
	return configs, nil
}

func (r *repository) GetConfigByID(ctx context.Context, configID, projectID uuid.UUID) (*models.EvaluationConfig, error) {
	var cfg models.EvaluationConfig
	err := r.db.GetContext(ctx, &cfg, "SELECT * FROM evaluation_configs WHERE id = $1 AND project_id = $2", configID, projectID)
	if err != nil {
		return nil, err
	}
	return &cfg, nil
}

func (r *repository) CreateConfig(ctx context.Context, req models.EvaluationConfig, projectID, userID uuid.UUID) (*models.EvaluationConfig, error) {
	query := `
		INSERT INTO evaluation_configs (
			project_id, name, description, system_prompt_id, evaluation_prompt_id,
			target_provider_id, target_model, evaluator_provider_id, evaluator_model,
			pass_threshold, advanced_settings, created_by, updated_by
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
		RETURNING *
	`
	var cfg models.EvaluationConfig
	err := r.db.GetContext(ctx, &cfg, query,
		projectID, req.Name, req.Description, req.SystemPromptID, req.EvaluationPromptID,
		req.TargetProviderID, req.TargetModel, req.EvaluatorProviderID, req.EvaluatorModel,
		req.PassThreshold, req.AdvancedSettings, userID,
	)
	if err != nil {
		return nil, err
	}
	return &cfg, nil
}

func (r *repository) UpdateConfig(ctx context.Context, req models.EvaluationConfig, configID, projectID, userID uuid.UUID) (*models.EvaluationConfig, error) {
	query := `
		UPDATE evaluation_configs
		SET name = $1, description = $2, system_prompt_id = $3, evaluation_prompt_id = $4,
		    target_provider_id = $5, target_model = $6, evaluator_provider_id = $7, evaluator_model = $8,
		    pass_threshold = $9, advanced_settings = $10, updated_by = $11, updated_at = NOW()
		WHERE id = $12 AND project_id = $13
		RETURNING *
	`
	var cfg models.EvaluationConfig
	err := r.db.GetContext(ctx, &cfg, query,
		req.Name, req.Description, req.SystemPromptID, req.EvaluationPromptID,
		req.TargetProviderID, req.TargetModel, req.EvaluatorProviderID, req.EvaluatorModel,
		req.PassThreshold, req.AdvancedSettings, userID, configID, projectID,
	)
	if err != nil {
		return nil, err
	}
	return &cfg, nil
}

func (r *repository) DeleteConfig(ctx context.Context, configID, projectID uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM evaluation_configs WHERE id = $1 AND project_id = $2", configID, projectID)
	return err
}
