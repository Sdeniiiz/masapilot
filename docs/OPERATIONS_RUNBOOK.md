# MasaPilot — Windows İşletim ve Kurulum Kılavuzu (docs/OPERATIONS_RUNBOOK.md)

## 1. Sistem Gereksinimleri
- İşletim Sistemi: Windows 10 / 11 / Windows Server 2022+ (x64)
- Çalışma Zamanı: .NET 9 Runtime / SDK
- İstemci: Modern Chromium/Firefox/Safari tarayıcı (Dokunmatik ekran veya masaüstü/mobil)
- Ağ: Şube içi Wi-Fi / Ethernet yerel ağı (LAN).

---

## 2. Hızlı Kurulum ve Başlatma

### Geliştirici / Yerel Test Modu
1. **Depoyu İnceleme:**
   ```powershell
   cd d:\masapilot
   ```
2. **Backend ve Frontend Derleme:**
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\build.ps1
   ```
3. **Uygulamayı Başlatma:**
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\start-local.ps1
   ```
   - Varsayılan Edge API: `http://localhost:5000`
   - Varsayılan Web Arayüzü: `http://localhost:5173` (veya derlenmiş statik wwwroot üzerinden `http://localhost:5000`)

---

## 3. Güvenlik Duvarı (Firewall) Ayarı (LAN'dan Garson Tabletleri İçin)
Diğer cihazların ana kasaya bağlanabilmesi için gelen bağlantı kuralı açılmalıdır:
```powershell
New-NetFirewallRule -DisplayName "MasaPilot Edge Server" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow
```

---

## 4. Yedek Alma ve Geri Yükleme
```powershell
# Yedek al
powershell -ExecutionPolicy Bypass -File .\scripts\backup-db.ps1

# Geri yükle ve doğrula
powershell -ExecutionPolicy Bypass -File .\scripts\restore-db.ps1 -BackupPath ".\backups\masapilot_backup_latest.db"
```
