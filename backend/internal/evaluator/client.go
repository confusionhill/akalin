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

	"github.com/dika/llm-evaluation-pipeline-dashboard/backend/internal/models"
)


type ToolCallFunction struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

type ToolCall struct {
	ID       string           `json:"id"`
	Type     string           `json:"type"`
	Function ToolCallFunction `json:"function"`
}

type ChatMessage struct {
	Role       string     `json:"role"`
	Content    string     `json:"content,omitempty"`
	ToolCalls  []ToolCall `json:"tool_calls,omitempty"`
	ToolCallID string     `json:"tool_call_id,omitempty"`
	Name       string     `json:"name,omitempty"`
}

type ToolFunction struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters,omitempty"`
}

type ToolDefinition struct {
	Type     string       `json:"type"`
	Function ToolFunction `json:"function"`
}

type ChatCompletionsRequest struct {
	Model       string           `json:"model"`
	Messages    []ChatMessage    `json:"messages"`
	Tools       []ToolDefinition `json:"tools,omitempty"`
	Temperature float64          `json:"temperature"`
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
	messages, err := buildMessages(systemPrompt, userPrompt, "")
	if err != nil {
		return "", err
	}
	return c.makeRequest(ctx, model, messages, temperature)
}

func buildMessages(systemPrompt, userPrompt, conversationHistory string) ([]ChatMessage, error) {
	messages := []ChatMessage{}

	if systemPrompt != "" {
		messages = append(messages, ChatMessage{Role: "system", Content: systemPrompt})
	}

	if conversationHistory != "" {
		historyLines := strings.Split(conversationHistory, "\n")
		for _, line := range historyLines {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}
			if strings.HasPrefix(strings.ToLower(line), "user:") {
				content := strings.TrimPrefix(line, "user:")
				content = strings.TrimSpace(content)
				if content != "" {
					messages = append(messages, ChatMessage{Role: "user", Content: content})
				}
			} else if strings.HasPrefix(strings.ToLower(line), "assistant:") {
				content := strings.TrimPrefix(line, "assistant:")
				content = strings.TrimSpace(content)
				if content != "" {
					messages = append(messages, ChatMessage{Role: "assistant", Content: content})
				}
			}
		}
	}

	if userPrompt != "" {
		messages = append(messages, ChatMessage{Role: "user", Content: userPrompt})
	}

	return messages, nil
}

func (c *LLMClient) makeRequest(ctx context.Context, model string, messages []ChatMessage, temperature float64) (string, error) {
	msg, err := c.makeRequestWithTools(ctx, model, messages, nil, temperature)
	if err != nil {
		return "", err
	}
	return msg.Content, nil
}


func (c *LLMClient) makeRequestWithTools(ctx context.Context, model string, messages []ChatMessage, tools []ToolDefinition, temperature float64) (ChatMessage, error) {
	url := fmt.Sprintf("%s/chat/completions", c.BaseURL)

	reqBody := ChatCompletionsRequest{
		Model:       model,
		Messages:    messages,
		Tools:       tools,
		Temperature: temperature,
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return ChatMessage{}, fmt.Errorf("failed to marshal request: %w", err)
	}

	log.Printf("[llm-client] POST %s model=%s msgs=%d tools=%d", url, model, len(messages), len(tools))

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return ChatMessage{}, fmt.Errorf("failed to create http request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if c.APIKey != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.APIKey))
	}
	for k, v := range c.CustomHeaders {
		req.Header.Set(k, v)
	}

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[llm-client] request error: %s model=%s err=%v", url, model, err)
		return ChatMessage{}, fmt.Errorf("http request failed: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return ChatMessage{}, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		snippet := string(respBytes)
		if len(snippet) > 800 {
			snippet = snippet[:800] + "...(truncated)"
		}
		log.Printf("[llm-client] non-200 status=%d url=%s model=%s body=%s", resp.StatusCode, url, model, snippet)
		var errResp ChatCompletionsResponse
		if json.Unmarshal(respBytes, &errResp) == nil && errResp.Error != nil {
			return ChatMessage{}, fmt.Errorf("API error (status %d): %s", resp.StatusCode, errResp.Error.Message)
		}
		return ChatMessage{}, fmt.Errorf("API error (status %d): %s", resp.StatusCode, snippet)
	}

	var chatResp ChatCompletionsResponse
	if err := json.Unmarshal(respBytes, &chatResp); err != nil {
		return ChatMessage{}, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if len(chatResp.Choices) == 0 {
		return ChatMessage{}, fmt.Errorf("received empty choices in completions response")
	}

	return chatResp.Choices[0].Message, nil
}

func (c *LLMClient) GenerateWithTools(ctx context.Context, model string, systemPrompt, userPrompt string, availableTools []models.Tool, temperature float64) (string, []string, error) {
	messages, err := buildMessages(systemPrompt, userPrompt, "")
	if err != nil {
		return "", nil, err
	}

	var toolDefs []ToolDefinition
	for _, t := range availableTools {
		toolDefs = append(toolDefs, ToolDefinition{
			Type: "function",
			Function: ToolFunction{
				Name:        t.Name,
				Description: t.Description,
				Parameters: map[string]interface{}{
					"type":       "object",
					"properties": map[string]interface{}{},
				},
			},
		})
	}

	var toolsCalled []string
	const maxTurns = 6

	for turn := 0; turn < maxTurns; turn++ {
		msg, err := c.makeRequestWithTools(ctx, model, messages, toolDefs, temperature)
		if err != nil {
			return "", toolsCalled, err
		}

		// If no tool calls requested, the LLM has produced its final output
		if len(msg.ToolCalls) == 0 {
			return msg.Content, toolsCalled, nil
		}

		// Append the assistant's response (with tool_calls) to conversation history
		messages = append(messages, msg)

		// Intercept tool calls and feed back mocked results
		for _, tc := range msg.ToolCalls {
			toolName := tc.Function.Name
			toolsCalled = append(toolsCalled, toolName)

			var mockResult string = "Tool executed successfully."
			for _, t := range availableTools {
				if t.Name == toolName {
					mockResult = t.Result
					break
				}
			}

			messages = append(messages, ChatMessage{
				Role:       "tool",
				ToolCallID: tc.ID,
				Name:       toolName,
				Content:    mockResult,
			})
		}
	}

	// Fallback if maxTurns reached
	lastMsg := messages[len(messages)-1]
	return lastMsg.Content, toolsCalled, nil
}


func (c *LLMClient) GenerateWithMemory(ctx context.Context, model string, systemPrompt string, conversationHistory string, temperature float64) (string, error) {
	messages, err := buildMessages(systemPrompt, "", conversationHistory)
	if err != nil {
		return "", err
	}
	return c.makeRequest(ctx, model, messages, temperature)
}

