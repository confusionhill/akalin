# Memory Feature Plan

## Overview
Add memory persistence to the LLM evaluation pipeline, allowing context to be shared across test cases (sequential mode) or isolated per test case (parallel mode). Memory exists only during pipeline execution and is automatically cleaned up after completion.

## Storage Design

### In-Memory Storage (Only during pipeline execution)

**Approach:** Use Go `map` or struct to store memory temporarily during `RunPipeline` execution.

**Why In-Memory?**
- Simple, fast, no database writes during evaluation
- Automatic cleanup when function returns
- No DB overhead or migration needed
- Perfect for temporary context that's only needed during execution

**Memory Structure:**
```go
type EvaluationMemory struct {
    Version             int                    `json:"version"`
    ConversationHistory []MemoryEntry          `json:"conversation_history"`
    GeneratedOutputs    []OutputRecord          `json:"generated_outputs"`
    Evaluations         []EvaluationRecord      `json:"evaluations"`
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
```

**Storage Locations:**
1. **Local variable** in `RunPipeline` function (primary)
2. **In-memory map** for cross-test-case access if needed
3. **Passed as context** to LLM client for memory-enabled generation

## Memory Format Design

### Example Memory Structure

```json
{
  "version": "1.0",
  "conversation_history": [
    {
      "role": "system",
      "content": "You are a helpful assistant...",
      "time": "2026-08-05T17:30:00Z"
    },
    {
      "role": "user",
      "content": "What is artificial intelligence?",
      "time": "2026-08-05T17:30:05Z"
    },
    {
      "role": "assistant",
      "content": "AI refers to computer systems designed to perform tasks...",
      "time": "2026-08-05T17:30:10Z"
    }
  ],
  "generated_outputs": [
    {
      "test_case_id": "uuid-1",
      "output": "...",
      "timestamp": "2026-08-05T17:30:10Z"
    }
  ],
  "evaluations": [
    {
      "test_case_id": "uuid-1",
      "score": 0.95,
      "reasoning": "Response was clear and comprehensive...",
      "timestamp": "2026-08-05T17:30:15Z"
    }
  ],
  "notes": {
    "insights": "Model is particularly good at explaining technical concepts",
    "patterns": "Always includes code examples for technical topics"
  }
}
```

### Configuration

### Evaluation Run API Update

**New Field in `EvaluationRuns` Table:**
```sql
ALTER TABLE evaluation_runs ADD COLUMN enable_memory BOOLEAN DEFAULT false;
```

**Updated Model:**
```go
type EvaluationRun struct {
    // ... existing fields ...
    EnableMemory bool `json:"enable_memory"` // Whether memory mode is enabled for this run
}
```

**API Request:**
```json
{
  "system_prompt_id": "...",
  "evaluation_prompt_id": "...",
  "target_provider_id": "...",
  "target_model": "openrouter/auto-beta",
  "evaluator_provider_id": "...",
  "evaluator_model": "openrouter/auto-beta",
  "enable_memory": true,  // NEW: Toggle to enable memory
  "pass_threshold": 0.8,
  "blacklisted_test_case_ids": []
}
```

**Pipeline Logic:**
```go
if run.EnableMemory {
    // Sequential mode with memory
    memory := &EvaluationMemory{...}
    // Use memory for sequential execution
} else {
    // Parallel mode without memory
    // Independent execution per test case
}
```

## Implementation Plan

### Phase 1: Database Schema
1. Add `enable_memory` column to `evaluation_runs` table
2. Add indexes for performance if needed

### Phase 2: Memory Structures
1. Define `EvaluationMemory`, `MemoryEntry`, `OutputRecord`, `EvaluationRecord` structs
2. Add helper functions for memory management
3. Document memory lifecycle (create, update, clear)

### Phase 2: Pipeline Integration

**Sequential Mode (with memory):**
```go
func RunPipeline(db *sqlx.DB, runID uuid.UUID) {
    // ... existing setup code ...

    // Initialize memory
    memory := &EvaluationMemory{
        Version: 1,
        ConversationHistory: []MemoryEntry{},
        GeneratedOutputs: []OutputRecord{},
        Evaluations: []EvaluationRecord{},
        Notes: make(map[string]interface{}),
    }

    // Optional: Add system prompt to conversation
    memory.ConversationHistory = append(memory.ConversationHistory, MemoryEntry{
        Role: "system",
        Content: sysPrompt.Content,
        Time: time.Now(),
    })

    var totalScore float64
    var completedCount int

    for i, tc := range testCases {
        casePrefix := fmt.Sprintf("%s case[%d/%d id=%s]", logPrefix, i+1, len(testCases), tc.ID)

        // 1. Add current test case to conversation history
        memory.ConversationHistory = append(memory.ConversationHistory, MemoryEntry{
            Role: "user",
            Content: tc.InputPrompt,
            Time: time.Now(),
        })

        // 2. Call target model with updated memory context
        log.Printf("%s generating target response with model %s", casePrefix, run.TargetModel)

        // Convert memory to JSON for context injection
        memoryJSON, _ := json.Marshal(memory)
        memoryContext := string(memoryJSON)

        generatedOutput, err := targetClient.GenerateWithMemory(
            ctx,
            run.TargetModel,
            sysPrompt.Content, // Base system prompt
            tc.InputPrompt,    // Current query
            0.0,
            memoryContext,     // Full conversation history
        )

        if err != nil {
            // Handle error as before
            continue
        }

        // 3. Store generated output in memory
        memory.GeneratedOutputs = append(memory.GeneratedOutputs, OutputRecord{
            TestCaseID: tc.ID.String(),
            Output: generatedOutput,
            Timestamp: time.Now(),
        })

        // 4. Add assistant response to conversation
        memory.ConversationHistory = append(memory.ConversationHistory, MemoryEntry{
            Role: "assistant",
            Content: generatedOutput,
            Time: time.Now(),
        })

        // 5. Grading logic (same as before)
        // ...

        // 6. Store evaluation result
        memory.Evaluations = append(memory.Evaluations, EvaluationRecord{
            TestCaseID: tc.ID.String(),
            Score: score,
            Reasoning: reasoning,
            Timestamp: time.Now(),
        })

        totalScore += score
        completedCount++
    }

    // Memory automatically discarded when function returns
}
```

**Parallel Mode (no memory):**
```go
for i, tc := range testCases {
    // No memory sharing - each test case starts fresh
    generatedOutput, err := targetClient.Generate(
        ctx,
        run.TargetModel,
        sysPrompt.Content,
        tc.InputPrompt,
        0.0,
    )
    // ... rest of logic ...
}
```

### Phase 3: LLM Client Enhancement

**Option 1: New GenerateWithMemory function**
```go
func (c *LLMClient) GenerateWithMemory(
    ctx context.Context,
    model string,
    baseSystemPrompt string,
    userPrompt string,
    temperature float64,
    conversationHistory string,
) (string, error) {
    // Combine base system prompt with conversation history
    combinedPrompt := fmt.Sprintf("%s\n\nConversation History:\n%s\n\nCurrent Query:\n%s",
        baseSystemPrompt, conversationHistory, userPrompt)

    return c.Generate(ctx, model, combinedPrompt, userPrompt, temperature)
}
```

**Option 2: Memory parameter (simpler)**
```go
func (c *LLMClient) Generate(
    ctx context.Context,
    model string,
    systemPrompt string,
    userPrompt string,
    temperature float64,
    memoryContext *string, // Optional conversation history
) (string, error) {
    if memoryContext != nil && *memoryContext != "" {
        systemPrompt = fmt.Sprintf("%s\n\nPrevious Conversation:\n%s",
            systemPrompt, *memoryContext)
    }
    return c.rawGenerate(ctx, model, systemPrompt, userPrompt, temperature)
}
```

## Configuration

### Evaluation Run API Update

**New Optional Field in `EvaluationRun`:**
```go
type EvaluationRun struct {
    // ... existing fields ...
    EnableMemory bool `json:"enable_memory"` // Default: false
    MemoryMode string `json:"memory_mode"` // "conversation", "context", "hybrid"
}
```

### Frontend UI Changes

1. **Evaluation Creation Form**:
   - Add "Memory Mode" toggle/selector
   - Options: "None" (parallel), "Conversation", "Hybrid"

2. **Memory Inspector** (optional future feature):
   - View memory contents per run
   - See how conversation evolves over time

3. **Visual Indicators**:
   - Badge showing memory mode status
   - Memory size indicator in UI

## Benefits

1. **Long-form conversations**: Model maintains context across multiple test cases
2. **Learning evaluations**: System can learn from previous outputs
3. **Simple implementation**: No database migrations, no storage management
4. **Automatic cleanup**: Memory discarded when pipeline completes
5. **Transparent**: All conversation visible in-memory during execution
6. **No process restart needed**: Memory persists only during pipeline execution

## Implementation Details

### Memory Lifecycle

**Created:**
- `RunPipeline` function starts, initialize empty `EvaluationMemory`

**Updated:**
- After each test case execution
- Conversation history grows with user/assistant exchanges
- Generated outputs stored in history
- Evaluations saved

**Cleaned up:**
- Function returns (garbage collected)
- Context cancelled (if timeout)
- Process exits

### Performance Considerations

**Memory Growth:**
- Each test case adds conversation entries (user prompt + assistant response)
- Output and evaluation records store full strings
- For large-scale evaluations, consider implementing memory limits or summarization

**Size Management (Optional Future Enhancement):**
```go
// Limit conversation history to last N entries
if len(memory.ConversationHistory) > 100 {
    memory.ConversationHistory = memory.ConversationHistory[len(memory.ConversationHistory)-100:]
}
```

## Implementation Plan

### Phase 1: Database Schema
1. Add `enable_memory` column to `evaluation_runs` table with default `false`
2. Update `models.EvaluationRun` to include `EnableMemory` field

### Phase 2: Memory Structures
1. Define `EvaluationMemory`, `MemoryEntry`, `OutputRecord`, `EvaluationRecord` structs
2. Create helper functions for memory management
3. Document memory lifecycle

### Phase 3: Pipeline Integration
1. Update `RunPipeline` to check `run.EnableMemory`
2. If true: Initialize memory and execute sequentially with context
3. If false: Execute parallel (current behavior)
4. Add `GenerateWithMemory` function to `LLMClient`

### Phase 4: API Updates
1. Update `CreateEvaluation` to accept `enable_memory` field
2. Store the field in database on run creation

### Phase 5: Frontend Updates
1. Add memory toggle in evaluation creation form
2. Show visual indicator when memory is enabled
3. Display memory status in evaluation details

## Summary

**Key Features:**
- ✅ Toggle in UI to enable/disable memory per evaluation run
- ✅ Configuration saved to database (evaluation_runs.enable_memory)
- ✅ In-memory only for performance (data discarded after pipeline completes)
- ✅ Sequential mode shares context across test cases
- ✅ Parallel mode (default) starts fresh per test case
- ✅ Flexible JSON structure for conversation history
- ✅ No database migrations needed for actual memory data
- ✅ Backward compatible (opt-in, default false)

**Storage Strategy:**
- **Configuration**: Saved in `evaluation_runs.enable_memory` (persisted)
- **Actual Memory**: In-memory Go structs (temporary, auto-cleanup)
- **Rationale**: Configuration needs persistence, memory data doesn't (only used during execution)

**Code Changes Required:**
1. Add `enable_memory BOOLEAN DEFAULT false` to `evaluation_runs` table
2. Add `EnableMemory bool` to `models.EvaluationRun`
3. Create memory structs in `internal/evaluator/memory.go`
4. Add `GenerateWithMemory` to `internal/evaluator/client.go`
5. Update `RunPipeline` for conditional memory usage
6. Update `CreateEvaluation` to store enable_memory flag
7. Add memory toggle in frontend evaluation form
8. Display memory status in evaluation detail page