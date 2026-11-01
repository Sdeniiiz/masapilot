# MasaPilot — Restoran & Kafe POS ve Otomasyon Platformu

> **MasaPilot**, restoran, kafe ve barlar için geliştirilmiş, çok kiracılı (multi-tenant) bulut mimarisine ve şube düzeyinde **Edge Node (çevrimdışı yerel sunucu)** çalışma yeteneğine sahip, ticari kullanıma uygun bir adisyon ve restoran otomasyon platformudur.

---

## 🚀 Öne Çıkan Mimari Özellikler

- **Offline-First (Edge Node):** İnternet (WAN) kesilse bile şubenin yerel ağında (LAN) kasa, garson tabletleri, mutfak/bar ekranları ve yerel termal yazıcılar kesintisiz çalışır.
- **Sıfır Fiyat Manipülasyonu (Snapshot Pricing):** Ürün birim fiyatı ve KDV oranları sipariş anında satıra kopyalanır. Menü fiyatı değişse dahi geçmiş adisyonlar bozulmaz.
- **Masa Seçimi Öncelikli Akış:** Masa veya paket seçimi yapılmadan menü açılmaz; bir masada aynı anda en fazla 1 açık adisyon bulunabilir.
- **Mükerrer İstek Koruması (Idempotency):** Ağ tekrarlarında sipariş veya ödemeler iki kez işlenmez.
- **Güvenilir ESC/POS Yazıcı Spooler'ı:** Fiziksel baskı veritabanı transaction'ı dışına alınmıştır. Yazıcı zaman aşımında körlemesine tekrar basılmaz; mükerrer basımlarda `*** TEKRAR BASKI ***` damgası kullanılır.
- **Ön Hesap Mali Değildir:** Ön hesap dökümü açıkça bilgilendirme amaçlıdır; mali yazar kasa fişi olarak tanıtılmaz.
- **Denetim Günlüğü (Audit Log):** İptal, indirim ve masa taşıma işlemleri gerekçe ve kullanıcı bilgisiyle kalıcı olarak saklanır.
- **Şifreli Yedekleme:** SQLite `VACUUM INTO` online snapshot ve SHA-256 sağlama toplamı ile doğrulanabilir yedekleme döngüsü.

---

## 🛠️ Teknoloji Yığını

| Katman | Teknoloji | Açıklama |
|---|---|---|
| **Arayüz (SPA)** | React 19 + TypeScript + Vite | Tailwind CSS, Lucide Icons, responsive dokunmatik POS |
| **Backend** | ASP.NET Core 9 LTS + C# | Modüler Monolit; Edge (SQLite) ve Cloud (PostgreSQL) modları |
| **Yerel Veri** | SQLite (WAL Modu) | `busy_timeout=5000`, `PRAGMA synchronous=NORMAL` |
| **Canlı Ağ** | ASP.NET Core SignalR | LAN içi masa, sipariş ve KDS bildirimleri |
| **Test** | xUnit + FluentAssertions | 11/11 Otomatik Entegrasyon ve Güvenlik Testi |

---

## 💻 Windows Hızlı Kurulum ve Başlatma

### 1. Gereksinimler
- Windows 10 / 11 / Windows Server (x64)
- [.NET 9 SDK](https://dotnet.microsoft.com/download/dotnet/9.0)
- [Node.js 20+](https://nodejs.org)

### 2. Projeyi Derleme
Tüm backend ve frontend bileşenlerini tek komutla derlemek için:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build.ps1
```

### 3. Yerel Sunucuyu Başlatma
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-local.ps1 -Port 5000
```
- **Kasa ve Yönetim Ekranı:** [http://localhost:5000](http://localhost:5000)
- **Garson Tabletleri / LAN Erişimi:** `http://<Bilgisayar-IP-Adresi>:5000`

### 4. Güvenlik Duvarı İzni (Tablet ve Telefonlar İçin)
Diğer cihazların aynı Wi-Fi üzerinden kasaya erişebilmesi için PowerShell'i yönetici olarak açıp şu komutu çalıştırın:
```powershell
New-NetFirewallRule -DisplayName "MasaPilot Edge Server" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow
```

---

## 🧪 Testleri Çalıştırma

Tüm entegrasyon, çok kiracılı izolasyon, eşzamanlılık ve yedekleme testlerini çalıştırmak için:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run-tests.ps1
```

---

## 💾 Yedek Alma ve Geri Yükleme

### Yedek Alma
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup-db.ps1
```
Yedek dosyası `backups\masapilot_backup_YYYYMMDD_HHMMSS.db` ve `.sha256` manifest dosyası olarak kaydedilir.

### Geri Yükleme ve Doğrulama
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\restore-db.ps1 -BackupPath ".\backups\masapilot_backup_YYYYMMDD_HHMMSS.db"
```

---

## ⚖️ Yasal ve Donanım Sınırları

1. **Mali Belge Sınırı:** MasaPilot mutfak/bar hazırlık fişi ve adisyon ön hesap dökümü üretir. Bu belgeler Türkiye mali mevzuatı kapsamında mali fiş/fatura değildir. Yeni nesil ÖKC entegrasyonu resmi GİB protokolü çerçevesinde ayrı sertifikasyona tabidir.
2. **Yazıcı Donanımı:** İlk kurulumda testlerin sorunsuz koşabilmesi için `VirtualFake` sanal yazıcı tanımlıdır. Fiziksel kullanım için 9100 portundan standart ESC/POS Ethernet veya Windows USB sürücüsü desteklenir.
