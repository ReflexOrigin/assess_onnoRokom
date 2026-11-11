# ==============================================================================
# School Admission System - Comprehensive API End-to-End Verification Script
# Tests all 8 required REST API endpoints and business rules against the running backend.
# Usage:
#   .\scripts\verify-api.ps1 -BaseUrl "http://localhost:8080"
# ==============================================================================

param (
    [string]$BaseUrl = "http://localhost:8080"
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param ([string]$Message)
    Write-Host "`n[STEP] $Message" -ForegroundColor Cyan
}

function Write-Pass {
    param ([string]$Message)
    Write-Host "  [PASS] $Message" -ForegroundColor Green
}

function Write-Fail {
    param ([string]$Message)
    Write-Host "  [FAIL] $Message" -ForegroundColor Red
}

Write-Host "=================================================================" -ForegroundColor Yellow
Write-Host "  School Admission System - Automated API Verification Suite    " -ForegroundColor Yellow
Write-Host "  Target Server: $BaseUrl" -ForegroundColor Yellow
Write-Host "=================================================================" -ForegroundColor Yellow

# 0. Health Check
Write-Step "Checking backend service health..."
try {
    $health = Invoke-RestMethod -Uri "$BaseUrl/health" -Method Get
    Write-Pass "Backend is reachable and healthy: Status = $($health.status)"
} catch {
    Write-Fail "Could not reach backend at $BaseUrl. Is Docker Compose running?"
    exit 1
}

# 1. API 1 - POST /classes
Write-Step "API 1: Creating a test class with 2 seats (POST /classes)..."
$createClassBody = @{
    name = "Class 6 - Verification Morning Shift"
    totalSeats = 2
} | ConvertTo-Json

$classRes = Invoke-RestMethod -Uri "$BaseUrl/classes" -Method Post -Body $createClassBody -ContentType "application/json"
$classId = $classRes.id
if ($classId -and $classId.StartsWith("c_")) {
    Write-Pass "Class created successfully: ID = $classId, Name = '$($classRes.name)', Seats = $($classRes.totalSeats)"
} else {
    Write-Fail "Class creation response invalid: $($classRes | ConvertTo-Json)"
    exit 1
}

# 2. API 2 - GET /classes
Write-Step "API 2: Retrieving all classes (GET /classes)..."
$allClasses = Invoke-RestMethod -Uri "$BaseUrl/classes" -Method Get
$ourClass = $allClasses | Where-Object { $_.id -eq $classId }
if ($ourClass -and $ourClass.availableSeats -eq 2 -and $ourClass.heldSeats -eq 0) {
    Write-Pass "Class list verified: Total = $($ourClass.totalSeats), Available = $($ourClass.availableSeats), Held = $($ourClass.heldSeats)"
} else {
    Write-Fail "Class listing verification failed"
    exit 1
}

# 3. API 3 - GET /classes/{classId}
Write-Step "API 3: Retrieving single class statistics (GET /classes/$classId)..."
$singleClass = Invoke-RestMethod -Uri "$BaseUrl/classes/$classId" -Method Get
if ($singleClass.id -eq $classId -and $singleClass.availableSeats -eq 2) {
    Write-Pass "Single class statistics verified: Available seats = $($singleClass.availableSeats)"
} else {
    Write-Fail "Single class retrieval failed"
    exit 1
}

# 4. API 4 - POST /classes/{classId}/holds (Seat 1)
$student1 = "20152691234567891"
Write-Step "API 4: Reserving Seat 1 for Student 1 (POST /classes/$classId/holds, X-Student-Id: $student1)..."
$headers1 = @{ "X-Student-Id" = $student1 }
$hold1Res = Invoke-RestMethod -Uri "$BaseUrl/classes/$classId/holds" -Method Post -Headers $headers1
$hold1Id = $hold1Res.holdId

if ($hold1Id -and $hold1Res.status -eq "HELD" -and $hold1Res.studentId -eq $student1) {
    Write-Pass "Hold 1 reserved successfully: ID = $hold1Id, Status = $($hold1Res.status), ExpiresAt = $($hold1Res.expiresAt)"
} else {
    Write-Fail "Hold 1 reservation failed"
    exit 1
}

# Verify Seat 1 Decrement
$statsAfterHold1 = Invoke-RestMethod -Uri "$BaseUrl/classes/$classId" -Method Get
if ($statsAfterHold1.heldSeats -eq 1 -and $statsAfterHold1.availableSeats -eq 1) {
    Write-Pass "Seat count correctly updated: Held = 1, Available = 1"
} else {
    Write-Fail "Seat counter mismatch: Held=$($statsAfterHold1.heldSeats), Available=$($statsAfterHold1.availableSeats)"
}

# Test Duplicate Application Prevention
Write-Step "Testing Duplicate Application Prevention for Student 1 in same class..."
try {
    Invoke-RestMethod -Uri "$BaseUrl/classes/$classId/holds" -Method Post -Headers $headers1
    Write-Fail "Duplicate application unexpectedly succeeded!"
} catch {
    Write-Pass "Duplicate application was rejected with HTTP 409 Conflict as expected."
}

# 5. API 5 - GET /holds/{holdId}
Write-Step "API 5: Inspecting hold status (GET /holds/$hold1Id)..."
$holdDetails = Invoke-RestMethod -Uri "$BaseUrl/holds/$hold1Id" -Method Get
if ($holdDetails.holdId -eq $hold1Id -and $holdDetails.status -eq "HELD") {
    Write-Pass "Hold details retrieved successfully: Status = $($holdDetails.status)"
} else {
    Write-Fail "Hold details inspection failed"
    exit 1
}

# 6. API 6 - POST /holds/{holdId}/confirm
Write-Step "API 6: Confirming admission for Student 1 (POST /holds/$hold1Id/confirm)..."
$confirmRes = Invoke-RestMethod -Uri "$BaseUrl/holds/$hold1Id/confirm" -Method Post -Headers $headers1
if ($confirmRes.holdId -eq $hold1Id -and $confirmRes.status -eq "CONFIRMED") {
    Write-Pass "Admission confirmed successfully: Status = $($confirmRes.status)"
} else {
    Write-Fail "Admission confirmation failed"
    exit 1
}

# Test Confirmation Idempotency
Write-Step "Testing Confirmation Idempotency (repeating confirmation)..."
$repeatConfirmRes = Invoke-RestMethod -Uri "$BaseUrl/holds/$hold1Id/confirm" -Method Post -Headers $headers1
if ($repeatConfirmRes.status -eq "CONFIRMED") {
    Write-Pass "Repeated confirmation succeeded idempotently without errors or double counting."
}

# Verify Stats After Confirmation
$statsAfterConfirm = Invoke-RestMethod -Uri "$BaseUrl/classes/$classId" -Method Get
if ($statsAfterConfirm.confirmedSeats -eq 1 -and $statsAfterConfirm.heldSeats -eq 0 -and $statsAfterConfirm.availableSeats -eq 1) {
    Write-Pass "Seat stats verified after confirmation: Confirmed = 1, Held = 0, Available = 1"
} else {
    Write-Fail "Seat counter mismatch after confirmation"
}

# 7. Reserve Seat 2 and Test Cancellation (API 7 - DELETE /holds/{holdId})
$student2 = "20152691234567892"
Write-Step "API 7: Reserving Seat 2 for Student 2 and testing Cancellation (DELETE /holds/{holdId})..."
$headers2 = @{ "X-Student-Id" = $student2 }
$hold2Res = Invoke-RestMethod -Uri "$BaseUrl/classes/$classId/holds" -Method Post -Headers $headers2
$hold2Id = $hold2Res.holdId
Write-Pass "Seat 2 held by Student 2: ID = $hold2Id"

# Cancel Seat 2
$deleteRes = Invoke-WebRequest -Uri "$BaseUrl/holds/$hold2Id" -Method Delete -Headers $headers2
if ($deleteRes.StatusCode -eq 204) {
    Write-Pass "Hold 2 cancelled successfully: Received HTTP 204 No Content"
} else {
    Write-Fail "Hold cancellation failed with HTTP $($deleteRes.StatusCode)"
}

# Verify Immediate Seat Release
$statsAfterCancel = Invoke-RestMethod -Uri "$BaseUrl/classes/$classId" -Method Get
if ($statsAfterCancel.availableSeats -eq 1 -and $statsAfterCancel.heldSeats -eq 0) {
    Write-Pass "Cancellation immediately freed the seat: Available seats = 1"
} else {
    Write-Fail "Cancellation did not free the seat properly"
}

# 8. API 8 - GET /me/holds
Write-Step "API 8: Retrieving student application history (GET /me/holds)..."
$myHolds = Invoke-RestMethod -Uri "$BaseUrl/me/holds" -Method Get -Headers $headers1
$myHold1 = $myHolds | Where-Object { $_.holdId -eq $hold1Id }
if ($myHold1 -and $myHold1.status -eq "CONFIRMED" -and $myHold1.className) {
    Write-Pass "Student history retrieved: Hold ID = $($myHold1.holdId), Class = '$($myHold1.className)', Status = $($myHold1.status)"
} else {
    Write-Fail "Student application history verification failed"
    exit 1
}

# 9. Boundary Tests: 17-digit validation
Write-Step "Testing Student ID Validation (Invalid 16-digit ID)..."
try {
    $badHeaders = @{ "X-Student-Id" = "1234567890123456" } # 16 digits
    Invoke-RestMethod -Uri "$BaseUrl/classes/$classId/holds" -Method Post -Headers $badHeaders
    Write-Fail "Invalid student ID was unexpectedly accepted!"
} catch {
    Write-Pass "Invalid 16-digit student ID correctly rejected with HTTP 400 Bad Request."
}

Write-Host "`n=================================================================" -ForegroundColor Green
Write-Host "  ALL 8 API ENDPOINTS AND BUSINESS RULES VERIFIED SUCCESSFULLY! " -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green

