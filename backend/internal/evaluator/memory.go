package evaluator

import "time"

type EvaluationMemory struct {
	Version             int
	ConversationHistory []MemoryEntry
	GeneratedOutputs    []OutputRecord
	Evaluations         []EvaluationRecord
	Notes               map[string]interface{}
}

type MemoryEntry struct {
	Role    string
	Content string
	Time    time.Time
}

type OutputRecord struct {
	TestCaseID string
	Output     string
	Timestamp  time.Time
}

type EvaluationRecord struct {
	TestCaseID string
	Score      float64
	Reasoning  string
	Timestamp  time.Time
}