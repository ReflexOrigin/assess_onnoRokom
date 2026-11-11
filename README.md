# School Admission System (বিদ্যালয় ভর্তি ব্যবস্থা)

[![ASP.NET Core](https://img.shields.io/badge/ASP.NET_Core-8.0-512BD4?logo=dotnet)](https://dotnet.microsoft.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.3-646CFF?logo=vite)](https://vitejs.dev/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://www.docker.com/)

A high-performance, concurrency-safe, fully Dockerized School Admission System built for the **Assistant Software Engineer recruitment assessment at Onnorokom Projukti Limited**.

The system implements **first-come, first-served admission seat reservations** with automated temporary seat holding, live countdown deadlines, simulated fee confirmation, dynamic expiration cleanup, and strict PostgreSQL row-level concurrency protection.

---

## Table of Contents

1. [Key Features](#key-features)
2. [Technology Stack](#technology-stack)
3. [System Architecture](#system-architecture)
4. [Concurrency & Invariant Protection](#concurrency--invariant-protection)
5. [Prerequisites](#prerequisites)
6. [Quick Start with Docker Compose](#quick-start-with-docker-compose)
7. [Environment Variables](#environment-variables)
8. [API Documentation (8 Mandatory Endpoints)](#api-documentation)
9. [Automated Testing](#automated-testing)
10. [Bonus: Multi-Instance Distributed Demonstration](#bonus-multi-instance-distributed-demonstration)
11. [Step-by-Step Manual Demonstration Walkthrough](#step-by-step-manual-demonstration-walkthrough)
12. [Troubleshooting](#troubleshooting)

---

## 1. Key Features

* **Strict Seat Invariants:** Ensures $\text{activeHeldSeats} + \text{confirmedSeats} \le \text{totalSeats}$ at all times. Never oversells seats, even under concurrent traffic spikes.
* **PostgreSQL Row-Level Locking:** Uses `SELECT ... FOR UPDATE` within database transactions to serialize seat reservations deterministically across multi-process or multi-container deployments.
* **Dual Expiration Engine:**
  * **Authoritative On-the-Fly Calculation:** API requests dynamically evaluate hold expiration timestamps against server UTC time. Seat capacity calculations never count expired holds as active, even before background cleanup executes.
  * **Background Cleanup Worker:** A lightweight ASP.NET Core `BackgroundService` executes an atomic conditional SQL update every 5 seconds to transition expired records to `EXPIRED`.
* **17-Digit Birth Registration Identity:** Pure string handling of national 17-digit birth registration numbers preserving leading zeros, enforced through the `X-Student-Id` header and persisted in `localStorage`.
* **Reactive React 18+ Interface:**
  * Global persistent student identity bar.
  * Admin class creation with instant example presets.
  * Real-time seat availability updates without browser reloads.
  * Application details screen featuring live ticking countdown timer (mm:ss).
  * Immediate seat release upon cancellation.
  * Persistent application history via `GET /me/holds`.
* **Zero Host Dependencies:** Fully containerized with multi-stage Docker builds and automated schema migrations.

---

## 2. Technology Stack

| Layer | Technology | Details |
|---|---|---|
| **Backend** | ASP.NET Core Web API (.NET 8) | C#, Layered Monolithic Architecture, Async I/O |
| **Database** | PostgreSQL 16 Alpine | Persistent volume storage, ACID transactions |
| **ORM** | Entity Framework Core 8 + Npgsql | Code-first migrations, Raw SQL row locking |
| **Frontend** | React 18.3 + TypeScript 5.4 | Functional components, custom hooks, typed API client |
| **Build Tool** | Vite 5.3 + Nginx Alpine | Fast HMR, optimized production SPA bundling |
| **Containerization** | Docker & Docker Compose | Multi-stage caching builds, automated container health checks |
| **Testing** | xUnit, ASP.NET Core WebApplicationFactory | Concurrency stress tests, lifecycle tests, boundary tests |

---

## 3. System Architecture

```
                       User Browser (Desktop / Mobile)
                                    │
                                    │ HTTP Requests
                                    ▼
                       ┌─────────────────────────┐
                       │   React 18 + Vite SPA   │  (Port 3000)
                       │     (Nginx Alpine)      │
                       └────────────┬────────────┘
                                    │
                                    │ REST over HTTP (JSON)
                                    │ Header: X-Student-Id
                                    ▼
                       ┌─────────────────────────┐
                       │   ASP.NET Core Web API  │  (Port 8080)
                       │   ├── Controllers       │
                       │   ├── Services          │
                       │   ├── BackgroundWorker  │
                       │   └── EF Core 8         │
                       └────────────┬────────────┘
                                    │
                                    │ Npgsql Connection Pool
                                    │ Row Locks: SELECT ... FOR UPDATE
                                    ▼
                       ┌─────────────────────────┐
                       │   PostgreSQL 16 DB      │  (Port 5432)
                       │   ├── AdmissionClasses  │
                       │   ├── AdmissionHolds    │
                       │   └── Partial Index     │
                       └─────────────────────────┘
```

---

## 4. Concurrency & Invariant Protection

### The Challenge
When 100 parents attempt to reserve the final remaining seat simultaneously, naive sequence logic (`read available -> check > 0 -> insert hold`) suffers from race conditions leading to negative availability and overselling.

### The Solution: PostgreSQL Row-Level Serialization
1. Every seat-modifying operation begins a database transaction with `ReadCommitted` isolation.
2. The transaction acquires an exclusive row lock on the target class row:
   ```csharp
   await _context.AdmissionClasses
       .FromSqlInterpolated($"SELECT * FROM \"AdmissionClasses\" WHERE \"Id\" = {classId} FOR UPDATE")
       .SingleOrDefaultAsync(ct);
   ```
3. Under the protection of the lock, active holds (`Status == 'HELD' && ExpiresAt > UtcNow`) and confirmed holds (`Status == 'CONFIRMED'`) are counted.
4. If $\text{availableSeats} \le 0$, the transaction rolls back immediately and returns HTTP `409 Conflict` (`NO_SEATS_AVAILABLE`).
5. A partial unique index at the schema level provides defense-in-depth:
   ```sql
   CREATE UNIQUE INDEX "IX_AdmissionHolds_ClassId_StudentId_ActiveUnique"
   ON "AdmissionHolds" ("ClassId", "StudentId")
   WHERE "Status" IN ('HELD', 'CONFIRMED');
   ```
6. Deadlocks are eliminated by enforcing **deterministic lock ordering**: every workflow locks the class row first.

---

## 5. Prerequisites

* [Docker](https://docs.docker.com/get-docker/) (v24.0 or newer)
* [Docker Compose](https://docs.docker.com/compose/) (v2.20 or newer)
* *Optional for local non-Docker development:* .NET 8 SDK, Node.js 20+, and PostgreSQL 16.

---

## 6. Quick Start with Docker Compose

### 1. Clone the repository
```bash
git clone <repository-url>
cd <repository-folder>
```

### 2. Configure Environment
```bash
cp .env.example .env
```

### 3. Build and Start All Services
```bash
docker compose up --build
```
* **Frontend UI:** `http://localhost:3000`
* **Backend API & Swagger:** `http://localhost:8080/swagger`
* **Automated Verification Script:**
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts/verify-api.ps1
  ```

---

## 6.1. Running Locally on Host (Without Docker)

You can also run both the backend and frontend directly on your local machine:

### Running the Backend:
```bash
# Option A: With local PostgreSQL (Host=localhost;Port=5432)
dotnet run --project backend/SchoolAdmission.Api

# Option B: Standalone mode without PostgreSQL (In-Memory database)
# PowerShell:
$env:USE_IN_MEMORY_DB="true"; dotnet run --project backend/SchoolAdmission.Api

# Bash / Linux / macOS:
USE_IN_MEMORY_DB=true dotnet run --project backend/SchoolAdmission.Api
```
* The backend automatically listens on `http://localhost:8080` (configured via `launchSettings.json`).
* Swagger documentation is available at `http://localhost:8080/swagger`.

### Running the Frontend:
```bash
cd frontend
npm install
npm run dev
```
* The frontend development server runs on `http://localhost:5173`.
* To run the frontend unit tests: `npm test`.

### 4. Access the Applications
* **Frontend Web Application:** [http://localhost:3000](http://localhost:3000)
* **Backend REST API:** [http://localhost:8080](http://localhost:8080)
* **Swagger API Documentation:** [http://localhost:8080/swagger](http://localhost:8080/swagger)
* **Health Check Endpoint:** [http://localhost:8080/health](http://localhost:8080/health)

### 5. Stopping the System
```bash
# Graceful stop preserving database data
docker compose down

# Stop and purge database volume (resets all data)
docker compose down -v
```

---

## 7. Environment Variables

| Variable | Default Value | Description |
|---|---|---|
| `POSTGRES_USER` | `postgres` | PostgreSQL superuser username |
| `POSTGRES_PASSWORD` | `postgres_secure_password_123` | PostgreSQL password |
| `POSTGRES_DB` | `school_admission` | PostgreSQL database name |
| `POSTGRES_PORT` | `5432` | Exposed PostgreSQL port on host |
| `BACKEND_PORT` | `8080` | Exposed ASP.NET Core API port on host |
| `HOLD_DURATION_SECONDS` | `600` | Seat reservation hold duration (seconds) |
| `FRONTEND_PORT` | `3000` | Exposed React frontend port on host |
| `VITE_API_BASE_URL` | `http://localhost:8080` | API URL accessed by the browser |

---

## 8. API Documentation

Base URL: `http://localhost:8080`

### 1. Create Class
* **Route:** `POST /classes`
* **Purpose:** School administrator creates a class with seat capacity.
* **Request Body:**
  ```json
  {
    "name": "Class 6 - Morning Shift",
    "totalSeats": 120
  }
  ```
* **Response:** HTTP `201 Created`
  ```json
  {
    "id": "c_a1b2c3d4e5",
    "name": "Class 6 - Morning Shift",
    "totalSeats": 120
  }
  ```

### 2. Get All Classes
* **Route:** `GET /classes`
* **Response:** HTTP `200 OK`
  ```json
  [
    {
      "id": "c_a1b2c3d4e5",
      "name": "Class 6 - Morning Shift",
      "totalSeats": 120,
      "heldSeats": 1,
      "confirmedSeats": 0,
      "availableSeats": 119
    }
  ]
  ```

### 3. Get Class by ID
* **Route:** `GET /classes/{classId}`
* **Response:** HTTP `200 OK` (or `404 Not Found`)

### 4. Reserve Seat (Create Hold)
* **Route:** `POST /classes/{classId}/holds`
* **Header:** `X-Student-Id: 20152691234567890` (17 digits)
* **Response:** HTTP `201 Created`
  ```json
  {
    "holdId": "h_f7g8h9j0k1l2",
    "classId": "c_a1b2c3d4e5",
    "studentId": "20152691234567890",
    "status": "HELD",
    "expiresAt": "2026-11-09T17:10:00Z"
  }
  ```
* **Conflict Responses:**
  * HTTP `409 Conflict` (`NO_SEATS_AVAILABLE`) when class is full.
  * HTTP `409 Conflict` (`DUPLICATE_APPLICATION`) when student already has an active/confirmed hold in this class.

### 5. Get Hold Details
* **Route:** `GET /holds/{holdId}`
* **Response:** HTTP `200 OK`
  ```json
  {
    "holdId": "h_f7g8h9j0k1l2",
    "classId": "c_a1b2c3d4e5",
    "status": "HELD",
    "expiresAt": "2026-11-09T17:10:00Z"
  }
  ```

### 6. Confirm Admission
* **Route:** `POST /holds/{holdId}/confirm`
* **Header:** `X-Student-Id: 20152691234567890`
* **Response:** HTTP `200 OK`
  ```json
  {
    "holdId": "h_f7g8h9j0k1l2",
    "status": "CONFIRMED"
  }
  ```
* **Rules:** Only the owning student can confirm. Expired holds return HTTP `409 Conflict` (`HOLD_EXPIRED`). Repeated confirmation is idempotent.

### 7. Cancel Hold
* **Route:** `DELETE /holds/{holdId}`
* **Header:** `X-Student-Id: 20152691234567890`
* **Response:** HTTP `204 No Content` (Empty body). Seat is immediately released.

### 8. Get Student Applications
* **Route:** `GET /me/holds`
* **Header:** `X-Student-Id: 20152691234567890`
* **Response:** HTTP `200 OK`
  ```json
  [
    {
      "holdId": "h_f7g8h9j0k1l2",
      "classId": "c_a1b2c3d4e5",
      "className": "Class 6 - Morning Shift",
      "status": "CONFIRMED",
      "expiresAt": "2026-11-09T17:10:00Z"
    }
  ]
  ```

---

## 9. Automated Testing

The automated test suite covers the three mandatory test cases and comprehensive lifecycle scenarios.

### Running Tests inside Docker Build:
The backend Dockerfile automatically executes the entire test suite during image compilation:
```dockerfile
RUN dotnet test "SchoolAdmission.Tests/SchoolAdmission.Tests.csproj" -c Release --no-restore --logger "console;verbosity=normal"
```

### Running Tests Locally with .NET SDK:
```bash
cd backend
dotnet test SchoolAdmission.Tests/SchoolAdmission.Tests.csproj --verbosity normal
```

### Key Tests Implemented:
1. `MandatoryTest1_SuccessfulReservation_DecreasesAvailableSeats`: Verifies 201 Created, status HELD, heldSeats + 1, availableSeats - 1.
2. `MandatoryTest2_ExpiredHold_ReleasesSeatAndRejectsConfirmation`: Verifies hold reports EXPIRED, confirm is rejected with 409, and released seat is acquired by another student without manual cleanup.
3. `MandatoryTest3_ConcurrentHoldRequests_NeverOversellsSeats`: Spawns 50 simultaneous concurrent hold requests for 5 seats. Verifies exactly 5 succeed, 45 fail with 409, and available seats never drop below 0.
4. `Confirmation_ValidHold_SucceedsAndIsIdempotent`: Verifies repeated confirmation does not double-count seats.
5. `Cancellation_ActiveHold_ReleasesSeatImmediately`: Verifies DELETE 204 immediately makes seat available.
6. `UnauthorizedStudent_CannotConfirmOrCancelHold`: Verifies 403 Forbidden when a student attempts to confirm or cancel another student's hold.
7. `InvalidStudentId_Returns400BadRequest`: Verifies 17-digit validation on boundary cases.

---

## 10. Bonus: Multi-Instance Distributed Demonstration

To demonstrate that the PostgreSQL locking design works across multiple separate backend processes:
```bash
docker compose -f docker-compose.multi-instance.yml up --build
```
* Backend Node 1: `http://localhost:8080`
* Backend Node 2: `http://localhost:8081`
* Both nodes concurrently process requests against the same PostgreSQL database without overselling.

---

## 11. Step-by-Step Manual Demonstration Walkthrough

Follow this 15-step procedure to evaluate the entire system:

1. **Start System:** Run `docker compose up --build` (or start locally using instructions in Section 6.1).
2. **Open Browser:** Navigate to `http://localhost:3000`.
3. **Register Class (Admin Portal):** Click *"School Admin Portal 🔐"*, sign in using username `admin` and password `admin`. In the Admin portal, select the *"Class 10 - Fast Test Class (2 seats)"* preset (or enter 2 seats manually), and click *"Register Class"*. Then click *"← Exit to Admission Portal"* to return to the student view.
4. **Set Student 1:** In the top blue identity bar, enter `20152691234567891` and click *"Set Student ID"*.
5. **Reserve Seat 1:** Navigate to *"Browse Classes"*, find the created class, and click *"Apply & Reserve Seat"*.
6. **Observe Live State:** The app transitions to *"Application Details"*, showing the active `HELD` badge and a live countdown timer ticking down from 10:00 (600s).
7. **Verify Class Count:** Switch to *"Browse Classes"* in another tab. Observe that Held seats = 1, Available seats = 1.
8. **Confirm Admission:** In the Application Details screen, click *"Pay Fee & Confirm Admission"*. Observe the status changes to `CONFIRMED`.
9. **Set Student 2:** In the top bar, click *"Change Student"*, enter `20152691234567892`, and save.
10. **Reserve Seat 2:** Under *"Browse Classes"*, click *"Apply & Reserve Seat"*.
11. **Verify Class Full:** Observe the class now shows Available seats = 0 and badge displays `FULL`. The Apply button is disabled.
12. **Set Student 3 & Attempt Hold:** Enter `20152691234567893`. The Apply button is disabled. Attempting via API returns HTTP 409 `NO_SEATS_AVAILABLE`.
13. **Test Cancellation:** Switch back to Student 2, open *"My Applications"*, click *"Manage"*, and click *"Cancel Reservation"*. The seat is immediately released and Available seats becomes 1.
14. **Test Expiration:** For a held seat, wait for the countdown to expire (or test with shorter `HOLD_DURATION_SECONDS=15`). Observe the status transitions to `EXPIRED`, confirmation is blocked, and the seat is returned to the pool.
15. **Verify Persistence:** Execute `docker compose down` and then `docker compose up`. Refresh the browser: all classes, applications, and confirmed seats remain intact.

---

## 12. Troubleshooting

* **Port 5432 or 8080 in use:** Stop existing local PostgreSQL or web servers, or customize `BACKEND_PORT` or `POSTGRES_PORT` in `.env`.
* **Database Connection Timeout on Boot:** The backend container includes automated migration retry logic with exponential backoff (`DbInitializer.cs`), waiting for PostgreSQL's health check before accepting traffic.
* **Reset Database:** To wipe all data and start fresh, run:
  ```bash
  docker compose down -v
  docker compose up --build
  ```

---

## License

This project was built for evaluation purposes for Onnorokom Projukti Limited.

