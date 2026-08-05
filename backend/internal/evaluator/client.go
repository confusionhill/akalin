package evaluator

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
)

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatCompletionsRequest struct {
	Model       string        `json:"model"`
	Messages    []ChatMessage `json:"messages"`
	Temperature float64       `json:"temperature"`
}

type ChatCompletionsResponse struct {
	Choices []struct {
		Message ChatMessage `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

type LLMClient struct {
	BaseURL       string
	APIKey        string
	CustomHeaders map[string]string
}

func NewLLMClient(baseURL, apiKey string, customHeaders map[string]string) *LLMClient {
	// Standardize base URL - ensure it doesn't end with a trailing slash
	baseURL = strings.TrimSuffix(baseURL, "/")
	return &LLMClient{
		BaseURL:       baseURL,
		APIKey:        apiKey,
		CustomHeaders: customHeaders,
	}
}

func (c *LLMClient) Generate(ctx context.Context, model string, systemPrompt, userPrompt string, temperature float64) (string, error) {
	url := fmt.Sprintf("%s/chat/completions", c.BaseURL)

	messages := []ChatMessage{}
	if systemPrompt != "" {
		messages = append(messages, ChatMessage{Role: "system", Content: systemPrompt})
	}
	messages = append(messages, ChatMessage{Role: "user", Content: userPrompt})

	reqBody := ChatCompletionsRequest{
		Model:       model,
		Messages:    messages,
		Temperature: temperature,
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	log.Printf("[llm-client] POST %s model=%s msgs=%d", url, model, len(messages))

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return "", fmt.Errorf("failed to create http request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	if c.APIKey != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.APIKey))
	}

	// Inject custom headers
	for k, v := range c.CustomHeaders {
		req.Header.Set(k, v)
	}

	client := &http.Client{
		Timeout: 60 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[llm-client] request error: %s model=%s err=%v", url, model, err)
		return "", fmt.Errorf("http request failed: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response body: %w", err)
	}

	log.Printf("[llm-client] response status=%d len=%d model=%s", resp.StatusCode, len(respBytes), model)

	if resp.StatusCode != http.StatusOK {
		snippet := string(respBytes)
		if len(snippet) > 800 {
			snippet = snippet[:800] + "...(truncated)"
		}
		log.Printf("[llm-client] non-200 status=%d url=%s model=%s body=%s", resp.StatusCode, url, model, snippet)
		var errResp ChatCompletionsResponse
		if json.Unmarshal(respBytes, &errResp) == nil && errResp.Error != nil {
			return "", fmt.Errorf("API error (status %d): %s", resp.StatusCode, errResp.Error.Message)
		}
		return "", fmt.Errorf("API error (status %d): %s", resp.StatusCode, snippet)
	}

	var chatResp ChatCompletionsResponse
	if err := json.Unmarshal(respBytes, &chatResp); err != nil {
		snippet := string(respBytes)
		if len(snippet) > 400 {
			snippet = snippet[:400] + "...(truncated)"
		}
		log.Printf("[llm-client] unmarshal error: %v body=%s", err, snippet)
		return "", fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if len(chatResp.Choices) == 0 {
		log.Printf("[llm-client] empty choices url=%s model=%s body=%s", url, model, string(respBytes))
		return "", fmt.Errorf("received empty choices in completions response")
	}

	return chatResp.Choices[0].Message.Content, nil
}
