package evaluator

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/models"
)

func RunPipeline(db *sqlx.DB, runID uuid.UUID) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	logPrefix := fmt.Sprintf("[eval run=%s]", runID.String())

	// Helper to mark run as failed
	markAsFailed := func(failErr error) {
		log.Printf("%s FAILED: %v", logPrefix, failErr)
		reason := failErr.Error()
		_, dbErr := db.Exec(
			"UPDATE evaluation_runs SET status = 'failed', failure_reason = $1, completed_at = $2 WHERE id = $3",
			reason, time.Now(), runID,
		)
		if dbErr != nil {
			log.Printf("%s failed to update status to failed: %v", logPrefix, dbErr)
		}
	}

	// 1. Update status to 'running'
	_, err := db.Exec("UPDATE evaluation_runs SET status = 'running', failure_reason = NULL WHERE id = $1", runID)
	if err != nil {
		log.Printf("%s failed to update status to running: %v", logPrefix, err)
		return
	}

	// 2. Fetch full run detail
	var run EvaluationRun
	err = db.Get(&run, "SELECT * FROM evaluation_runs WHERE id = $1", runID)
	if err != nil {
		markAsFailed(fmt.Errorf("failed to fetch run details: %w", err))
		return
	}
	log.Printf("%s config: target=%s provider=%s evaluator=%s provider=%s threshold=%.2f",
		logPrefix, run.TargetModel, run.TargetProviderID, run.EvaluatorModel, run.EvaluatorProviderID, run.PassThreshold)

	// Initialize memory if enabled
	var memory *EvaluationMemory
	if run.EnableMemory {
		memory = &EvaluationMemory{
			Version:             1,
			ConversationHistory: []MemoryEntry{},
			Resume:              "",
			GeneratedOutputs:    []OutputRecord{},
			Evaluations:         []EvaluationRecord{},
			Notes:               make(map[string]interface{}),
		}
	}

	// 3. Fetch system prompt
	var sysPrompt models.SystemPrompt
	err = db.Get(&sysPrompt, "SELECT * FROM system_prompts WHERE id = $1", run.SystemPromptID)
	if err != nil {
		markAsFailed(fmt.Errorf("failed to fetch system prompt (id=%s): %w", run.SystemPromptID, err))
		return
	}

	// 4. Fetch evaluation prompt
	var evalPrompt models.EvaluationPrompt
	err = db.Get(&evalPrompt, "SELECT * FROM evaluation_prompts WHERE id = $1", run.EvaluationPromptID)
	if err != nil {
		markAsFailed(fmt.Errorf("failed to fetch evaluation prompt (id=%s): %w", run.EvaluationPromptID, err))
		return
	}

	// 5. Fetch target provider config
	var targetProvider models.ProviderConfig
	err = db.Get(&targetProvider, "SELECT * FROM provider_configs WHERE id = $1", run.TargetProviderID)
	if err != nil {
		markAsFailed(fmt.Errorf("failed to fetch target provider config (id=%s): %w", run.TargetProviderID, err))
		return
	}
	log.Printf("%s target provider: name=%s base_url=%s api_key_set=%t", logPrefix, targetProvider.Name, targetProvider.BaseURL, targetProvider.APIKey != "")

	// 6. Fetch evaluator provider config
	var evaluatorProvider models.ProviderConfig
	err = db.Get(&evaluatorProvider, "SELECT * FROM provider_configs WHERE id = $1", run.EvaluatorProviderID)
	if err != nil {
		markAsFailed(fmt.Errorf("failed to fetch evaluator provider config (id=%s): %w", run.EvaluatorProviderID, err))
		return
	}
	log.Printf("%s evaluator provider: name=%s base_url=%s api_key_set=%t", logPrefix, evaluatorProvider.Name, evaluatorProvider.BaseURL, evaluatorProvider.APIKey != "")

	// 7. Fetch all test cases for this project
	var testCases []models.TestCase
	err = db.Select(&testCases, "SELECT * FROM test_cases WHERE project_id = $1", run.ProjectID)
	if err != nil {
		markAsFailed(fmt.Errorf("failed to fetch test cases: %w", err))
		return
	}

	// Filter out blacklisted (disabled) test cases
	blacklist := make(map[string]bool, len(run.BlacklistedTestCaseIDs))
	for _, id := range run.BlacklistedTestCaseIDs {
		blacklist[id] = true
	}
	if len(blacklist) > 0 {
		filtered := testCases[:0]
		for _, tc := range testCases {
			if !blacklist[tc.ID.String()] {
				filtered = append(filtered, tc)
			}
		}
		testCases = filtered
	}

	if len(testCases) == 0 {
		markAsFailed(fmt.Errorf("no test cases to run for project %s (all disabled or none found)", run.ProjectID))
		return
	}
	log.Printf("%s running %d test cases (blacklisted: %d)", logPrefix, len(testCases), len(blacklist))

	// Initialize LLM Clients
	targetClient := NewLLMClient(targetProvider.BaseURL, targetProvider.APIKey, targetProvider.CustomHeaders)
	evaluatorClient := NewLLMClient(evaluatorProvider.BaseURL, evaluatorProvider.APIKey, evaluatorProvider.CustomHeaders)

	var totalScore float64
	var completedCount int

for i, tc := range testCases {
		casePrefix := fmt.Sprintf("%s case[%d/%d id=%s]", logPrefix, i+1, len(testCases), tc.ID)
		
		var generatedOutput string
		var err error

		// Add current test case's input to conversation history
		if run.EnableMemory && memory != nil {
			memory.ConversationHistory = append(memory.ConversationHistory, MemoryEntry{
				Role:    "user",
				Content: tc.InputPrompt,
				Time:    time.Now(),
			})
		}

		if run.EnableMemory && memory != nil {
		// Add current test case's input to conversation history
		memory.ConversationHistory = append(memory.ConversationHistory, MemoryEntry{
			Role:    "user",
			Content: tc.InputPrompt,
			Time:    time.Now(),
		})

		// Build context prompt with clear separation of sections
		var contextPrompt string
		if memory.Resume != "" {
			contextPrompt = fmt.Sprintf("System Instructions:\n%s\n\nPrevious Context:\n%s\n\nCurrent Question:\n%s\n\nIMPORTANT: Please answer ONLY the current question above. Do NOT include any summary or additional commentary. Your answer should be concise and directly address the question.",

				sysPrompt.Content,
				memory.Resume,
				tc.InputPrompt,
			)
		} else {
			contextPrompt = fmt.Sprintf("System Instructions:\n%s\n\nCurrent Question:\n%s",
				sysPrompt.Content, tc.InputPrompt)
		}

		log.Printf("%s building context prompt with resume=%s", casePrefix, len(memory.Resume) > 0 && memory.Resume != "")

		generatedOutput, err = targetClient.Generate(ctx, run.TargetModel, contextPrompt, "", 0.0)
	} else {
		generatedOutput, err = targetClient.Generate(ctx, run.TargetModel, sysPrompt.Content, tc.InputPrompt, 0.0)
	}

		if err != nil {
			log.Printf("%s target generation failed: %v", casePrefix, err)
			generatedOutput = fmt.Sprintf("ERROR GENERATING OUTPUT: %v", err)
			score := 0.0
			isPassed := false
			reason := "Target generation failed: " + err.Error()

			err = saveResult(db, runID, tc.ID, generatedOutput, score, isPassed, reason)
			if err != nil {
				log.Printf("%s failed to save error result: %v", casePrefix, err)
			}
			continue
		}
		log.Printf("%s target generation ok, len=%d", casePrefix, len(generatedOutput))

		// Save the generation result
		if run.EnableMemory && memory != nil {
			memory.ConversationHistory = append(memory.ConversationHistory, MemoryEntry{
				Role:    "assistant",
				Content: generatedOutput,
				Time:    time.Now(),
			})
			memory.GeneratedOutputs = append(memory.GeneratedOutputs, OutputRecord{
				TestCaseID: tc.ID.String(),
				Output:     generatedOutput,
				Timestamp:  time.Now(),
			})

			// Generate a new resume from the updated conversation
			conversationHistory := BuildConversationHistory(memory.ConversationHistory)
			resumePrompt, resumeErr := GenerateResume(conversationHistory, generatedOutput)
			if resumeErr == nil && resumePrompt != "" {
				memory.Resume = resumePrompt
				log.Printf("%s generated new memory resume", casePrefix)
			}
		}

		evaluatorUserPrompt := fmt.Sprintf(
			"Evaluation Rubric:\n%s\n\nExpected Output:\n%s\n\nActual Generated Output:\n%s\n\nPlease evaluate. You MUST output EXACTLY in the format:\nSCORE: <0.0-1.0>\nREASONING: <brief reasoning>",
			evalPrompt.Content,
			tc.ExpectedOutput,
			generatedOutput,
		)

		log.Printf("%s grading with model %s", casePrefix, run.EvaluatorModel)
		var evalResponse string
		// Note: Use regular Generate for evaluator, not GenerateWithMemory
		// Memory is only for the target model's conversation context,
		// but evaluator should evaluate each test case independently
		evalResponse, err = evaluatorClient.Generate(ctx, run.EvaluatorModel, "", evaluatorUserPrompt, 0.0)

		var score float64
		var reasoning string
		if err != nil {
			log.Printf("%s grading failed: %v", casePrefix, err)
			score = 0.0
			reasoning = fmt.Sprintf("Evaluation request failed: %v", err)
		} else {
			score, reasoning = parseEvaluation(evalResponse)
			log.Printf("%s graded score=%.2f passed=%t", casePrefix, score, score >= run.PassThreshold)
		}

		if run.EnableMemory && memory != nil {
			memory.Evaluations = append(memory.Evaluations, EvaluationRecord{
				TestCaseID: tc.ID.String(),
				Score:      score,
				Reasoning:  reasoning,
				Timestamp:  time.Now(),
			})
		}

		isPassed := score >= run.PassThreshold
		totalScore += score
		completedCount++

		err = saveResult(db, runID, tc.ID, generatedOutput, score, isPassed, reasoning)
		if err != nil {
			log.Printf("%s failed to save result: %v", casePrefix, err)
		}
	}

	// 11. Finalize run statistics
	if completedCount == 0 {
		markAsFailed(fmt.Errorf("all test cases failed to generate/evaluate"))
		return
	}

	avgScore := totalScore / float64(completedCount)
	isRunPassed := avgScore >= run.PassThreshold

	_, err = db.Exec(
		"UPDATE evaluation_runs SET status = 'completed', average_score = $1, is_passed = $2, completed_at = $3, failure_reason = NULL WHERE id = $4",
		avgScore, isRunPassed, time.Now(), runID,
	)
	if err != nil {
		log.Printf("%s failed to finalize evaluation run: %v", logPrefix, err)
		return
	}

	log.Printf("%s completed. avg_score=%.2f passed=%t cases=%d", logPrefix, avgScore, isRunPassed, completedCount)
}

func saveResult(db *sqlx.DB, runID, testCaseID uuid.UUID, genOutput string, score float64, isPassed bool, reasoning string) error {
	query := `
		INSERT INTO evaluation_results (run_id, test_case_id, generated_output, score, is_passed, evaluator_reasoning)
		VALUES ($1, $2, $3, $4, $5, $6)
	`
	_, err := db.Exec(query, runID, testCaseID, genOutput, score, isPassed, reasoning)
	return err
}

func buildConversationHistory(entries []MemoryEntry) string {
	var history strings.Builder
	for _, entry := range entries {
		history.WriteString(fmt.Sprintf("%s: %s\n", strings.ToLower(entry.Role), entry.Content))
	}
	return strings.TrimSpace(history.String())
}

func parseEvaluation(response string) (float64, string) {
	var score float64
	var reasoning string

	lines := strings.Split(response, "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(strings.ToUpper(trimmed), "SCORE:") {
			scoreStr := strings.TrimSpace(trimmed[6:])
			// Clean any extra spaces or symbols if any
			scoreStr = strings.TrimSpace(strings.ReplaceAll(scoreStr, "*", ""))
			fmt.Sscanf(scoreStr, "%f", &score)
		} else if strings.HasPrefix(strings.ToUpper(trimmed), "REASONING:") {
			reasoning = strings.TrimSpace(trimmed[10:])
		}
	}

	// Fallback if parsing reasoning is empty
	if reasoning == "" {
		idx := strings.Index(strings.ToUpper(response), "REASONING:")
		if idx != -1 {
			reasoning = strings.TrimSpace(response[idx+10:])
		} else {
			// If formatting failed entirely, capture the entire response
			reasoning = response
		}
	}

	// Bound-check the score
	if score < 0.0 {
		score = 0.0
	} else if score > 1.0 {
		score = 1.0
	}

	return score, reasoning
}

type EvaluationRun models.EvaluationRun
