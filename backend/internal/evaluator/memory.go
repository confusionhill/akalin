package evaluator

import (
	"fmt"
	"time"
)

type EvaluationMemory struct {
	Version             int               `json:"version"`
	ConversationHistory []MemoryEntry     `json:"conversation_history"`
	Resume              string            `json:"resume"` // Summary of conversation for context
	GeneratedOutputs    []OutputRecord    `json:"generated_outputs"`
	Evaluations         []EvaluationRecord `json:"evaluations"`
	Notes               map[string]interface{} `json:"notes"`
}

type MemoryEntry struct {
	Role    string `json:"role"`
	Content string `json:"content"`
	Time    time.Time `json:"time"`
}

type OutputRecord struct {
	TestCaseID string    `json:"test_case_id"`
	Output     string    `json:"output"`
	Timestamp  time.Time `json:"timestamp"`
}

type EvaluationRecord struct {
	TestCaseID string    `json:"test_case_id"`
	Score      float64   `json:"score"`
	Reasoning  string    `json:"reasoning"`
	Timestamp  time.Time `json:"timestamp"`
}

func NewEvaluationMemory() *EvaluationMemory {
	return &EvaluationMemory{
		Version: 1,
		ConversationHistory: []MemoryEntry{},
		GeneratedOutputs:    []OutputRecord{},
		Evaluations:         []EvaluationRecord{},
		Notes:               make(map[string]interface{}),
	}
}

// BuildConversationHistory converts conversation entries to a formatted string
func BuildConversationHistory(entries []MemoryEntry) string {
	var history string
	for _, entry := range entries {
		role := "user"
		if entry.Role == "assistant" {
			role = "assistant"
		}
		history += fmt.Sprintf("%s: %s\n", role, entry.Content)
	}
	return history
}

// GenerateResume creates a summarized context from conversation history
func GenerateResume(conversationHistory string, currentOutput string) (string, error) {
	resumePrompt := fmt.Sprintf(`Based on the following conversation, create a concise resume (3-5 sentences) summarizing what was discussed.

Conversation:
%s

Most Recent Answer:
%s

Resume (just the summary text, no bullets or formatting):`,

		conversationHistory,
		currentOutput,
	)

	return resumePrompt, nil
}

// BuildContextPrompt combines system prompt, resume, and current user prompt
func BuildContextPrompt(systemPrompt, resume, userPrompt string) string {
	if resume == "" {
		return fmt.Sprintf("%s\n\nUser: %s", systemPrompt, userPrompt)
	}
	return fmt.Sprintf("%s\n\nPrevious Context:\n%s\n\nUser: %s",
		systemPrompt,
		resume,
		userPrompt,
	)
}