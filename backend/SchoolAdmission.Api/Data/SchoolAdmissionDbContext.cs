using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Api.Models;

namespace SchoolAdmission.Api.Data;

public class SchoolAdmissionDbContext : DbContext
{
    public SchoolAdmissionDbContext(DbContextOptions<SchoolAdmissionDbContext> options)
        : base(options)
    {
    }

    public DbSet<AdmissionClass> AdmissionClasses => Set<AdmissionClass>();
    public DbSet<AdmissionHold> AdmissionHolds => Set<AdmissionHold>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // AdmissionClass Entity Configuration
        modelBuilder.Entity<AdmissionClass>(entity =>
        {
            entity.ToTable("AdmissionClasses", t =>
            {
                t.HasCheckConstraint("CK_AdmissionClass_TotalSeats_Positive", "\"TotalSeats\" > 0");
            });

            entity.HasKey(c => c.Id);
            entity.Property(c => c.Id).HasMaxLength(50);
            entity.Property(c => c.Name).IsRequired().HasMaxLength(200);
            entity.Property(c => c.TotalSeats).IsRequired();
            entity.Property(c => c.CreatedAt).IsRequired();

            entity.HasMany(c => c.Holds)
                  .WithOne(h => h.Class)
                  .HasForeignKey(h => h.ClassId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // AdmissionHold Entity Configuration
        modelBuilder.Entity<AdmissionHold>(entity =>
        {
            entity.ToTable("AdmissionHolds");

            entity.HasKey(h => h.Id);
            entity.Property(h => h.Id).HasMaxLength(50);
            entity.Property(h => h.ClassId).IsRequired().HasMaxLength(50);
            entity.Property(h => h.StudentId).IsRequired().HasMaxLength(17);
            entity.Property(h => h.Status).IsRequired().HasMaxLength(20);
            entity.Property(h => h.CreatedAt).IsRequired();
            entity.Property(h => h.ExpiresAt).IsRequired();
            entity.Property(h => h.ConfirmedAt).IsRequired(false);
            entity.Property(h => h.CancelledAt).IsRequired(false);

            // Indexes for fast querying and capacity calculations
            entity.HasIndex(h => new { h.ClassId, h.Status })
                  .HasDatabaseName("IX_AdmissionHolds_ClassId_Status");

            entity.HasIndex(h => h.StudentId)
                  .HasDatabaseName("IX_AdmissionHolds_StudentId");

            entity.HasIndex(h => new { h.ExpiresAt, h.Status })
                  .HasDatabaseName("IX_AdmissionHolds_ExpiresAt_Status");

            // Unique partial index: at most one active (HELD) or CONFIRMED hold per student per class
            // Note: HasFilter is supported only in relational databases (PostgreSQL).
            // The EF Core In-Memory provider does not support partial filters and would erroneously enforce
            // unconditional uniqueness across all statuses, preventing a student from reapplying after hold expiration.
            if (Database.IsRelational())
            {
                entity.HasIndex(h => new { h.ClassId, h.StudentId })
                      .HasDatabaseName("IX_AdmissionHolds_ClassId_StudentId_ActiveUnique")
                      .HasFilter("\"Status\" IN ('HELD', 'CONFIRMED')")
                      .IsUnique();
            }
        });
    }
}

