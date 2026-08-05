---
title: 'Building a Robust LLM Evaluation Queue with PostgreSQL'
description: 'How we migrated from unbounded goroutines to a native, zero-dependency PostgreSQL job queue with real-time cancellation.'
pubDate: '2026-08-06'
heroImage: '/dashboard-preview.png'
---

# Building a Robust LLM Evaluation Queue with PostgreSQL

When building an LLM evaluation pipeline, it's incredibly tempting to just spawn a goroutine (`go RunPipeline()`) every time a user triggers a test. It's fast, built into Go, and requires zero setup.

However, as we scaled our pipeline dashboard, we quickly realized that unbounded goroutines are a recipe for disaster. LLM evaluations are heavily I/O bound (waiting for GPT-4 to respond), and triggering hundreds of them simultaneously exhausts memory, CPU, database connection pools, and rate limits.

Here is how we moved to a robust, zero-dependency background worker queue using PostgreSQL, and how we implemented real-time execution cancellation using Go Contexts.

## The Problem: `go func()` in HTTP Handlers

Initially, our HTTP handler looked like this:

```go
func (h *Handler) CreateEvaluation(c echo.Context) error {
	// ... validation & setup ...
	
	// Insert pending run into database
	h.DB.Exec("INSERT INTO evaluation_runs (status) VALUES ('pending') RETURNING id")

	// Trigger asynchronous pipeline execution
	go evaluator.RunPipeline(h.DB, run.ID)

	return c.JSON(http.StatusAccepted, run)
}
```

**The issues with this approach:**
1. **No concurrency limits:** 1,000 requests = 1,000 concurrent pipelines, leading to database connection exhaustion and LLM provider rate limits (e.g., OpenAI 429 Too Many Requests).
2. **No persistence:** If the backend server crashes or restarts during a deployment, any pipeline running inside those goroutines is abruptly killed and lost forever.

## The Solution: PostgreSQL `FOR UPDATE SKIP LOCKED`

We already use PostgreSQL, so instead of introducing a heavy Message Broker like RabbitMQ or Kafka, we leveraged Postgres to act as a highly concurrent queue.

The magic relies on `FOR UPDATE SKIP LOCKED`. This allows multiple background workers to poll the database and lock a specific row for processing, while other workers simply skip that locked row and pick up the next one. 

Here is our updated worker loop:

```go
func workerLoop(db *sqlx.DB, workerID int) {
	for {
		var runID uuid.UUID
		query := `
			UPDATE evaluation_runs 
			SET status = 'running' 
			WHERE id = (
				SELECT id FROM evaluation_runs 
				WHERE status = 'pending' 
				ORDER BY created_at ASC 
				LIMIT 1 
				FOR UPDATE SKIP LOCKED
			) 
			RETURNING id;
		`
		err := db.Get(&runID, query)
		if err != nil {
			if err == sql.ErrNoRows {
				// Queue is empty, wait before checking again
				time.Sleep(2 * time.Second)
			}
			continue
		}

		// Row successfully acquired and locked!
		ctx, cancel := context.WithCancel(context.Background())
		activeRuns.Store(runID, cancel)
        
		evaluator.RunPipeline(ctx, db, runID)
        
		activeRuns.Delete(runID)
		cancel()
	}
}
```

Now, the HTTP handler simply inserts the run as `pending` and returns immediately. The worker pool seamlessly picks up the job in the background, fully respecting our concurrency limits.

## The Cherry on Top: Active Cancellation

One major benefit of this architecture is the ability to cancel jobs mid-execution. If a user realizes their prompt is wrong right after clicking "Run", they shouldn't have to wait (and pay API credits) for the entire evaluation to finish.

Because our worker loop stores a `context.CancelFunc` in an in-memory `sync.Map` for every active run, we can easily expose a `/cancel` endpoint:

```go
func (h *Handler) CancelEvaluation(c echo.Context) error {
	runID := uuid.MustParse(c.Param("run_id"))
	
	// 1. Update database to prevent pending jobs from starting
	h.DB.Exec("UPDATE evaluation_runs SET status = 'cancelled' WHERE id = $1 AND status IN ('pending', 'running')", runID)
	
	// 2. Abort the active execution context if it's currently running
	worker.CancelRun(runID)
	
	return c.NoContent(http.StatusOK)
}
```

Inside `RunPipeline`, we wrap the HTTP client calls with this provided context. If `worker.CancelRun()` is called, the context cancels, immediately dropping all pending LLM API requests and halting the pipeline cleanly.

## Conclusion

By leveraging PostgreSQL's `SKIP LOCKED` feature and Go's powerful `context` package, we built a highly robust, concurrent, and cancellable background job processor—all without adding a single new piece of infrastructure to our stack.
