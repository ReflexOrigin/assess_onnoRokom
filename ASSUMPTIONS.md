# ASSUMPTIONS.md
Some implementation details and edge cases were left open. 
The following assumptions and decisions were made to complete the system while keeping the behavior consistent with the given requirements.

## 1. Student Session Persistence

The assignment doesn't mention how student identity should be maintained between visits. I decided to store the 17-digit birth registration number in `localStorage` so students don't have to enter it every time they refresh or reopen the application.

Application records are still stored in the database.

## 2. Administration Access

There were no specific instructions for admin authentication or how the admin and student interfaces should be organized.

I separated them into two portals to keep the workflows clear. For the admin portal, I added a simple login (`admin/admin`) and used `sessionStorage` to maintain the session.

This is only a frontend-level restriction, not actual backend authentication. I kept the class creation API publicly accessible so automated tests can use it without additional authentication steps.

## 3. Class Configuration

The assignment only provides APIs for creating and viewing classes. It doesn't mention updating or deleting them.

I kept class management limited to those operations. Allowing seat capacity changes after students have already applied would introduce additional cases that aren't covered in the requirements.

## 4. First-Come, First-Served Ordering

The assignment says admission should follow a first-come, first-served approach, but doesn't define how to determine request order when many students apply simultaneously.

I used the order in which requests acquire the PostgreSQL class-row lock.

This doesn't necessarily match the exact order students clicked Apply, since network and processing delays can vary. However, it allows requests to be handled safely without allocating more seats than available.

## 5. Database Concurrency Control

The assignment requires the system to handle simultaneous applications but leaves the concurrency mechanism open.

I chose PostgreSQL transactions with `SELECT ... FOR UPDATE` to lock the relevant class record during seat allocation. I also followed a consistent class-first locking order to reduce deadlock risks.

To prevent duplicate active or confirmed applications, I added a partial unique index on `(ClassId, StudentId)`.

I preferred database-level locking because application-level locks wouldn't be reliable if multiple backend instances were running.

## 6. Re-Application After Expiration or Cancellation

The assignment doesn't clarify whether students can apply again after their previous reservation expires or gets cancelled.

I allowed re-application in both cases, as long as seats are available. However, a student with an already confirmed admission cannot apply again to the same class.

I also made sure expired holds are updated before creating a new reservation to avoid conflicts with the database's unique index.

## 7. Repeated Requests and Invalid State Changes

Some edge cases around confirmation and cancellation weren't defined, so I handled them as follows:

- Confirming an already confirmed application returns `200` without changing the seat count.
- Cancelling an already cancelled application returns `204`.
- Confirmed applications cannot be cancelled through the hold cancellation API.
- Expired or cancelled applications cannot be confirmed.
- Invalid state changes return `409 Conflict`.

I chose these behaviors to keep repeated API requests predictable and avoid inconsistent reservation states.

## 8. Reservation Expiration

The assignment requires expired seats to become available again, but doesn't specify how expiration should be handled internally.

I used two approaches:

- **Immediate checks:** The API checks expiration timestamps when calculating availability or processing relevant requests. This prevents expired holds from occupying seats even before cleanup.
- **Background cleanup:** `HoldExpirationBackgroundService` runs every five seconds to update expired records in the database.

I used both because relying only on background cleanup could temporarily block available seats.

## 9. Time Handling

The assignment doesn't specify which time source or format should be used for reservation deadlines.

I used UTC for all timestamps and ISO 8601 for API responses. Expiration and confirmation are validated using backend time rather than the student's device clock.

This avoids issues caused by different time zones or incorrect device settings.

## 10. Error Response Format

The assignment defines the required API responses but doesn't provide a standard error response structure.

I used a consistent JSON format with an error `code` and `message`.

For example:

```json
{
  "code": "NO_SEATS_AVAILABLE",
  "message": "No seats are currently available for this class."
}
```

This makes errors easier to handle on the frontend and gives users clearer feedback.

## 11. Multiple Backend Instances

The assignment includes multi-instance concurrency as an optional bonus but doesn't specify how synchronization should work between instances.

I used PostgreSQL row-level locking rather than application-level synchronization. This allows separate backend instances to share the same database and coordinate seat allocation safely.

I also included a separate Docker Compose configuration for testing two backend instances.

## 12. Local Development Database

The assignment requires PostgreSQL but doesn't specify what should happen when running the backend locally without an active database connection.

I added an EF Core InMemory fallback to make local development and basic UI testing easier without setting up PostgreSQL separately.

However, InMemory doesn't support PostgreSQL's locking, transactions, or relational constraints in the same way. So I kept PostgreSQL as the required database for the Docker deployment and concurrency tests.