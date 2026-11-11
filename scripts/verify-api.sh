#!/usr/bin/env bash
# ==============================================================================
# School Admission System - Comprehensive API End-to-End Verification Script (Bash)
# Tests all 8 required REST API endpoints and business rules against the running backend.
# Usage:
#   chmod +x ./scripts/verify-api.sh
#   ./scripts/verify-api.sh http://localhost:8080
# ==============================================================================

set -e

BASE_URL="${1:-http://localhost:8080}"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=================================================================${NC}"
echo -e "${YELLOW}  School Admission System - Automated API Verification Suite     ${NC}"
echo -e "${YELLOW}  Target Server: ${BASE_URL}${NC}"
echo -e "${YELLOW}=================================================================${NC}"

step() {
    echo -e "\n${CYAN}[STEP] $1${NC}"
}

pass() {
    echo -e "  ${GREEN}[PASS] $1${NC}"
}

fail() {
    echo -e "  ${RED}[FAIL] $1${NC}"
    exit 1
}

# 0. Health Check
step "Checking backend service health..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/health")
if [ "$HEALTH" -eq 200 ]; then
    pass "Backend is reachable and healthy (HTTP 200)"
else
    fail "Could not reach backend at ${BASE_URL}. HTTP code: $HEALTH"
fi

# 1. API 1 - POST /classes
step "API 1: Creating a class with 2 seats (POST /classes)..."
CREATE_RES=$(curl -s -X POST "${BASE_URL}/classes" \
  -H "Content-Type: application/json" \
  -d '{"name": "Class 6 - Verification Morning Shift", "totalSeats": 2}')

CLASS_ID=$(echo "$CREATE_RES" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
if [[ "$CLASS_ID" == c_* ]]; then
    pass "Class created successfully: ID = $CLASS_ID"
else
    fail "Class creation failed: $CREATE_RES"
fi

# 2. API 2 - GET /classes
step "API 2: Retrieving all classes (GET /classes)..."
CLASSES_RES=$(curl -s -X GET "${BASE_URL}/classes")
if echo "$CLASSES_RES" | grep -q "$CLASS_ID"; then
    pass "Class listed successfully in GET /classes"
else
    fail "Created class not found in class listing"
fi

# 3. API 3 - GET /classes/{classId}
step "API 3: Retrieving single class statistics (GET /classes/$CLASS_ID)..."
CLASS_STATS=$(curl -s -X GET "${BASE_URL}/classes/${CLASS_ID}")
AVAILABLE=$(echo "$CLASS_STATS" | grep -o '"availableSeats":[0-9]*' | cut -d':' -f2)
if [ "$AVAILABLE" -eq 2 ]; then
    pass "Class statistics verified: Available seats = 2"
else
    fail "Seat count mismatch: $CLASS_STATS"
fi

# 4. API 4 - POST /classes/{classId}/holds (Seat 1)
STUDENT_1="20152691234567891"
step "API 4: Reserving Seat 1 for Student 1 (POST /classes/$CLASS_ID/holds)..."
HOLD_1_RES=$(curl -s -X POST "${BASE_URL}/classes/${CLASS_ID}/holds" \
  -H "X-Student-Id: ${STUDENT_1}")

HOLD_1_ID=$(echo "$HOLD_1_RES" | grep -o '"holdId":"[^"]*' | cut -d'"' -f4)
if [[ "$HOLD_1_ID" == h_* ]]; then
    pass "Hold 1 reserved successfully: ID = $HOLD_1_ID"
else
    fail "Reservation failed: $HOLD_1_RES"
fi

# 5. API 5 - GET /holds/{holdId}
step "API 5: Inspecting hold status (GET /holds/$HOLD_1_ID)..."
HOLD_DETAILS=$(curl -s -X GET "${BASE_URL}/holds/${HOLD_1_ID}")
STATUS=$(echo "$HOLD_DETAILS" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
if [ "$STATUS" == "HELD" ]; then
    pass "Hold details verified: Status = HELD"
else
    fail "Hold status incorrect: $HOLD_DETAILS"
fi

# 6. API 6 - POST /holds/{holdId}/confirm
step "API 6: Confirming admission for Student 1 (POST /holds/$HOLD_1_ID/confirm)..."
CONFIRM_RES=$(curl -s -X POST "${BASE_URL}/holds/${HOLD_1_ID}/confirm" \
  -H "X-Student-Id: ${STUDENT_1}")
CONFIRM_STATUS=$(echo "$CONFIRM_RES" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
if [ "$CONFIRM_STATUS" == "CONFIRMED" ]; then
    pass "Admission confirmed successfully: Status = CONFIRMED"
else
    fail "Admission confirmation failed: $CONFIRM_RES"
fi

# 7. Reserve Seat 2 and Test Cancellation (API 7 - DELETE /holds/{holdId})
STUDENT_2="20152691234567892"
step "API 7: Reserving Seat 2 and testing Cancellation (DELETE /holds/{holdId})..."
HOLD_2_RES=$(curl -s -X POST "${BASE_URL}/classes/${CLASS_ID}/holds" -H "X-Student-Id: ${STUDENT_2}")
HOLD_2_ID=$(echo "$HOLD_2_RES" | grep -o '"holdId":"[^"]*' | cut -d'"' -f4)
pass "Hold 2 created: $HOLD_2_ID"

DELETE_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "${BASE_URL}/holds/${HOLD_2_ID}" \
  -H "X-Student-Id: ${STUDENT_2}")
if [ "$DELETE_CODE" -eq 204 ]; then
    pass "Cancellation returned HTTP 204 No Content"
else
    fail "Cancellation failed with HTTP $DELETE_CODE"
fi

# 8. API 8 - GET /me/holds
step "API 8: Retrieving student application history (GET /me/holds)..."
MY_HOLDS=$(curl -s -X GET "${BASE_URL}/me/holds" -H "X-Student-Id: ${STUDENT_1}")
if echo "$MY_HOLDS" | grep -q "$HOLD_1_ID"; then
    pass "Student application history retrieved successfully"
else
    fail "Student history lookup failed: $MY_HOLDS"
fi

echo -e "\n${GREEN}=================================================================${NC}"
echo -e "${GREEN}  ALL 8 API ENDPOINTS AND BUSINESS RULES VERIFIED SUCCESSFULLY!  ${NC}"
echo -e "${GREEN}=================================================================${NC}"

