package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
)

type Tenant struct {
	ID           uuid.UUID  `db:"id" json:"id"`
	Name         string     `db:"name" json:"name"`
	MasterUserID *uuid.UUID `db:"master_user_id" json:"master_user_id"`
	CreatedAt    time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time  `db:"updated_at" json:"updated_at"`
}

type User struct {
	ID           uuid.UUID `db:"id" json:"id"`
	TenantID     uuid.UUID `db:"tenant_id" json:"tenant_id"`
	Email        string    `db:"email" json:"email"`
	Handle       string    `db:"handle" json:"handle"`
	FullName     string    `db:"full_name" json:"full_name"`
	PasswordHash string    `db:"password_hash" json:"-"`
	AccessRole   int       `db:"access_role" json:"access_role"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time `db:"updated_at" json:"updated_at"`
}

type Project struct {
	ID          uuid.UUID `db:"id" json:"id"`
	TenantID    uuid.UUID `db:"tenant_id" json:"tenant_id"`
	Name        string    `db:"name" json:"name" validate:"required"`
	Description string    `db:"description" json:"description"`
	CreatedBy   uuid.UUID `db:"created_by" json:"created_by"`
	UpdatedBy   uuid.UUID `db:"updated_by" json:"updated_by"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

type SystemPrompt struct {
	ID        uuid.UUID `db:"id" json:"id"`
	ProjectID uuid.UUID `db:"project_id" json:"project_id"`
	Content   string    `db:"content" json:"content" validate:"required"`
	Version   int       `db:"version" json:"version"`
	CreatedBy uuid.UUID `db:"created_by" json:"created_by"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

type EvaluationPrompt struct {
	ID        uuid.UUID `db:"id" json:"id"`
	ProjectID uuid.UUID `db:"project_id" json:"project_id"`
	Content   string    `db:"content" json:"content" validate:"required"`
	Version   int       `db:"version" json:"version"`
	CreatedBy uuid.UUID `db:"created_by" json:"created_by"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

type TestCase struct {
	ID             uuid.UUID `db:"id" json:"id"`
	ProjectID      uuid.UUID `db:"project_id" json:"project_id"`
	InputPrompt    string    `db:"input_prompt" json:"input_prompt" validate:"required"`
	ExpectedOutput string    `db:"expected_output" json:"expected_output" validate:"required"`
	ExpectedFormat string    `db:"expected_format" json:"expected_format"`
	CreatedBy      uuid.UUID `db:"created_by" json:"created_by"`
	UpdatedBy      uuid.UUID `db:"updated_by" json:"updated_by"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time `db:"updated_at" json:"updated_at"`
}

// Headers maps string keys to string values for JSONB database storage
type Headers map[string]string

// Value implements the driver.Valuer interface
func (h Headers) Value() (driver.Value, error) {
	if h == nil {
		return []byte("{}"), nil
	}
	return json.Marshal(h)
}

// Scan implements the sql.Scanner interface
func (h *Headers) Scan(value interface{}) error {
	if value == nil {
		*h = make(Headers)
		return nil
	}
	b, ok := value.([]byte)
	if !ok {
		return errors.New("type assertion to []byte failed")
	}
	return json.Unmarshal(b, h)
}

// StringArray is a []string stored as a JSONB array.
type StringArray []string

// Value implements the driver.Valuer interface
func (s StringArray) Value() (driver.Value, error) {
	if s == nil {
		return []byte("[]"), nil
	}
	return json.Marshal(s)
}

// Scan implements the sql.Scanner interface
func (s *StringArray) Scan(value interface{}) error {
	if value == nil {
		*s = StringArray{}
		return nil
	}
	b, ok := value.([]byte)
	if !ok {
		return errors.New("type assertion to []byte failed")
	}
	return json.Unmarshal(b, s)
}

// TraceStep represents a single step in the evaluation execution trace
type TraceStep struct {
	StepType         string                 `json:"step_type"` // e.g., "user_input", "ai_tool_call", "tool_result", "ai_answer"
	Content          string                 `json:"content,omitempty"`
	ToolCalls        []map[string]interface{} `json:"tool_calls,omitempty"` // For ai_tool_call
	ToolName         string                 `json:"tool_name,omitempty"` // For tool_result
	PromptTokens     int                    `json:"prompt_tokens,omitempty"`
	CompletionTokens int                    `json:"completion_tokens,omitempty"`
	TotalTokens      int                    `json:"total_tokens,omitempty"`
}

// TraceArray is a []TraceStep stored as a JSONB array.
type TraceArray []TraceStep

// Value implements the driver.Valuer interface
func (t TraceArray) Value() (driver.Value, error) {
	if t == nil {
		return []byte("[]"), nil
	}
	return json.Marshal(t)
}

// Scan implements the sql.Scanner interface
func (t *TraceArray) Scan(value interface{}) error {
	if value == nil {
		*t = TraceArray{}
		return nil
	}
	b, ok := value.([]byte)
	if !ok {
		return errors.New("type assertion to []byte failed")
	}
	return json.Unmarshal(b, t)
}

type Tool struct {
	ID          uuid.UUID `db:"id" json:"id"`
	TenantID    uuid.UUID `db:"tenant_id" json:"tenant_id"`
	Name        string    `db:"name" json:"name" validate:"required"`
	Description string    `db:"description" json:"description" validate:"required"`
	Result      string    `db:"result" json:"result" validate:"required"`
	CreatedBy   uuid.UUID `db:"created_by" json:"created_by"`
	UpdatedBy   uuid.UUID `db:"updated_by" json:"updated_by"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

type ProjectTool struct {
	ProjectID uuid.UUID `db:"project_id" json:"project_id"`
	ToolID    uuid.UUID `db:"tool_id" json:"tool_id"`
}

type ProviderConfig struct {
	ID            uuid.UUID `db:"id" json:"id"`
	TenantID      uuid.UUID `db:"tenant_id" json:"tenant_id"`
	Name          string    `db:"name" json:"name" validate:"required"`
	BaseURL       string    `db:"base_url" json:"base_url" validate:"required,url"`
	APIKey        string    `db:"api_key" json:"api_key"`
	CustomHeaders Headers   `db:"custom_headers" json:"custom_headers"`
	CreatedBy     uuid.UUID `db:"created_by" json:"created_by"`
	UpdatedBy     uuid.UUID `db:"updated_by" json:"updated_by"`
	CreatedAt     time.Time `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time `db:"updated_at" json:"updated_at"`
}

type EvaluationRun struct {
	ID                     uuid.UUID   `db:"id" json:"id"`
	ProjectID              uuid.UUID   `db:"project_id" json:"project_id"`
	SystemPromptID         uuid.UUID   `db:"system_prompt_id" json:"system_prompt_id" validate:"required"`
	EvaluationPromptID     uuid.UUID   `db:"evaluation_prompt_id" json:"evaluation_prompt_id" validate:"required"`
	TargetProviderID       uuid.UUID   `db:"target_provider_id" json:"target_provider_id" validate:"required"`
	TargetModel            string      `db:"target_model" json:"target_model" validate:"required"`
	EvaluatorProviderID    uuid.UUID   `db:"evaluator_provider_id" json:"evaluator_provider_id" validate:"required"`
	EvaluatorModel         string      `db:"evaluator_model" json:"evaluator_model" validate:"required"`
	ModelUsed              string      `db:"model_used" json:"model_used"`
	Status                 string      `db:"status" json:"status"`
	PassThreshold          float64     `db:"pass_threshold" json:"pass_threshold" validate:"required,gte=0,lte=1"`
	IsPassed               *bool       `db:"is_passed" json:"is_passed"`
	AverageScore           *float64    `db:"average_score" json:"average_score"`
	FailureReason          *string     `db:"failure_reason" json:"failure_reason"`
	BlacklistedTestCaseIDs StringArray `db:"blacklisted_test_case_ids" json:"blacklisted_test_case_ids"`
	BlacklistedToolIDs     StringArray `db:"blacklisted_tool_ids" json:"blacklisted_tool_ids"`
	EnableMemory           bool        `db:"enable_memory" json:"enable_memory"`
	RunBy                  uuid.UUID   `db:"run_by" json:"run_by"`
	CreatedAt              time.Time   `db:"created_at" json:"created_at"`
	CompletedAt            *time.Time  `db:"completed_at" json:"completed_at"`
}

type EvaluationResult struct {
	ID              uuid.UUID   `db:"id" json:"id"`
	RunID           uuid.UUID   `db:"run_id" json:"run_id"`
	TestCaseID      uuid.UUID   `db:"test_case_id" json:"test_case_id"`
	GeneratedOutput *string     `db:"generated_output" json:"generated_output"`
	Score           *float64    `db:"score" json:"score"`
	IsPassed        *bool       `db:"is_passed" json:"is_passed"`
	EvaluatorReason *string     `db:"evaluator_reasoning" json:"evaluator_reasoning"`
	ToolsCalled     StringArray `db:"tools_called" json:"tools_called"`
	Trace           TraceArray  `db:"trace" json:"trace"`
	CreatedAt       time.Time   `db:"created_at" json:"created_at"`
}

// RubricDraft represents an auto-refinement session for generating an evaluation prompt
type RubricDraft struct {
	ID                 uuid.UUID  `db:"id" json:"id"`
	ProjectID          uuid.UUID  `db:"project_id" json:"project_id"`
	Status             string           `db:"status" json:"status"`
	DraftContent       *string          `db:"draft_content" json:"draft_content"`
	FailureReason      *string          `db:"failure_reason" json:"failure_reason"`
	Payload            *json.RawMessage `db:"payload" json:"payload"`
	SourceRunID        *uuid.UUID       `db:"source_run_id" json:"source_run_id"`
	BasePromptID       *uuid.UUID       `db:"base_prompt_id" json:"base_prompt_id"`
	BasePromptVersion  *int             `db:"base_prompt_version" json:"base_prompt_version"`
	ResultsAnalyzed    *int             `db:"results_analyzed" json:"results_analyzed"`
	CreatedBy          *uuid.UUID       `db:"created_by" json:"created_by"`
	CreatedAt          time.Time        `db:"created_at" json:"created_at"`
	CompletedAt        *time.Time       `db:"completed_at" json:"completed_at"`
}

// LLMModel represents a saved LLM model configuration bound to a provider
type LLMModel struct {
	ID         uuid.UUID `db:"id" json:"id"`
	TenantID   uuid.UUID `db:"tenant_id" json:"tenant_id"`
	ProviderID uuid.UUID `db:"provider_id" json:"provider_id" validate:"required"`
	Title      string    `db:"title" json:"title" validate:"required"`
	Model      string    `db:"model" json:"model" validate:"required"`
	CreatedBy  uuid.UUID `db:"created_by" json:"created_by"`
	UpdatedBy  uuid.UUID `db:"updated_by" json:"updated_by"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
	UpdatedAt  time.Time `db:"updated_at" json:"updated_at"`
}
