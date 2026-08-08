package cache

import (
	"math/rand"
	"sync"
	"time"

	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/models"
	"github.com/google/uuid"
)

type PromptCache interface {
	GetActivePrompts(projectID uuid.UUID) ([]models.SystemPrompt, bool)
	SetActivePrompts(projectID uuid.UUID, prompts []models.SystemPrompt)
	PickRandomPrompt(projectID uuid.UUID) (*models.SystemPrompt, bool)
}

type promptCache struct {
	mu      sync.RWMutex
	prompts map[uuid.UUID][]models.SystemPrompt
}

func NewPromptCache() PromptCache {
	return &promptCache{
		prompts: make(map[uuid.UUID][]models.SystemPrompt),
	}
}

func (c *promptCache) GetActivePrompts(projectID uuid.UUID) ([]models.SystemPrompt, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	prompts, ok := c.prompts[projectID]
	return prompts, ok
}

func (c *promptCache) SetActivePrompts(projectID uuid.UUID, prompts []models.SystemPrompt) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.prompts[projectID] = prompts
}

func (c *promptCache) PickRandomPrompt(projectID uuid.UUID) (*models.SystemPrompt, bool) {
	c.mu.RLock()
	prompts, ok := c.prompts[projectID]
	c.mu.RUnlock()

	if !ok || len(prompts) == 0 {
		return nil, false
	}

	totalWeight := 0
	for _, p := range prompts {
		totalWeight += p.TrafficWeight
	}

	if totalWeight <= 0 {
		return nil, false
	}

	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	randomVal := r.Intn(totalWeight) + 1

	currentWeight := 0
	for _, p := range prompts {
		currentWeight += p.TrafficWeight
		if randomVal <= currentWeight {
			// We must return a copy to prevent mutation
			pCopy := p
			return &pCopy, true
		}
	}

	return nil, false
}
