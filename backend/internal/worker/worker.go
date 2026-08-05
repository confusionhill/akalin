package worker

import (
	"context"
	"database/sql"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/evaluator"
)

var (
	activeRuns sync.Map
)

// StartEvaluationWorkers initializes the background worker pool for processing pending evaluation runs.
func StartEvaluationWorkers(db *sqlx.DB, concurrency int) {
	log.Printf("[worker] starting %d evaluation workers...", concurrency)
	for i := 0; i < concurrency; i++ {
		go workerLoop(db, i+1)
	}
}

// CancelRun aborts an actively running evaluation pipeline if it exists on this instance.
func CancelRun(runID uuid.UUID) {
	if cancelFunc, ok := activeRuns.Load(runID); ok {
		log.Printf("[worker] canceling active run %s", runID)
		cancelFunc.(context.CancelFunc)()
	}
}

func workerLoop(db *sqlx.DB, workerID int) {
	for {
		var runID uuid.UUID
		// Use FOR UPDATE SKIP LOCKED to act as a concurrent queue.
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
				// No pending runs, wait a bit before checking again to prevent DB thrashing.
				time.Sleep(2 * time.Second)
			} else {
				log.Printf("[worker %d] error fetching pending run: %v", workerID, err)
				time.Sleep(2 * time.Second)
			}
			continue
		}

		log.Printf("[worker %d] acquired pending run %s", workerID, runID)

		// Create a cancellable context for this specific run.
		ctx, cancel := context.WithCancel(context.Background())
		
		// Store the cancel function in the active runs map
		activeRuns.Store(runID, cancel)

		// Run the pipeline (blocking until complete or cancelled)
		evaluator.RunPipeline(ctx, db, runID)

		// Clean up the active runs map once finished
		activeRuns.Delete(runID)
		cancel() // Free context resources
		
		log.Printf("[worker %d] completed run %s", workerID, runID)
	}
}
