-- =============================================================================
-- School Admission System - Initial Schema Migration
-- =============================================================================

CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL,
    CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId")
);

START TRANSACTION;

-- Table: AdmissionClasses
CREATE TABLE IF NOT EXISTS "AdmissionClasses" (
    "Id" character varying(50) NOT NULL,
    "Name" character varying(200) NOT NULL,
    "TotalSeats" integer NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_AdmissionClasses" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_AdmissionClass_TotalSeats_Positive" CHECK ("TotalSeats" > 0)
);

-- Table: AdmissionHolds
CREATE TABLE IF NOT EXISTS "AdmissionHolds" (
    "Id" character varying(50) NOT NULL,
    "ClassId" character varying(50) NOT NULL,
    "StudentId" character varying(17) NOT NULL,
    "Status" character varying(20) NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "ExpiresAt" timestamp with time zone NOT NULL,
    "ConfirmedAt" timestamp with time zone NULL,
    "CancelledAt" timestamp with time zone NULL,
    CONSTRAINT "PK_AdmissionHolds" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_AdmissionHolds_AdmissionClasses_ClassId" FOREIGN KEY ("ClassId") 
        REFERENCES "AdmissionClasses" ("Id") ON DELETE RESTRICT
);

-- Performance & Query Indexes
CREATE INDEX IF NOT EXISTS "IX_AdmissionHolds_ClassId_Status" 
    ON "AdmissionHolds" ("ClassId", "Status");

CREATE INDEX IF NOT EXISTS "IX_AdmissionHolds_StudentId" 
    ON "AdmissionHolds" ("StudentId");

CREATE INDEX IF NOT EXISTS "IX_AdmissionHolds_ExpiresAt_Status" 
    ON "AdmissionHolds" ("ExpiresAt", "Status");

-- Uniqueness Constraint: A student may have at most ONE active (HELD) or CONFIRMED hold per class
CREATE UNIQUE INDEX IF NOT EXISTS "IX_AdmissionHolds_ClassId_StudentId_ActiveUnique" 
    ON "AdmissionHolds" ("ClassId", "StudentId") 
    WHERE "Status" IN ('HELD', 'CONFIRMED');

-- Record migration in EF history
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261109000001_InitialCreate', '8.0.10')
ON CONFLICT ("MigrationId") DO NOTHING;

COMMIT;

