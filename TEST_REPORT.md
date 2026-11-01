# MasaPilot — Test Raporu (TEST_REPORT.md)

**Tarih:** 28 Ekim 2026  
**Test Ortamı:** Windows x64, .NET 9.0 SDK, SQLite WAL Mode, Node 24.13.0  
**Test Çatısı:** xUnit 2.9 + FluentAssertions 8.0 + Microsoft.AspNetCore.Mvc.Testing 9.0  

---

## 1. Test Özeti

| Kategori | Toplam Senaryo | Başarılı | Başarısız | Başarı Oranı |
|---|---|---|---|---|
| **Çok Kiracılı İzolasyon (Multi-Tenant)** | 2 | 2 | 0 | %100 |
| **Sipariş, Masa & Fiyat Bütünlüğü** | 3 | 3 | 0 | %100 |
| **Tahsilat, İptal & Kasa Mutabakatı** | 3 | 3 | 0 | %100 |
| **Yazıcı, ESC/POS & Baskı Güvenliği** | 1 | 1 | 0 | %100 |
| **Yedekleme & SQLite Bütünlüğü** | 1 | 1 | 0 | %100 |
| **Kimlik Doğrulama & PIN Kriptografisi** | 1 | 1 | 0 | %100 |
| **TOPLAM** | **11** | **11** | **0** | **%100** |

---

## 2. Çalıştırılan Komut ve Konsol Çıktısı

```powershell
dotnet test tests/MasaPilot.Tests/MasaPilot.Tests.csproj --logger "console;verbosity=detailed"
```

**Gerçek Test Çıktısı:**
```
D:\masapilot\tests\MasaPilot.Tests\bin\Debug\net9.0\MasaPilot.Tests.dll (.NETCoreApp,Version=v9.0) için test çalıştırması
VSTest sürümü 17.14.1 (x64)

Test yürütmesi başlatılıyor, lütfen bekleyin...
Toplam 1 test dosyası belirtilen desenle eşleşti.

[xUnit.net 00:00:01.05]     MasaPilot.Tests.MasaPilotTests.Scenario1_TenantRegistration_And_DefaultOnboardingDataCreated [PASS]
[xUnit.net 00:00:01.20]     MasaPilot.Tests.MasaPilotTests.Scenario2_TenantIsolation_TenantACannotAccessTenantBData [PASS]
[xUnit.net 00:00:01.32]     MasaPilot.Tests.MasaPilotTests.Scenario3_ConcurrentOpenSession_EnforcesOneActiveSessionPerTable [PASS]
[xUnit.net 00:00:01.48]     MasaPilot.Tests.MasaPilotTests.Scenario4_IdempotentOrderSubmission_And_SnapshotPricing [PASS]
[xUnit.net 00:00:01.62]     MasaPilot.Tests.MasaPilotTests.Scenario5_VoidOrderLine_RequiresReason_And_UpdatesBalance [PASS]
[xUnit.net 00:00:01.78]     MasaPilot.Tests.MasaPilotTests.Scenario6_SettlingPayment_ClosesSession_And_FreesTable [PASS]
[xUnit.net 00:00:01.85]     MasaPilot.Tests.MasaPilotTests.Scenario7_PrintReprint_BannerMarking_And_PreReceiptNonFiscal [PASS]
[xUnit.net 00:00:01.92]     MasaPilot.Tests.MasaPilotTests.Scenario8_PasswordAndPinHasher_ValidatesCorrectly [PASS]
[xUnit.net 00:00:02.05]     MasaPilot.Tests.MasaPilotTests.Scenario9_BackupAndVerify_CreatesSnapshot_And_PassesIntegrityCheck [PASS]
[xUnit.net 00:00:02.18]     MasaPilot.Tests.MasaPilotTests.Scenario10_ShiftsAndCashManagement_ComputesExpectedCashAccurately [PASS]
[xUnit.net 00:00:02.26]     MasaPilot.Tests.MasaPilotTests.Scenario11_DailyReport_SummarizesSalesAndPaymentBreakdown [PASS]

Başarılı!  - Başarısız: 0, Başarılı: 11, Atlanan: 0, Toplam: 11, Süre: 2 s - MasaPilot.Tests.dll (net9.0)
```

---

## 3. Doğrulanan Kritik Güvenlik ve İş Kuralları

1. **Kiracı İzolasyonu:** Tenant B kullanıcısı, Tenant A'nın özel salon ve masalarını API üzerinden ID bilse dahi listeleyemez veya erişemez.
2. **Tek Açık Masa Adisyonu:** Aynı masada aynı anda ikinci bir açık adisyon oluşturulamaz; var olan açık adisyon döner.
3. **Mükerrer İstek Engelleme (Idempotency):** Aynı `IdempotencyKey` ile yapılan ağ tekrarlarında sipariş veya ödeme iki kez kaydedilmez.
4. **Fiyat Dondurma (Snapshot Pricing):** Menüdeki ürün fiyatı güncellense bile, önceden açılmış adisyondaki satırların birim fiyatı ve hesaplanan toplamı kesinlikle değişmez.
5. **Denetlenebilir İptaller (Audit Log):** Bir sipariş satırının iptal edilebilmesi için zorunlu gerekçe girilmesi şarttır; işlem gerekçe, aktör ve IP adresi ile audit tablosuna kalıcı işlenir.
6. **Otomatik Masa Tahliyesi:** Masanın kalan bakiyesi sıfırlandığında adisyon otomatik kapatılır ve masa boş (`Empty`) duruma geçer.
7. **Baskı Durumu Belirsizliği & Tekrar Baskı:** Baskı zaman aşımına uğradığında körlemesine tekrar basılmaz; kullanıcı tekrar bastığında çıktıda belirgin `*** TEKRAR BASKI ***` uyarısı yer alır.
8. **Ön Hesap Mali Değil:** Ön hesap dökümünde `BU BELGE RESMI MALI FIS DEGILDIR` ibaresi zorunlu yazdırılır.
9. **Yedek Doğrulama:** Alınan SQLite yedeği SHA-256 sağlama toplamı ve `PRAGMA integrity_check` testlerinden başarıyla geçer.
