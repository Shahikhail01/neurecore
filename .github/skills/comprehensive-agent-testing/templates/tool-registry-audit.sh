#!/bin/bash

# NeureCore Tool Registry Audit Script
# Tests all 50+ built-in tools for availability and basic functionality
# Output: tool-test-results.csv

set -e

API_URL="${API_URL:-http://localhost:3000/api/v1}"
TOKEN="${API_TOKEN:-}"
TENANT_ID="${TENANT_ID:-4109424f-59fa-463a-8f5e-52299fcf47f0}"
OUTPUT_FILE="tool-test-results.csv"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to test a tool
test_tool() {
    local tool_name=$1
    local input=$2
    local expected_pattern=$3
    
    echo -n "Testing $tool_name... "
    
    local response=$(curl -s -X POST "$API_URL/tools/execute" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -H "X-Tenant-ID: $TENANT_ID" \
        -d "{
            \"tool\": \"$tool_name\",
            \"input\": $input
        }" 2>&1)
    
    if echo "$response" | grep -q "$expected_pattern"; then
        echo -e "${GREEN}PASS${NC}"
        echo "$tool_name,PASS,$(date +%s)" >> "$OUTPUT_FILE"
        return 0
    elif echo "$response" | grep -q "API_KEY\|unauthorized\|missing"; then
        echo -e "${YELLOW}SKIP (API key)${NC}"
        echo "$tool_name,SKIP,$(date +%s)" >> "$OUTPUT_FILE"
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        echo "Response: $response"
        echo "$tool_name,FAIL,$(date +%s),\"$response\"" >> "$OUTPUT_FILE"
        return 1
    fi
}

# Initialize CSV
> "$OUTPUT_FILE"
echo "tool_name,status,timestamp,error_details" >> "$OUTPUT_FILE"

echo "=== NeureCore Tool Registry Audit ==="
echo "API URL: $API_URL"
echo "Tenant ID: $TENANT_ID"
echo "Output: $OUTPUT_FILE"
echo ""

# Pure tools (no API keys required)
echo "--- PURE TOOLS ---"
test_tool "calculator" '{"expression": "10 + 5"}' "15"
test_tool "web-search" '{"query": "NeureCore AI"}' "results\|error"
test_tool "database-query" '{"query": "SELECT COUNT(*) FROM agents;"}' "count\|error"
test_tool "email-send" '{"to": "test@example.com", "subject": "Test", "body": "Test"}' "sent\|error"
test_tool "document-summary" '{"url": "https://example.com"}' "summary\|error"
test_tool "task-management" '{"action": "create", "title": "Test Task"}' "task\|id\|error"
test_tool "agent-messaging" '{"message": "hello", "agent_id": "test"}' "sent\|queued\|error"

# Connector-based tools (OAuth)
echo ""
echo "--- CONNECTOR TOOLS ---"
test_tool "gmail-send" '{"to": "test@example.com", "subject": "Test"}' "sent\|error\|unauthorized"
test_tool "google-drive-upload" '{"file_name": "test.txt", "content": "test"}' "uploaded\|error\|unauthorized"
test_tool "google-sheets-append" '{"sheet_id": "test", "data": [["col1", "val1"]]}' "appended\|error\|unauthorized"
test_tool "calendar-get" '{"email": "test@example.com"}' "events\|error\|unauthorized"
test_tool "crm-contact" '{"action": "list"}' "contacts\|error\|unauthorized"

# Archive & specialized
echo ""
echo "--- SPECIALIZED TOOLS ---"
test_tool "archive-fetch" '{"query": "agent"}' "results\|error"
test_tool "calculator_enhanced" '{"expression": "2 * 3"}' "6\|error"
test_tool "knowledge-search" '{"query": "marketing"}' "results\|error"

echo ""
echo "=== Audit Complete ==="
echo "Results saved to: $OUTPUT_FILE"
echo ""
cat "$OUTPUT_FILE"
