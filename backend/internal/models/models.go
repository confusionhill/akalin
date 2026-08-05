package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
)

type Tenant struct {
	ID        uuid.UUID `db:"id" json:"id"`
	Name      string    `db:"name" json:"name"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

type User struct {
	ID           uuid.UUID `db:"id" json:"id"`
	TenantID     uuid.UUID `db:"tenant_id" json:"tenant_id"`
	Email        string    `db:"email" json:"email"`
	PasswordHash string    `db:"password_hash" json:"-"`
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
	ID                  uuid.UUID  `db:"id" json:"id"`
	ProjectID           uuid.UUID  `db:"project_id" json:"project_id"`
	SystemPromptID      uuid.UUID  `db:"system_prompt_id" json:"system_prompt_id" validate:"required"`
	EvaluationPromptID  uuid.UUID  `db:"evaluation_prompt_id" json:"evaluation_prompt_id" validate:"required"`
	TargetProviderID    uuid.UUID  `db:"target_provider_id" json:"target_provider_id" validate:"required"`
	TargetModel         string     `db:"target_model" json:"target_model" validate:"required"`
	EvaluatorProviderID uuid.UUID  `db:"evaluator_provider_id" json:"evaluator_provider_id" validate:"required"`
	EvaluatorModel      string     `db:"evaluator_model" json:"evaluator_model" validate:"required"`
	Status              string     `db:"status" json:"status"`
	PassThreshold       float64    `db:"pass_threshold" json:"pass_threshold" validate:"required,gte=0,lte=1"`
	IsPassed            *bool       `db:"is_passed" json:"is_passed"`
	AverageScore        *float64    `db:"average_score" json:"average_score"`
	FailureReason       *string     `db:"failure_reason" json:"failure_reason"`
	BlacklistedTestCaseIDs StringArray `db:"blacklisted_test_case_ids" json:"blacklisted_test_case_ids"`
	RunBy               uuid.UUID   `db:"run_by" json:"run_by"`
	CreatedAt           time.Time  `db:"created_at" json:"created_at"`
	CompletedAt         *time.Time `db:"completed_at" json:"completed_at"`
}

type EvaluationResult struct {
	ID              uuid.UUID  `db:"id" json:"id"`
	RunID           uuid.UUID  `db:"run_id" json:"run_id"`
	TestCaseID      uuid.UUID  `db:"test_case_id" json:"test_case_id"`
	GeneratedOutput *string    `db:"generated_output" json:"generated_output"`
	Score           *float64   `db:"score" json:"score"`
	IsPassed        *bool      `db:"is_passed" json:"is_passed"`
	EvaluatorReason *string    `db:"evaluator_reasoning" json:"evaluator_reasoning"`
	CreatedAt       time.Time  `db:"created_at" json:"created_at"`
}
