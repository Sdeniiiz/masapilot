using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using MasaPilot.Application.Common;
using MasaPilot.Domain.Entities;
using MasaPilot.Domain.Enums;
using MasaPilot.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace MasaPilot.Infrastructure.Services;

public class EscPosGenerator : IEscPosGenerator
{
    private const string ESC = "\x1B";
    private const string GS = "\x1D";

    public string GenerateKitchenTicket(TableSession session, Order order, IEnumerable<OrderLine> lines, string stationName, bool isReprint)
    {
        var sb = new StringBuilder();

        // ESC @: Init
        sb.AppendLine($"{ESC}@");

        // Center Align
        sb.AppendLine($"{ESC}a1");

        if (isReprint)
        {
            sb.AppendLine("========================================");
            sb.AppendLine("*** TEKRAR BASKI ***");
            sb.AppendLine("Bu fis daha once yazdirilmis olabilir!");
            sb.AppendLine("========================================");
        }

        sb.AppendLine($"--- {stationName.ToUpperInvariant()} SIPARIS FISI ---");
        sb.AppendLine($"Masa: {(session.DiningTable?.TableNumber ?? "Paket/Gel-Al")}");
        sb.AppendLine($"Adisyon No: {session.SessionNumber} | Siparis: {order.OrderNumber}");
        sb.AppendLine($"Tarih: {DateTime.Now:dd.MM.yyyy HH:mm:ss}");
        if (!string.IsNullOrWhiteSpace(order.Notes))
        {
            sb.AppendLine($"SIPARIS NOTU: {order.Notes}");
        }
        sb.AppendLine("----------------------------------------");

        // Left Align for items
        sb.AppendLine($"{ESC}a0");

        foreach (var line in lines)
        {
            var itemTitle = line.ProductNameSnapshot;
            if (line.IsComplimentary) itemTitle += " **(İKRAM)**";
            sb.AppendLine($"{line.Quantity,3:0.##} x {itemTitle}");
            if (!string.IsNullOrWhiteSpace(line.Notes))
            {
                sb.AppendLine($"    >> NOT: {line.Notes}");
            }
        }

        sb.AppendLine("----------------------------------------");
        sb.AppendLine($"{ESC}a1");
        sb.AppendLine("MasaPilot Operasyon Sistemi");

        // Feed & Cut (GS V 66 0)
        sb.AppendLine("\n\n\n");
        sb.AppendLine($"{GS}V\x42\x00");

        return sb.ToString();
    }

    public string GeneratePreReceipt(TableSession session, IEnumerable<OrderLine> lines, Branch branch, bool isReprint)
    {
        var sb = new StringBuilder();

        sb.AppendLine($"{ESC}@");
        sb.AppendLine($"{ESC}a1");

        if (isReprint)
        {
            sb.AppendLine("========================================");
            sb.AppendLine("*** TEKRAR BASKI ***");
            sb.AppendLine("========================================");
        }

        sb.AppendLine($"*** {branch.Name.ToUpperInvariant()} ***");
        sb.AppendLine("BILGILENDIRME AMACLI ON HESAP DOKUMU");
        sb.AppendLine(">> BU BELGE RESMI MALI FIS DEGILDIR <<");
        sb.AppendLine("----------------------------------------");
        sb.AppendLine($"Masa: {(session.DiningTable?.TableNumber ?? "Paket")}");
        sb.AppendLine($"Adisyon No: {session.SessionNumber}");
        sb.AppendLine($"Tarih: {DateTime.Now:dd.MM.yyyy HH:mm:ss}");
        sb.AppendLine("----------------------------------------");

        sb.AppendLine($"{ESC}a0");
        sb.AppendLine(string.Format("{0,-20} {1,5} {2,12}", "Urun", "Adet", "Tutar"));
        sb.AppendLine("----------------------------------------");

        foreach (var line in lines)
        {
            var baseName = line.IsComplimentary ? $"{line.ProductNameSnapshot} (IKRAM)" : line.ProductNameSnapshot;
            var name = baseName.Length > 20
                ? baseName.Substring(0, 19)
                : baseName;

            sb.AppendLine(string.Format("{0,-20} {1,5:0.##} {2,12:C2}", name, line.Quantity, line.LineTotal));
        }

        sb.AppendLine("----------------------------------------");
        sb.AppendLine($"{ESC}a2"); // Right align
        sb.AppendLine($"Ara Toplam: {session.SubTotal:C2}");
        sb.AppendLine($"KDV Toplam: {session.TaxTotal:C2}");
        if (session.DiscountTotal > 0)
        {
            sb.AppendLine($"Indirim: -{session.DiscountTotal:C2}");
        }
        sb.AppendLine($"GENEL TOPLAM: {session.GrandTotal:C2}");

        if (session.PaidTotal > 0)
        {
            sb.AppendLine($"Odenen: {session.PaidTotal:C2}");
            sb.AppendLine($"Kalan: {session.RemainingTotal:C2}");
        }

        sb.AppendLine($"{ESC}a1");
        sb.AppendLine("----------------------------------------");
        sb.AppendLine("Tesekkur eder, yine bekleriz.");
        sb.AppendLine("MasaPilot - Bulut & Yerel Restoran Otomasyonu");

        sb.AppendLine("\n\n\n");
        sb.AppendLine($"{GS}V\x42\x00");

        return sb.ToString();
    }
}

public interface IPrintDeliveryService
{
    Task<(bool Success, string? Error)> SendAsync(Printer printer, string rawContent, CancellationToken ct = default);
}

public class PrintDeliveryService : IPrintDeliveryService
{
    private readonly ILogger<PrintDeliveryService> _logger;

    public PrintDeliveryService(ILogger<PrintDeliveryService> logger)
    {
        _logger = logger;
    }

    public async Task<(bool Success, string? Error)> SendAsync(Printer printer, string rawContent, CancellationToken ct = default)
    {
        if (printer.ConnectionType == PrinterConnectionType.VirtualFake)
        {
            // Virtual simulated printer for tests and hardware-less operation
            _logger.LogInformation("[FakePrinter] Yazıcıya iletildi: '{PrinterName}'\n{Content}", printer.Name, rawContent);
            await Task.Delay(50, ct); // Simulate minor spooler latency
            return (true, null);
        }

        if (printer.ConnectionType == PrinterConnectionType.NetworkEthernet)
        {
            if (string.IsNullOrWhiteSpace(printer.IpAddress))
            {
                return (false, "Ethernet yazıcı için IP adresi tanımlanmamış.");
            }

            try
            {
                using var client = new TcpClient();
                using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                cts.CancelAfter(TimeSpan.FromSeconds(3)); // 3-second connect timeout

                await client.ConnectAsync(printer.IpAddress, printer.Port, cts.Token);
                using var stream = client.GetStream();
                byte[] bytes = Encoding.GetEncoding("windows-1254", EncoderFallback.ReplacementFallback, DecoderFallback.ReplacementFallback).GetBytes(rawContent);
                await stream.WriteAsync(bytes, 0, bytes.Length, cts.Token);
                await stream.FlushAsync(cts.Token);
                return (true, null);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[NetworkPrinter] IP {Ip}:{Port} yazıcıya bağlanılamadı: {Message}", printer.IpAddress, printer.Port, ex.Message);
                return (false, $"Ağ yazıcısına bağlanılamadı: {ex.Message}");
            }
        }

        return (false, $"Desteklenmeyen yazıcı bağlantı tipi: {printer.ConnectionType}");
    }
}

public class PrintWorkerService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<PrintWorkerService> _logger;

    public PrintWorkerService(IServiceProvider serviceProvider, ILogger<PrintWorkerService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("MasaPilot PrintWorkerService başlatıldı.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessNextQueuedJobAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "PrintWorker döngüsünde beklenmeyen hata oluştu.");
            }

            await Task.Delay(1000, stoppingToken);
        }
    }

    public async Task ProcessNextQueuedJobAsync(CancellationToken ct = default)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MasaPilotDbContext>();
        var delivery = scope.ServiceProvider.GetRequiredService<IPrintDeliveryService>();

        var job = await db.PrintJobs
            .Include(j => j.Printer)
            .Where(j => j.Status == PrintJobStatus.Queued || (j.Status == PrintJobStatus.RetryableFailed && j.AttemptsCount < 3))
            .OrderBy(j => j.CreatedAtUtc)
            .FirstOrDefaultAsync(ct);

        if (job == null) return;

        job.Status = PrintJobStatus.Claimed;
        job.AttemptsCount++;
        job.LastAttemptAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        if (job.Printer == null)
        {
            job.Status = PrintJobStatus.ManualReview;
            job.LastError = "İş için yazıcı bulunamadı.";
            await db.SaveChangesAsync(ct);
            return;
        }

        var (success, error) = await delivery.SendAsync(job.Printer, job.RawContentEscPos, ct);

        if (success)
        {
            job.Status = PrintJobStatus.Printed;
            job.LastError = null;
        }
        else
        {
            job.LastError = error;
            if (job.AttemptsCount >= 3)
            {
                // After 3 failed attempts, move to ManualReview to avoid blind infinite printing
                job.Status = PrintJobStatus.ManualReview;
                _logger.LogWarning("PrintJob {JobId} 3 başarısız denemeden sonra ManualReview durumuna alındı.", job.Id);
            }
            else
            {
                job.Status = PrintJobStatus.RetryableFailed;
            }
        }

        await db.SaveChangesAsync(ct);
    }
}
