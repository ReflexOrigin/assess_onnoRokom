# AI_USAGE.md

## 1. Tools Used

I used **Gemini 3.8 Flash** and **Claude Opus 4.6** for planning, code generation, debugging, refactoring, and test setup.

AI assisted with the implementation, but I reviewed the code, investigated issues, and tested the application myself.

## 2. Where AI Was Used

- **Planning:** Breaking down the assignment, designing reservation states (`HELD`, `CONFIRMED`, `EXPIRED`, `CANCELLED`), and defining seat allocation rules.
- **Backend:** ASP.NET Core 8 APIs, EF Core models and migrations, PostgreSQL transactions, and concurrency control using `SELECT ... FOR UPDATE`.
- **Frontend:** React, TypeScript, Vite, API integration, student identification, and reservation countdowns.
- **Infrastructure:** Dockerfiles, Docker Compose, PostgreSQL configuration, and multi-instance setup.
- **Testing:** xUnit tests covering reservations, expiration, duplicate applications, and concurrent requests.

## 3. AI Mistakes and How I Fixed Them

### Application Logic

**1. Expired holds were still occupying seats.**

I found that the availability calculation counted all `HELD` records, even after expiration. I corrected the query to count only holds where `ExpiresAt > now`, so seat availability no longer depends on background cleanup.

**2. Inconsistent locking created a deadlock risk.**

During code review, I noticed that some operations locked hold records before class records, while others did the opposite. I standardized the transaction order to lock the class first.

**3. Repeated confirmation was not handled correctly.**

The initial confirmation logic did not account for already confirmed applications. I made confirmation idempotent, so repeated requests return `CONFIRMED` without changing the seat count.

**4. Students could not reapply after expiration.**

An expired hold could remain marked `HELD` until cleanup, causing a conflict with the partial unique index on `(ClassId, StudentId)`. I updated `CreateHoldAsync` to expire old reservations before inserting new ones and added the test `ExpiredHold_AllowsSameStudentToReapplyForSameClass`.

### Environment and Deployment

**5. The browser could not reach the Backend.**

The frontend initially used `http://localhost:8080`, which works inside Docker but not from the browser. I fixed this using runtime configuration through `env-config.js`.

**6. Docker builds failed because of Windows build artifacts.**

The build failed with `NETSDK1064` because local `bin/obj` files were copied into the Linux container. After examining the build error, I added `.dockerignore` files and corrected the restore process.

**7. The frontend container failed to start.**

The Alpine container could not execute `docker-entrypoint.sh` because of Windows CRLF line endings. I added line-ending conversion in the Dockerfile and `.gitattributes` to enforce LF for shell scripts.

**8. Running the backend locally required PostgreSQL.**

Running `dotnet run` without an active PostgreSQL server caused startup failures. I added an EF Core InMemory fallback for local development. This is only a convenience for basic testing; PostgreSQL is required to verify actual transaction and concurrency behavior.

### UI Improvements

The initial UI placed student and administrator operations on the same page. After reviewing the workflow, I separated them into dedicated Student and Admin portals to improve usability.

## 4. Verification

I reviewed the generated code against the assignment requirements and tested the implementation.

- All **18 xUnit tests passed** during the Docker container build.
- PostgreSQL 16 was used for concurrency verification.
- The 50-request concurrent stress test (`MandatoryTest3_ConcurrentHoldRequests_NeverOversellsSeats`) passed.
- Docker build and container startup issues were resolved.

## 5. Known Limitation

The Admin login (`admin/admin`) is a frontend-only demonstration gate. The class creation API remains accessible without server-side authentication, as the assignment does not require a complete authentication system.

AI helped with development, but I was responsible for reviewing its output, identifying mistakes, applying corrections, and verifying the final implementation.
