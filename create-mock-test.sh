#!/bin/bash

# LLM Evaluation Pipeline Dashboard - Mock Test Data Creator
# This script creates a project, system prompt, and 4 test cases

set -e

API_BASE_URL="${API_BASE_URL:-http://localhost:5173/api}"
TENANT_ID="${TENANT_ID:-00000000-0000-0000-0000-000000000001}"
USER_ID="${USER_ID:-00000000-0000-0000-0000-000000000002}"
PROJECT_NAME="${PROJECT_NAME:-Test Project}"
PROJECT_DESCRIPTION="${PROJECT_DESCRIPTION:-A test project for mock evaluation}"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Creating mock test data...${NC}\n"

# Step 1: Create project
echo -e "${BLUE}Step 1: Creating project...${NC}"
PROJECT_RESPONSE=$(curl -s -X POST "${API_BASE_URL}/projects" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: ${TENANT_ID}" \
  -H "X-User-ID: ${USER_ID}" \
  -d "{
    \"name\": \"${PROJECT_NAME}\",
    \"description\": \"${PROJECT_DESCRIPTION}\"
  }")

PROJECT_ID=$(echo "$PROJECT_RESPONSE" | jq -r '.id')

if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "null" ]; then
  echo -e "${RED}Failed to create project: ${PROJECT_RESPONSE}${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Project created: ${PROJECT_ID}${NC}\n"

# Step 2: Create system prompt
echo -e "${BLUE}Step 2: Creating system prompt...${NC}"
SYSTEM_PROMPT_RESPONSE=$(curl -s -X POST "${API_BASE_URL}/projects/${PROJECT_ID}/prompts" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: ${TENANT_ID}" \
  -H "X-User-ID: ${USER_ID}" \
  -d "{
    \"content\": \"You are a helpful assistant designed to provide accurate and concise answers. Always be polite, maintain a professional tone, and provide well-structured responses. When you don't know an answer, admit it honestly rather than making things up.\"
  }")

SYSTEM_PROMPT_ID=$(echo "$SYSTEM_PROMPT_RESPONSE" | jq -r '.id')

if [ -z "$SYSTEM_PROMPT_ID" ] || [ "$SYSTEM_PROMPT_ID" = "null" ]; then
  echo -e "${RED}Failed to create system prompt: ${SYSTEM_PROMPT_RESPONSE}${NC}"
  exit 1
fi

echo -e "${GREEN}✓ System prompt created: ${SYSTEM_PROMPT_ID}${NC}\n"

# Step 3: Create 4 test cases
echo -e "${BLUE}Step 3: Creating 4 test cases...${NC}"

# Test case 1
TC1_RESPONSE=$(curl -s -X POST "${API_BASE_URL}/projects/${PROJECT_ID}/test-cases" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: ${TENANT_ID}" \
  -H "X-User-ID: ${USER_ID}" \
  -d "{
    \"input_prompt\": \"What is artificial intelligence? Briefly explain in 2-3 sentences.\",
    \"expected_output\": \"Artificial intelligence (AI) refers to computer systems designed to perform tasks that typically require human intelligence. These tasks include learning from experience, understanding natural language, recognizing patterns, making decisions, and solving problems.\"
  }")
TC1_ID=$(echo "$TC1_RESPONSE" | jq -r '.id')
echo -e "${GREEN}  ✓ Test case 1: Explaining AI${NC}"

# Test case 2
TC2_RESPONSE=$(curl -s -X POST "${API_BASE_URL}/projects/${PROJECT_ID}/test-cases" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: ${TENANT_ID}" \
  -H "X-User-ID: ${USER_ID}" \
  -d "{
    \"input_prompt\": \"Calculate the total cost of 5 items at $12.99 each, including 8% sales tax.\",
    \"expected_output\": \"The total cost is $69.88. Here's the breakdown:\\n\\nItem price: $12.99\\nSubtotal: $12.99 × 5 = $64.95\\nSales tax (8%): $64.95 × 0.08 = $5.20\\nTotal: $64.95 + $5.20 = $69.88\\n\\nTotal cost: $69.88\"
  }")
TC2_ID=$(echo "$TC2_RESPONSE" | jq -r '.id')
echo -e "${GREEN}  ✓ Test case 2: Math calculation${NC}"

# Test case 3
TC3_RESPONSE=$(curl -s -X POST "${API_BASE_URL}/projects/${PROJECT_ID}/test-cases" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: ${TENANT_ID}" \
  -H "X-User-ID: ${USER_ID}" \
  -d "{
    \"input_prompt\": \"Write a professional email response to the following customer complaint:\\n\\nDear Support Team,\\n\\nI purchased your product two weeks ago and it has been completely broken ever since. I expected better quality from your company.\",\"expected_output\": \"\\n\\nSubject: Re: Your Recent Purchase - Product Issue\\n\\nDear Customer,\\n\\nThank you for reaching out to us, and we sincerely apologize for the experience you've had with our product.\\n\\nWe take product quality very seriously, and we're genuinely sorry this item did not meet your expectations.\\n\\nTo resolve this issue, we'd like to offer you a full refund or replacement at your convenience. Please reply to this email with your preference, and our team will process it within 24-48 hours.\\n\\nIf you have any additional questions or concerns, please don't hesitate to contact us again.\\n\\nBest regards,\\n[Your Company Name] Customer Support Team\"
  }")
TC3_ID=$(echo "$TC3_RESPONSE" | jq -r '.id')
echo -e "${GREEN}  ✓ Test case 3: Professional email writing${NC}"

# Test case 4
TC4_RESPONSE=$(curl -s -X POST "${API_BASE_URL}/projects/${PROJECT_ID}/test-cases" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: ${TENANT_ID}" \
  -H "X-User-ID: ${USER_ID}" \
  -d "{
    \"input_prompt\": \"Explain what a blockchain is and why it's important for cryptocurrency. Use simple terms that a non-technical person would understand.\",\"expected_output\": \"\\n\\nA blockchain is essentially a digital ledger or record-keeping system. Imagine a shared spreadsheet that is shared across many computers - when one person makes an entry, it is instantly visible to everyone in the network.\\n\\nBlockchain is important for cryptocurrency because:\\n\\n1. **Transparency**: Everyone can see all transactions, so there's no hidden information\\n2. **Security**: Each entry is linked to the previous one, making it very difficult to alter or hack\\n3. **Decentralization**: No single company or person controls it - it belongs to everyone in the network\\n4. **Trust**: Since it can't be changed after the fact, people trust it without needing a middleman\\n\\nThis technology forms the foundation of cryptocurrencies like Bitcoin and Ethereum.\"
  }")
TC4_ID=$(echo "$TC4_RESPONSE" | jq -r '.id')
echo -e "${GREEN}  ✓ Test case 4: Blockchain explanation${NC}"

echo -e "\n${GREEN}All mock test data created successfully!${NC}\n"
echo -e "Project: ${BLUE}${PROJECT_ID}${NC}"
echo -e "System Prompt: ${BLUE}${SYSTEM_PROMPT_ID}${NC}"
echo -e "Test Cases: ${BLUE}${TC1_ID}, ${TC2_ID}, ${TC3_ID}, ${TC4_ID}${NC}"
echo ""
echo -e "Tip: To start an evaluation, use the evaluation creation endpoint with these IDs."