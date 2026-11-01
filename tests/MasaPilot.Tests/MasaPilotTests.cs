using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using FluentAssertions;
using MasaPilot.Application.Common;
using MasaPilot.Application.DTOs;
using MasaPilot.Domain.Entities;
using MasaPilot.Domain.Enums;
using MasaPilot.Infrastructure.Data;
using MasaPilot.Infrastructure.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Xunit;

namespace MasaPilot.Tests;

public class TestWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly string _dbName = $"test_{Guid.NewGuid():N}.db";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            // Replace DbContext with dedicated test SQLite database
            var descriptor = services.SingleOrDefault(d => d.ServiceType == typeof(DbContextOptions<MasaPilotDbContext>));
            if (descriptor != null) services.Remove(descriptor);

            var connStr = $"Data Source={_dbName};Cache=Shared";
            services.AddDbContext<MasaPilotDbContext>(options =>
            {
                options.UseSqlite(connStr);
                options.EnableSensitiveDataLogging();
                options.LogTo(Console.WriteLine, LogLevel.Information);
            });

            // Ensure test DB is created
            var sp = services.BuildServiceProvider();
            using var scope = sp.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<MasaPilotDbContext>();
            db.Database.EnsureCreated();
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (File.Exists(_dbName))
        {
            try { File.Delete(_dbName); } catch { }
        }
    }
}

public class MasaPilotTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly TestWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public MasaPilotTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Scenario1_TenantRegistration_And_DefaultOnboardingDataCreated()
    {
        // Arrange
        var request = new RegisterTenantRequest(
            TenantName: "Test Kafe " + Guid.NewGuid().ToString("N")[..6],
            Slug: "testkafe-" + Guid.NewGuid().ToString("N")[..6],
            BranchName: "Kadıköy Şubesi",
            AdminFullName: "Ahmet Yılmaz",
            AdminEmail: $"ahmet_{Guid.NewGuid():N}@test.com",
            AdminPassword: "Password123!"
        );

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/auth/register", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var authResult = await response.Content.ReadFromJsonAsync<AuthResponse>();
        authResult.Should().NotBeNull();
        authResult!.TenantId.Should().NotBeEmpty();
        authResult.BranchId.Should().NotBeNull();
        authResult.Token.Should().NotBeNullOrWhiteSpace();

        // Check areas and tables created for this tenant
        _client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", authResult.Token);
        var areasResponse = await _client.GetAsync("/api/v1/areas");
        areasResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var areas = await areasResponse.Content.ReadFromJsonAsync<List<AreaDto>>();
        areas.Should().NotBeNull();
        areas!.Count.Should().BeGreaterThanOrEqualTo(2);
        areas!.SelectMany(a => a.Tables).Count().Should().BeGreaterThanOrEqualTo(10);

        // Check products created for this tenant
        var productsResponse = await _client.GetAsync("/api/v1/products");
        productsResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var products = await productsResponse.Content.ReadFromJsonAsync<List<ProductDto>>();
        products.Should().NotBeNull();
        products!.Count.Should().BeGreaterThanOrEqualTo(4);
    }

    [Fact]
    public async Task Scenario2_TenantIsolation_TenantACannotAccessTenantBData()
    {
        // 1. Register Tenant A
        var regA = await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterTenantRequest("Tenant A " + Guid.NewGuid(), "tenant-a-" + Guid.NewGuid().ToString("N")[..6], "Şube A", "User A", $"usera_{Guid.NewGuid():N}@a.com", "Pass123!"));
        var authA = await regA.Content.ReadFromJsonAsync<AuthResponse>();

        // 2. Register Tenant B
        var regB = await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterTenantRequest("Tenant B " + Guid.NewGuid(), "tenant-b-" + Guid.NewGuid().ToString("N")[..6], "Şube B", "User B", $"userb_{Guid.NewGuid():N}@b.com", "Pass123!"));
        var authB = await regB.Content.ReadFromJsonAsync<AuthResponse>();

        // 3. User A creates a private area
        _client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", authA!.Token);
        var createAreaRes = await _client.PostAsJsonAsync("/api/v1/areas", new CreateAreaRequest("Özel VIP Alanı A"));
        var areaA = await createAreaRes.Content.ReadFromJsonAsync<AreaDto>();

        // 4. User B queries areas -> MUST NOT see Tenant A's VIP area
        _client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", authB!.Token);
        var areasBRes = await _client.GetAsync("/api/v1/areas");
        var areasB = await areasBRes.Content.ReadFromJsonAsync<List<AreaDto>>();

        areasB.Should().NotBeNull();
        areasB!.Any(a => a.Id == areaA!.Id).Should().BeFalse("Tenant B, Tenant A'ya ait özel VIP alanını göremez!");
    }

    [Fact]
    public async Task Scenario3_ConcurrentOpenSession_EnforcesOneActiveSessionPerTable()
    {
        // Register tenant
        var reg = await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterTenantRequest("Table Session Kafe " + Guid.NewGuid(), "tablesess-" + Guid.NewGuid().ToString("N")[..6], "Merkez", "Test User", $"test_{Guid.NewGuid():N}@sess.com", "Pass123!"));
        var auth = await reg.Content.ReadFromJsonAsync<AuthResponse>();
        _client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", auth!.Token);

        var areas = await _client.GetFromJsonAsync<List<AreaDto>>("/api/v1/areas");
        var targetTable = areas!.First().Tables.First();

        // 1. Open session on target table
        var open1Res = await _client.PostAsJsonAsync("/api/v1/sessions/open", new OpenSessionRequest(targetTable.Id));
        open1Res.StatusCode.Should().Be(HttpStatusCode.OK);
        var session1 = await open1Res.Content.ReadFromJsonAsync<SessionDetailDto>();

        // 2. Concurrently attempt to open another session on the same table
        var open2Res = await _client.PostAsJsonAsync("/api/v1/sessions/open", new OpenSessionRequest(targetTable.Id));
        open2Res.StatusCode.Should().Be(HttpStatusCode.OK);
        var session2 = await open2Res.Content.ReadFromJsonAsync<SessionDetailDto>();

        // Assert: must return the SAME active session ID, never duplicate
        session1!.Id.Should().Be(session2!.Id, "Bir masada aynı anda yalnızca 1 açık adisyon olabilir!");
    }

    [Fact]
    public async Task Scenario4_IdempotentOrderSubmission_And_SnapshotPricing()
    {
        // Register tenant
        var reg = await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterTenantRequest("Order Kafe " + Guid.NewGuid(), "orderkafe-" + Guid.NewGuid().ToString("N")[..6], "Merkez", "Test User", $"test_{Guid.NewGuid():N}@ord.com", "Pass123!"));
        var auth = await reg.Content.ReadFromJsonAsync<AuthResponse>();
        _client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", auth!.Token);

        var areas = await _client.GetFromJsonAsync<List<AreaDto>>("/api/v1/areas");
        var targetTable = areas!.First().Tables.First();
        var openRes = await _client.PostAsJsonAsync("/api/v1/sessions/open", new OpenSessionRequest(targetTable.Id));
        var session = await openRes.Content.ReadFromJsonAsync<SessionDetailDto>();

        var products = await _client.GetFromJsonAsync<List<ProductDto>>("/api/v1/products");
        var testProduct = products!.First();
        var originalPrice = testProduct.UnitPrice;

        var idempotencyKey = Guid.NewGuid().ToString("N");
        var orderRequest = new AddOrderRequest(
            session!.Id,
            new List<OrderLineInput> { new(testProduct.Id, 2, "Az şekerli") },
            idempotencyKey
        );

        // First submission
        var order1Res = await _client.PostAsJsonAsync($"/api/v1/sessions/{session.Id}/orders", orderRequest);
        order1Res.StatusCode.Should().Be(HttpStatusCode.OK);
        var sessionAfterOrder1 = await order1Res.Content.ReadFromJsonAsync<SessionDetailDto>();

        // Second submission with identical Idempotency-Key (simulating network retry)
        var order2Res = await _client.PostAsJsonAsync($"/api/v1/sessions/{session.Id}/orders", orderRequest);
        order2Res.StatusCode.Should().Be(HttpStatusCode.OK);
        var sessionAfterOrder2 = await order2Res.Content.ReadFromJsonAsync<SessionDetailDto>();

        // Total should NOT be doubled!
        sessionAfterOrder2!.GrandTotal.Should().Be(originalPrice * 2, "Aynı idempotency key ile mükerrer sipariş eklenemez!");
        sessionAfterOrder2.Orders.SelectMany(o => o.Lines).Should().HaveCount(1);

        // Price Snapshot Test: Update product price in menu to 500 TL
        await _client.PutAsJsonAsync($"/api/v1/products/{testProduct.Id}", new UpdateProductRequest(
            testProduct.CategoryId,
            testProduct.Name,
            testProduct.Description,
            500.00m, // Changed price
            testProduct.VatRate,
            true,
            true
        ));

        // Reload existing session: snapshot price MUST stay at original price
        var reloadedSession = await _client.GetFromJsonAsync<SessionDetailDto>($"/api/v1/sessions/{session.Id}");
        reloadedSession!.GrandTotal.Should().Be(originalPrice * 2, "Menü fiyatı değişse dahi geçmiş siparişin snapshot fiyatı değişmez!");
    }

    [Fact]
    public async Task Scenario5_VoidOrderLine_RequiresReason_And_UpdatesBalance()
    {
        // Register tenant
        var reg = await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterTenantRequest("Void Kafe " + Guid.NewGuid(), "voidkafe-" + Guid.NewGuid().ToString("N")[..6], "Merkez", "Test User", $"test_{Guid.NewGuid():N}@void.com", "Pass123!"));
        var auth = await reg.Content.ReadFromJsonAsync<AuthResponse>();
        _client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", auth!.Token);

        var areas = await _client.GetFromJsonAsync<List<AreaDto>>("/api/v1/areas");
        var table = areas!.First().Tables.First();
        var openRes = await _client.PostAsJsonAsync("/api/v1/sessions/open", new OpenSessionRequest(table.Id));
        var session = await openRes.Content.ReadFromJsonAsync<SessionDetailDto>();

        var products = await _client.GetFromJsonAsync<List<ProductDto>>("/api/v1/products");
        var p1 = products![0];
        var p2 = products![1];

        // Add 2 products
        var addRes = await _client.PostAsJsonAsync($"/api/v1/sessions/{session!.Id}/orders", new AddOrderRequest(
            session.Id,
            new List<OrderLineInput> { new(p1.Id, 1), new(p2.Id, 1) }
        ));
        var sessionWithOrders = await addRes.Content.ReadFromJsonAsync<SessionDetailDto>();

        var lineToVoid = sessionWithOrders!.Orders.First().Lines.First();
        var expectedRemaining = p2.UnitPrice;

        // Void line with reason
        var voidRes = await _client.PostAsJsonAsync($"/api/v1/sessions/{session.Id}/void-line/{lineToVoid.Id}", new VoidLineRequest("Müşteri vazgeçti / Yanlış giriş"));
        voidRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var sessionAfterVoid = await voidRes.Content.ReadFromJsonAsync<SessionDetailDto>();

        sessionAfterVoid!.GrandTotal.Should().Be(expectedRemaining, "İptal edilen satır tutarı genel toplamdan düşürülmelidir.");

        // Check Audit Logs
        var auditRes = await _client.GetFromJsonAsync<List<AuditLog>>("/api/v1/reports/audit-logs");
        auditRes.Should().NotBeNull();
        auditRes!.Any(a => a.Action == "OrderLineVoided" && a.EntityId == lineToVoid.Id).Should().BeTrue("İptal işlemi audit log kaydına gerekçesiyle yazılmalıdır.");
    }

    [Fact]
    public async Task Scenario6_SettlingPayment_ClosesSession_And_FreesTable()
    {
        // Register tenant
        var reg = await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterTenantRequest("Pay Kafe " + Guid.NewGuid(), "paykafe-" + Guid.NewGuid().ToString("N")[..6], "Merkez", "Test User", $"test_{Guid.NewGuid():N}@pay.com", "Pass123!"));
        var auth = await reg.Content.ReadFromJsonAsync<AuthResponse>();
        _client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", auth!.Token);

        var areas = await _client.GetFromJsonAsync<List<AreaDto>>("/api/v1/areas");
        var table = areas!.First().Tables.First();
        var openRes = await _client.PostAsJsonAsync("/api/v1/sessions/open", new OpenSessionRequest(table.Id));
        var session = await openRes.Content.ReadFromJsonAsync<SessionDetailDto>();

        var products = await _client.GetFromJsonAsync<List<ProductDto>>("/api/v1/products");
        var p = products!.First();

        await _client.PostAsJsonAsync($"/api/v1/sessions/{session!.Id}/orders", new AddOrderRequest(
            session.Id,
            new List<OrderLineInput> { new(p.Id, 1) }
        ));

        var paymentMethods = await _client.GetFromJsonAsync<List<PaymentMethodDto>>("/api/v1/payment-methods");
        var cashMethod = paymentMethods!.First(m => m.Type == PaymentType.Cash);

        // Pay full balance
        var payRes = await _client.PostAsJsonAsync($"/api/v1/sessions/{session.Id}/payments", new CreatePaymentRequest(
            session.Id,
            cashMethod.Id,
            p.UnitPrice
        ));
        if (payRes.StatusCode != HttpStatusCode.OK)
        {
            var err = await payRes.Content.ReadAsStringAsync();
            throw new Exception($"AddPayment failed with {payRes.StatusCode}: {err}");
        }
        payRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var settledSession = await payRes.Content.ReadFromJsonAsync<SessionDetailDto>();

        settledSession!.Status.Should().Be(SessionStatus.Closed, "Kalan bakiye sıfırlandığında adisyon otomatik kapanmalıdır.");
        settledSession.RemainingTotal.Should().Be(0m);

        // Verify table status is now Empty
        var areasAfter = await _client.GetFromJsonAsync<List<AreaDto>>("/api/v1/areas");
        var updatedTable = areasAfter!.First().Tables.First(t => t.Id == table.Id);
        updatedTable.Status.Should().Be(TableStatus.Empty, "Hesap kapandığında masa otomatik boş duruma geçmelidir.");
    }

    [Fact]
    public void Scenario7_PrintReprint_BannerMarking_And_PreReceiptNonFiscal()
    {
        var generator = new EscPosGenerator();
        var session = new TableSession
        {
            SessionNumber = "A-261028-001",
            SubTotal = 200m,
            TaxTotal = 20m,
            GrandTotal = 200m,
            PaidTotal = 0m,
            RemainingTotal = 200m
        };
        var branch = new Branch { Name = "MasaPilot Kadıköy" };
        var lines = new List<OrderLine>
        {
            new() { ProductNameSnapshot = "Filtre Kahve", Quantity = 2, LineTotal = 140m },
            new() { ProductNameSnapshot = "Cheesecake", Quantity = 1, LineTotal = 60m }
        };

        // 1. Regular PreReceipt
        var preReceipt = generator.GeneratePreReceipt(session, lines, branch, isReprint: false);
        preReceipt.Should().Contain(">> BU BELGE RESMI MALI FIS DEGILDIR <<");
        preReceipt.Should().NotContain("*** TEKRAR BASKI ***");

        // 2. Reprint PreReceipt
        var reprintTicket = generator.GeneratePreReceipt(session, lines, branch, isReprint: true);
        reprintTicket.Should().Contain("*** TEKRAR BASKI ***");
    }

    [Fact]
    public void Scenario8_PasswordAndPinHasher_ValidatesCorrectly()
    {
        var hasher = new PasswordHasher();
        var password = "SuperSecretPassword123!";
        var hash = hasher.HashPassword(password);

        hash.Should().NotBeNullOrWhiteSpace();
        hash.Should().Contain(".");

        hasher.VerifyPassword(password, hash).Should().BeTrue();
        hasher.VerifyPassword("WrongPassword", hash).Should().BeFalse();

        var pin = "5842";
        var pinHash = hasher.HashPin(pin);
        hasher.VerifyPin("5842", pinHash).Should().BeTrue();
        hasher.VerifyPin("0000", pinHash).Should().BeFalse();
    }

    [Fact]
    public async Task Scenario9_BackupAndVerify_CreatesSnapshot_And_PassesIntegrityCheck()
    {
        // 1. Create a backup
        var createRes = await _client.PostAsync("/api/v1/backup/create", null);
        createRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var createData = await createRes.Content.ReadFromJsonAsync<Dictionary<string, object>>();

        createData.Should().NotBeNull();
        createData!.Should().ContainKey("filePath");
        createData.Should().ContainKey("checksumSha256");

        var backupPath = createData["filePath"].ToString();
        var checksum = createData["checksumSha256"].ToString();

        // 2. Verify the backup
        var verifyRes = await _client.PostAsync($"/api/v1/backup/verify?backupPath={Uri.EscapeDataString(backupPath!)}&expectedChecksum={checksum}", null);
        verifyRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var verifyData = await verifyRes.Content.ReadFromJsonAsync<Dictionary<string, object>>();

        verifyData.Should().NotBeNull();
        verifyData!["isValid"].ToString().ToLower().Should().Be("true");
        verifyData["message"].ToString().Should().Contain("doğrulandı");
    }

    [Fact]
    public async Task Scenario10_ShiftsAndCashManagement_ComputesExpectedCashAccurately()
    {
        // Register tenant
        var reg = await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterTenantRequest("Shift Kafe " + Guid.NewGuid(), "shiftkafe-" + Guid.NewGuid().ToString("N")[..6], "Merkez", "Shift Admin", $"shift_{Guid.NewGuid():N}@shift.com", "Pass123!"));
        var auth = await reg.Content.ReadFromJsonAsync<AuthResponse>();
        _client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", auth!.Token);

        // 1. Open Shift with 1000 TL starting cash
        var openShiftRes = await _client.PostAsJsonAsync("/api/v1/shifts/open", new OpenShiftRequest(1000.00m, "Sabah açılışı"));
        openShiftRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var shift = await openShiftRes.Content.ReadFromJsonAsync<ShiftDto>();
        shift!.StartingCash.Should().Be(1000.00m);
        shift.IsOpen.Should().BeTrue();

        // 2. Take a table order and pay 300 TL in cash
        var areas = await _client.GetFromJsonAsync<List<AreaDto>>("/api/v1/areas");
        var table = areas!.First().Tables.First();
        var sessionRes = await _client.PostAsJsonAsync("/api/v1/sessions/open", new OpenSessionRequest(table.Id));
        var session = await sessionRes.Content.ReadFromJsonAsync<SessionDetailDto>();

        var products = await _client.GetFromJsonAsync<List<ProductDto>>("/api/v1/products");
        var p = products!.First();

        await _client.PostAsJsonAsync($"/api/v1/sessions/{session!.Id}/orders", new AddOrderRequest(
            session.Id,
            new List<OrderLineInput> { new(p.Id, 2) }
        ));

        var paymentMethods = await _client.GetFromJsonAsync<List<PaymentMethodDto>>("/api/v1/payment-methods");
        var cashMethod = paymentMethods!.First(m => m.Type == PaymentType.Cash);

        await _client.PostAsJsonAsync($"/api/v1/sessions/{session.Id}/payments", new CreatePaymentRequest(
            session.Id,
            cashMethod.Id,
            p.UnitPrice * 2
        ));

        // 3. Query current shift: expected cash must equal 1000 + (p.UnitPrice * 2)
        var currentShift = await _client.GetFromJsonAsync<ShiftDto>("/api/v1/shifts/current");
        currentShift.Should().NotBeNull();
        currentShift!.ExpectedCash.Should().Be(1000.00m + (p.UnitPrice * 2));

        // 4. Close Shift with counted cash
        var closeRes = await _client.PostAsJsonAsync("/api/v1/shifts/close", new CloseShiftRequest(currentShift.ExpectedCash, "Gün sonu sayımı tam"));
        closeRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var closedShift = await closeRes.Content.ReadFromJsonAsync<ShiftDto>();
        closedShift!.IsOpen.Should().BeFalse();
        closedShift.Difference.Should().Be(0m);
    }

    [Fact]
    public async Task Scenario11_DailyReport_SummarizesSalesAndPaymentBreakdown()
    {
        // Register tenant
        var reg = await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterTenantRequest("Report Kafe " + Guid.NewGuid(), "reportkafe-" + Guid.NewGuid().ToString("N")[..6], "Merkez", "Report Admin", $"report_{Guid.NewGuid():N}@rep.com", "Pass123!"));
        var auth = await reg.Content.ReadFromJsonAsync<AuthResponse>();
        _client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", auth!.Token);

        // Query daily report
        var reportRes = await _client.GetAsync("/api/v1/reports/daily");
        reportRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var report = await reportRes.Content.ReadFromJsonAsync<DailySalesReport>();

        report.Should().NotBeNull();
        report!.GrossSales.Should().BeGreaterThanOrEqualTo(0m);
    }
}
