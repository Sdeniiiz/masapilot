using System;
using MasaPilot.Application.Common;
using MasaPilot.Domain.Entities;
using MasaPilot.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace MasaPilot.Infrastructure.Data;

public class MasaPilotDbContext : DbContext
{
    private readonly ICurrentTenantService? _tenantService;

    public MasaPilotDbContext(DbContextOptions<MasaPilotDbContext> options, ICurrentTenantService? tenantService = null)
        : base(options)
    {
        _tenantService = tenantService;
    }

    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<Branch> Branches => Set<Branch>();
    public DbSet<User> Users => Set<User>();
    public DbSet<AreaFloor> AreaFloors => Set<AreaFloor>();
    public DbSet<DiningTable> DiningTables => Set<DiningTable>();
    public DbSet<TableSession> TableSessions => Set<TableSession>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<KitchenStation> KitchenStations => Set<KitchenStation>();
    public DbSet<ProductStationRoute> ProductStationRoutes => Set<ProductStationRoute>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderLine> OrderLines => Set<OrderLine>();
    public DbSet<PaymentMethod> PaymentMethods => Set<PaymentMethod>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<Shift> Shifts => Set<Shift>();
    public DbSet<Printer> Printers => Set<Printer>();
    public DbSet<PrintJob> PrintJobs => Set<PrintJob>();
    public DbSet<OutboxEvent> OutboxEvents => Set<OutboxEvent>();
    public DbSet<InboxEvent> InboxEvents => Set<InboxEvent>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<NoteTemplate> NoteTemplates => Set<NoteTemplate>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Global Decimal Precision for financial safety
        foreach (var property in modelBuilder.Model.GetEntityTypes()
            .SelectMany(t => t.GetProperties())
            .Where(p => p.ClrType == typeof(decimal) || p.ClrType == typeof(decimal?)))
        {
            property.SetPrecision(18);
            property.SetScale(2);
        }

        // TableSession: One open session per table in a branch
        modelBuilder.Entity<TableSession>(entity =>
        {
            entity.HasIndex(e => new { e.BranchId, e.DiningTableId })
                  .HasFilter("DiningTableId IS NOT NULL AND Status = 1") // Status 1 = Open
                  .IsUnique();

            entity.HasOne(e => e.DiningTable)
                  .WithMany(t => t.TableSessions)
                  .HasForeignKey(e => e.DiningTableId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // DiningTable: TableNumber unique per Area
        modelBuilder.Entity<DiningTable>(entity =>
        {
            entity.HasIndex(e => new { e.BranchId, e.AreaFloorId, e.TableNumber })
                  .IsUnique();

            entity.HasOne(e => e.AreaFloor)
                  .WithMany(a => a.DiningTables)
                  .HasForeignKey(e => e.AreaFloorId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // Product Station Routes
        modelBuilder.Entity<ProductStationRoute>(entity =>
        {
            entity.HasIndex(e => new { e.ProductId, e.KitchenStationId }).IsUnique();

            entity.HasOne(e => e.Product)
                  .WithMany(p => p.StationRoutes)
                  .HasForeignKey(e => e.ProductId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.KitchenStation)
                  .WithMany()
                  .HasForeignKey(e => e.KitchenStationId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // Tenant slug unique
        modelBuilder.Entity<Tenant>(entity =>
        {
            entity.HasIndex(e => e.Slug).IsUnique();
        });

        // User email unique per tenant
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(e => new { e.TenantId, e.Email }).IsUnique();
        });

        // Inbox event unique
        modelBuilder.Entity<InboxEvent>(entity =>
        {
            entity.HasIndex(e => new { e.TenantId, e.BranchId, e.EventId }).IsUnique();
        });

        // Outbox event index
        modelBuilder.Entity<OutboxEvent>(entity =>
        {
            entity.HasIndex(e => new { e.IsDispatched, e.OccurredAtUtc });
        });

        // PrintJob index
        modelBuilder.Entity<PrintJob>(entity =>
        {
            entity.HasIndex(e => new { e.Status, e.CreatedAtUtc });
        });
    }
}
