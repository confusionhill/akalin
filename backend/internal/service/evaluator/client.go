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
	Temperature *float64         `json:"temperature,omitempty"`
	TopP        *float64         `json:"top_p,omitempty"`
	TopK        *int             `json:"top_k,omitempty"`
	MaxTokens   *int             `json:"max_tokens,omitempty"`
}

type ChatUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

type ChatCompletionsResponse struct {
	Choices []struct {
		Message ChatMessage `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
	Usage ChatUsage `json:"usage,omitempty"`
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

func (c *LLMClient) Generate(ctx context.Context, model string, systemPrompt, userPrompt string, adv *models.AdvancedSettings, defaultTemp float64) (string, []models.TraceStep, error) {
	messages, err := buildMessages(systemPrompt, userPrompt, "")
	if err != nil {
		return "", nil, err
	}
	
	var trace []models.TraceStep
	if userPrompt != "" {
		trace = append(trace, models.TraceStep{
			StepType: "user_input",
			Content:  userPrompt,
		})
	}
	
	msg, usage, err := c.makeRequestWithTools(ctx, model, messages, nil, adv, defaultTemp)
	if err != nil {
		return "", trace, err
	}

	trace = append(trace, models.TraceStep{
		StepType:         "ai_answer",
		Content:          msg.Content,
		PromptTokens:     usage.PromptTokens,
		CompletionTokens: usage.CompletionTokens,
		TotalTokens:      usage.TotalTokens,
	})

	return msg.Content, trace, nil
}

func buildMessages(systemPrompt, userPrompt, conversationHistory string) ([]ChatMessage, error) {
	messages := []ChatMessage{}

	if systemPrompt != "" {
		messages = append(messages, ChatMessage{
			Role:    "system",
			Content: systemPrompt,
		})
	}

	if conversationHistory != "" {
		messages = append(messages, ChatMessage{
			Role:    "user",
			Content: fmt.Sprintf("Previous Context:\n%s", conversationHistory),
		})
		messages = append(messages, ChatMessage{
			Role:    "assistant",
			Content: "Understood. I will use this context for our conversation.",
		})
	}

	if userPrompt != "" {
		messages = append(messages, ChatMessage{
			Role:    "user",
			Content: userPrompt,
		})
	}

	return messages, nil
}

func (c *LLMClient) makeRequestWithTools(ctx context.Context, model string, messages []ChatMessage, tools []ToolDefinition, adv *models.AdvancedSettings, defaultTemp float64) (ChatMessage, ChatUsage, error) {
	url := fmt.Sprintf("%s/chat/completions", c.BaseURL)

	reqBody := ChatCompletionsRequest{
		Model:    model,
		Messages: messages,
		Tools:    tools,
	}

	if adv != nil {
		reqBody.Temperature = adv.Temperature
		reqBody.TopP = adv.TopP
		reqBody.TopK = adv.TopK
		reqBody.MaxTokens = adv.MaxTokens
	}

	if reqBody.Temperature == nil {
		reqBody.Temperature = &defaultTemp
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return ChatMessage{}, ChatUsage{}, fmt.Errorf("failed to marshal request: %w", err)
	}

	log.Printf("[llm-client] POST %s model=%s msgs=%d tools=%d", url, model, len(messages), len(tools))

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return ChatMessage{}, ChatUsage{}, fmt.Errorf("failed to create http request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if c.APIKey != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.APIKey))
	}
	for k, v := range c.CustomHeaders {
		req.Header.Set(k, v)
	}

	client := &http.Client{Timeout: 300 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[llm-client] request error: %s model=%s err=%v", url, model, err)
		return ChatMessage{}, ChatUsage{}, fmt.Errorf("http request failed: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return ChatMessage{}, ChatUsage{}, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		snippet := string(respBytes)
		if len(snippet) > 800 {
			snippet = snippet[:800] + "...(truncated)"
		}
		log.Printf("[llm-client] non-200 status=%d url=%s model=%s body=%s", resp.StatusCode, url, model, snippet)
		var errResp ChatCompletionsResponse
		if json.Unmarshal(respBytes, &errResp) == nil && errResp.Error != nil {
			return ChatMessage{}, ChatUsage{}, fmt.Errorf("API error (status %d): %s", resp.StatusCode, errResp.Error.Message)
		}
		return ChatMessage{}, ChatUsage{}, fmt.Errorf("API error (status %d): %s", resp.StatusCode, snippet)
	}

	var chatResp ChatCompletionsResponse
	if err := json.Unmarshal(respBytes, &chatResp); err != nil {
		return ChatMessage{}, ChatUsage{}, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if len(chatResp.Choices) == 0 {
		return ChatMessage{}, ChatUsage{}, fmt.Errorf("received empty choices in completions response")
	}

	return chatResp.Choices[0].Message, chatResp.Usage, nil
}

func (c *LLMClient) GenerateWithTools(ctx context.Context, model string, systemPrompt, userPrompt string, availableTools []models.Tool, adv *models.AdvancedSettings, defaultTemp float64) (string, []string, []models.TraceStep, error) {
	messages, err := buildMessages(systemPrompt, userPrompt, "")
	if err != nil {
		return "", nil, nil, err
	}

	var trace []models.TraceStep
	if userPrompt != "" {
		trace = append(trace, models.TraceStep{
			StepType: "user_input",
			Content:  userPrompt,
		})
	}

	var toolDefs []ToolDefinition
	for _, t := range availableTools {
		var params map[string]interface{}
		if len(t.Parameters) > 0 {
			if err := json.Unmarshal(t.Parameters, &params); err != nil {
				log.Printf("[llm-client] warning: failed to parse parameters for tool %s: %v", t.Name, err)
			}
		}
		if params == nil {
			params = map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			}
		}

		toolDefs = append(toolDefs, ToolDefinition{
			Type: "function",
			Function: ToolFunction{
				Name:        t.Name,
				Description: t.Description,
				Parameters:  params,
			},
		})
	}

	var toolsCalled []string
	const maxTurns = 6

	for turn := 0; turn < maxTurns; turn++ {
		msg, usage, err := c.makeRequestWithTools(ctx, model, messages, toolDefs, adv, defaultTemp)
		if err != nil {
			return "", toolsCalled, trace, err
		}

		// If no tool calls requested, the LLM has produced its final output
		if len(msg.ToolCalls) == 0 {
			trace = append(trace, models.TraceStep{
				StepType:         "ai_answer",
				Content:          msg.Content,
				PromptTokens:     usage.PromptTokens,
				CompletionTokens: usage.CompletionTokens,
				TotalTokens:      usage.TotalTokens,
			})
			return msg.Content, toolsCalled, trace, nil
		}

		// Save assistant's tool call message
		messages = append(messages, msg)

		// Process tool calls
		for _, toolCall := range msg.ToolCalls {
			toolsCalled = append(toolsCalled, toolCall.Function.Name)

			trace = append(trace, models.TraceStep{
				StepType:         "tool_call",
				Content:          fmt.Sprintf("Call %s(%s)", toolCall.Function.Name, toolCall.Function.Arguments),
				PromptTokens:     usage.PromptTokens,
				CompletionTokens: usage.CompletionTokens,
				TotalTokens:      usage.TotalTokens,
			})

			// Execute tool mock output
			var toolResult string
			var matchedTool *models.Tool
			for _, t := range availableTools {
				if t.Name == toolCall.Function.Name {
					matchedTool = &t
					break
				}
			}

			if matchedTool != nil && matchedTool.Result != "" {
				toolResult = matchedTool.Result
			} else {
				toolResult = fmt.Sprintf(`{"status": "success", "message": "Tool %s executed successfully"}`, toolCall.Function.Name)
			}

			trace = append(trace, models.TraceStep{
				StepType: "tool_output",
				Content:  toolResult,
			})

			messages = append(messages, ChatMessage{
				Role:       "tool",
				ToolCallID: toolCall.ID,
				Name:       toolCall.Function.Name,
				Content:    toolResult,
			})
		}
	}

	// Fallback if maxTurns reached
	lastMsg := messages[len(messages)-1]
	return lastMsg.Content, toolsCalled, trace, nil
}


func (c *LLMClient) GenerateWithMemory(ctx context.Context, model string, systemPrompt string, conversationHistory string, adv *models.AdvancedSettings, defaultTemp float64) (string, error) {
	messages, err := buildMessages(systemPrompt, "", conversationHistory)
	if err != nil {
		return "", err
	}
	msg, _, err := c.makeRequestWithTools(ctx, model, messages, nil, adv, defaultTemp)
	if err != nil {
		return "", err
	}
	return msg.Content, nil
}
