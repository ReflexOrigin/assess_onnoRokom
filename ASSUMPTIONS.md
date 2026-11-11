# ASSUMPTIONS.md
Some implementation details and edge cases were left open. 

The following assumptions and decisions were made to complete the system while keeping the behavior consistent with the given requirements.

## 1. Student Session Persistence

**Not specified:** How the student identity should be retained across browser sessions.

**Decision:** Store the selected 17-digit birth registration number in browser `localStorage`.

**Reason:** Students can refresh or reopen the application without entering their number again. Application records remain stored in the database.

## 2. Administration Access

**Not specified:** How administrative operations should be separated from student-facing operations.

**Decision:** Create separate Student and Administration portals. The Administration portal uses a demonstration login (`admin/admin`) with session state stored in `sessionStorage`.

**Reason:** Separating the interfaces makes the workflows easier to understand and prevents administrative controls from appearing in the student portal.

The login is only a frontend access gate. The backend class creation endpoint remains publicly accessible to preserve the required API contract. This is not production-grade authentication.

## 3. Class Configuration

**Not specified:** Whether existing classes and their seat capacities can be edited or deleted after creation.

**Decision:** Support class creation and viewing without introducing capacity editing or class deletion.

**Reason:** The assignment defines API endpoints for creating and retrieving classes but does not provide update or deletion contracts. Avoiding these operations also prevents complications with existing reservations.

## 4. First-Come, First-Served Ordering

**Not specified:** How the system should determine which request arrived first when many applications are submitted simultaneously.

**Decision:** Process competing reservations according to the order in which their transactions acquire the relevant PostgreSQL class-row lock.

**Reason:** Browser click times and network arrival times cannot provide a reliable global ordering. Database locking offers a consistent allocation mechanism and prevents overselling, although it does not guarantee strict browser-click ordering.

## 5. Database Concurrency Control

**Not specified:** The transaction and locking mechanism required to protect seat allocation.

**Decision:** Use PostgreSQL transactions with `SELECT ... FOR UPDATE` on the relevant class record. Seat-mutating operations follow a consistent class-first locking order.

A partial unique index on `(ClassId, StudentId)` also prevents duplicate active or confirmed applications.

**Reason:** Application-level locks cannot coordinate multiple backend instances. Database transactions and constraints provide shared concurrency protection and reduce the risk of inconsistent seat allocation.

## 6. Re-Application After Expiration or Cancellation

**Not specified:** Whether a student may apply again to the same class after an earlier application expires or is cancelled.

**Decision:** Allow re-application if the previous reservation is `EXPIRED` or `CANCELLED` and seats are available. A `CONFIRMED` application continues to prevent another application for that class.

**Reason:** An expired or cancelled reservation no longer occupies a seat. Preventing another attempt would unnecessarily restrict the student.

Expired records are finalized during reservation creation to avoid conflicts with the database's partial unique index.

## 7. Repeated Requests and Invalid State Changes

**Not specified:** The exact API behavior for repeated confirmations, repeated cancellations, and attempts to modify completed applications.

**Decision:**
- Reconfirming an already confirmed application returns `200` without changing seat counts.
- Cancelling an already cancelled application returns `204`.
- Confirmed applications cannot be cancelled through the hold cancellation endpoint.
- Expired or cancelled applications cannot be confirmed.
- Invalid state transitions return `409 Conflict`.

**Reason:** These rules make repeated requests predictable and prevent duplicate confirmations or inconsistent application states.

## 8. Reservation Expiration Implementation

**Not specified:** The technical mechanism and cleanup frequency for expired reservations.

**Decision:** Use two complementary approaches:

1. Evaluate expiration timestamps during relevant API operations so expired reservations immediately stop occupying capacity.
2. Run `HoldExpirationBackgroundService` every five seconds to update expired reservation records.

**Reason:** Availability must remain correct even when background cleanup has not yet executed. Periodic cleanup keeps stored statuses up to date, while immediate checks protect correctness.

## 9. Time Handling

**Not specified:** Which clock and timestamp representation should govern reservation deadlines.

**Decision:** Store timestamps in UTC and use backend UTC time to validate expiration and confirmation. Return timestamps in ISO 8601 format.

**Reason:** Client devices may have incorrect clocks or different time zones. The backend must make the final decision about reservation validity.

## 10. Error Response Format

**Not specified:** A standard JSON structure for API failures beyond the required endpoint contracts and specified status codes.

**Decision:** Return a consistent error object containing `code` and `message`.

Example:

```json
{
  "code": "NO_SEATS_AVAILABLE",
  "message": "No seats are currently available for this class."
}
```

**Reason:** Consistent errors simplify frontend handling and provide understandable feedback for failed operations.

## 11. Multiple Backend Instances

**Not specified:** The exact approach for maintaining reservation consistency when two backend processes share one database.

**Decision:** Use PostgreSQL as the shared concurrency-control point, with row-level locking rather than process-local synchronization.

**Reason:** This allows multiple backend instances to handle concurrent requests without independently allocating the same remaining capacity. It also supports the assignment's optional multi-instance testing scenario.

## 12. Local Development Database

**Not specified:** How the application should behave when PostgreSQL is unavailable during direct local development.

**Decision:** Provide an EF Core InMemory fallback when a local PostgreSQL connection cannot be established.

**Reason:** This allows basic application development and UI checks without a separately installed PostgreSQL server.

**Limitation:** InMemory does not provide PostgreSQL's row-level locking, transaction semantics, or relational constraints. It must not be used to validate concurrency guarantees. The required Docker deployment and database concurrency tests use PostgreSQL.