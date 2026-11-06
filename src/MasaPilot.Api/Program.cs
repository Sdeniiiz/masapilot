using System.Text;
using MasaPilot.Api.Hubs;
using MasaPilot.Api.Services;
using MasaPilot.Application.Common;
using MasaPilot.Infrastructure.Data;
using MasaPilot.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;

AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

var builder = WebApplication.CreateBuilder(args);

// Configuration
var rawDbUrl = builder.Configuration["DATABASE_URL"];
var runtimeMode = builder.Configuration["RuntimeMode"] ?? "Edge"; // "Edge" or "Cloud"

if (!string.IsNullOrWhiteSpace(rawDbUrl))
{
    runtimeMode = "Cloud";
}

var rawConnectionString = !string.IsNullOrWhiteSpace(rawDbUrl)
    ? rawDbUrl
    : (builder.Configuration.GetConnectionString("DefaultConnection") ?? "Data Source=masapilot.db;Cache=Shared");

var connectionString = ConvertToNpgsqlConnectionStringIfNeeded(rawConnectionString);

// 1. Database Context
builder.Services.AddDbContext<MasaPilotDbContext>((sp, options) =>
{
    if (runtimeMode.Equals("Cloud", StringComparison.OrdinalIgnoreCase))
    {
        options.UseNpgsql(connectionString);
    }
    else
    {
        // Edge mode: SQLite with WAL mode & busy timeout
        var sqliteConn = new SqliteConnection(connectionString);
        options.UseSqlite(sqliteConn);
    }
});

// 2. Core & Infrastructure Services
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentTenantService, CurrentTenantService>();
builder.Services.AddSingleton<IPasswordHasher, PasswordHasher>();
builder.Services.AddScoped<IJwtService, JwtService>();
builder.Services.AddSingleton<IEscPosGenerator, EscPosGenerator>();
builder.Services.AddSingleton<IPrintDeliveryService, PrintDeliveryService>();
builder.Services.AddScoped<IBackupService, BackupService>();

// 3. Background Workers
builder.Services.AddHostedService<PrintWorkerService>();
builder.Services.AddHostedService<OutboxDispatcherService>();

// 4. JWT Authentication
var jwtSecret = builder.Configuration["Jwt:Secret"] ?? "MasaPilot_SuperSecretDevKey_Minimum32CharactersRequired!";
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "MasaPilot",
        ValidAudience = builder.Configuration["Jwt:Audience"] ?? "MasaPilotClient",
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
        ClockSkew = TimeSpan.Zero
    };

    // Support token for SignalR query string (?access_token=...)
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization();

// 5. SignalR
builder.Services.AddSignalR();

// 6. Controllers & JSON Options
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });

// 7. CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAllLocal", policy =>
    {
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

// Database Migration & Initialization (WAL Mode for SQLite)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<MasaPilotDbContext>();
    var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
    db.Database.EnsureCreated();

    if (db.Database.IsSqlite())
    {
        var conn = (SqliteConnection)db.Database.GetDbConnection();
        if (conn.State == System.Data.ConnectionState.Closed) conn.Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA busy_timeout = 5000;

            CREATE TABLE IF NOT EXISTS ""NoteTemplates"" (
                ""Id"" TEXT NOT NULL CONSTRAINT ""PK_NoteTemplates"" PRIMARY KEY,
                ""TenantId"" TEXT NOT NULL,
                ""BranchId"" TEXT NOT NULL,
                ""Title"" TEXT NOT NULL,
                ""Content"" TEXT NOT NULL,
                ""DisplayOrder"" INTEGER NOT NULL,
                ""IsActive"" INTEGER NOT NULL,
                ""CreatedAtUtc"" TEXT NOT NULL
            );
        ";
            cmd.ExecuteNonQuery();

            try
            {
                cmd.CommandText = @"ALTER TABLE ""Orders"" ADD COLUMN ""Notes"" TEXT;";
                cmd.ExecuteNonQuery();
            }
            catch { }

            try { cmd.CommandText = @"ALTER TABLE ""OrderLines"" ADD COLUMN ""IsComplimentary"" INTEGER NOT NULL DEFAULT 0;"; cmd.ExecuteNonQuery(); } catch { }
            try { cmd.CommandText = @"ALTER TABLE ""OrderLines"" ADD COLUMN ""ComplimentaryReason"" TEXT;"; cmd.ExecuteNonQuery(); } catch { }
            try { cmd.CommandText = @"ALTER TABLE ""OrderLines"" ADD COLUMN ""PortionName"" TEXT;"; cmd.ExecuteNonQuery(); } catch { }
            try { cmd.CommandText = @"ALTER TABLE ""OrderLines"" ADD COLUMN ""IsPaid"" INTEGER NOT NULL DEFAULT 0;"; cmd.ExecuteNonQuery(); } catch { }
            try { cmd.CommandText = @"ALTER TABLE ""OrderLines"" ADD COLUMN ""PaymentId"" TEXT;"; cmd.ExecuteNonQuery(); } catch { }
            try { cmd.CommandText = @"ALTER TABLE ""Products"" ADD COLUMN ""PortionsJson"" TEXT;"; cmd.ExecuteNonQuery(); } catch { }
        }

        // Seed authentic Galip Usta Pide Salonu default admin, branch, tables and menu
        await GalipUstaSeeder.SeedAllAsync(db, hasher);
    }

app.UseCors("AllowAllLocal");

// Uploads static directory
var uploadsDir = Path.Combine(app.Environment.ContentRootPath, "uploads");
Directory.CreateDirectory(uploadsDir);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsDir),
    RequestPath = "/uploads"
});

// SPA static files if published into wwwroot
var wwwrootDir = Path.Combine(app.Environment.ContentRootPath, "wwwroot");
if (Directory.Exists(wwwrootDir))
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<OrderHub>("/hubs/orders");
app.MapHub<KitchenHub>("/hubs/kitchen");

// Fallback for SPA routing if wwwroot exists
if (Directory.Exists(wwwrootDir))
{
    app.MapFallbackToFile("index.html");
}

app.Run();

// Required for WebApplicationFactory in integration tests
public partial class Program
{
    public static string ConvertToNpgsqlConnectionStringIfNeeded(string connStr)
    {
        if (string.IsNullOrWhiteSpace(connStr)) return connStr;
        if (!connStr.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) &&
            !connStr.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
        {
            return connStr;
        }

        try
        {
            var uri = new Uri(connStr);
            var userInfo = uri.UserInfo.Split(':');
            var username = userInfo.Length > 0 ? Uri.UnescapeDataString(userInfo[0]) : "";
            var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
            var port = uri.Port > 0 ? uri.Port : 5432;
            var database = uri.AbsolutePath.TrimStart('/');

            return $"Host={uri.Host};Port={port};Database={database};Username={username};Password={password};SSL Mode=Require;Trust Server Certificate=true;";
        }
        catch
        {
            return connStr;
        }
    }
}
