# MasaPilot — Tehdit Modeli ve Güvenlik Standartları (docs/THREAT_MODEL.md)

## 1. Güvenlik Prensipleri ve Kapsam

MasaPilot, restoran operasyonunda finansal kayıtlar, çalışan izinleri, müşteri siparişleri ve işletme sırlarını barındırır. Bu doküman OWASP Top 10 ve OWASP ASVS (Application Security Verification Standard) v4.0 prensiplerine göre yapılandırılmıştır.

---

## 2. Tehdit Matrisi ve Karşı Önlemler

| Tehdit Türü | Risk Açıklaması | MasaPilot Savunma Mekanizması |
|---|---|---|
| **Çok Kiracılı Veri İhlali (Cross-Tenant Data Leak)** | Bir işletmenin başka bir işletmenin adisyon, ciro veya menüsünü ID tahmin ederek görmesi. | **Zorunlu Global Query Filter & Route Validation:** EF Core'da tüm sorgular `TenantId` ve `BranchId` ile filtrelenir. Claim'lerden çıkarılan `TenantId` ile istek uyuşmuyorsa anında `403 Forbidden` döner. |
| **BOLA / IDOR** | Garsonun yetkisi olmayan başka şubenin veya kapalı adisyonun verisini manipüle etmesi. | Her operasyonda (`AddOrder`, `ApplyDiscount`, `CloseSession`) hedef varlığın şube mülkiyeti ve kullanıcının rol yetkisi doğrulanır. |
| **Mükerrer Sipariş / Tahsilat (Replay / Double Charge)** | Zayıf Wi-Fi bağlantısı sebebiyle istemcinin aynı siparişi veya ödemeyi iki kez göndermesi. | **Idempotency Key:** Her sipariş ve ödeme isteği istemci tarafında üretilen UUID `Idempotency-Key` taşır. Aynı anahtarla gelen ikinci istek veritabanına yeni satır eklemez, mevcut kaydı döner. |
| **Fiyat Manipülasyonu** | İstemcinin HTTP isteğinde toplam tutarı veya ürün birim fiyatını 0 TL olarak göndermesi. | **Zero-Trust Client Pricing:** İstemciden gelen fiyat veya toplamlar sunucuda asla dikkate alınmaz. Sunucu, ürünün veritabanındaki geçerli fiyatını okur ve satır toplamı ile vergileri kendisi hesaplar. |
| **Zararlı Dosya Yükleme (Malicious Upload)** | Ürün görseli yükleme alanına `.exe`, `.php` veya zararlı SVG yüklenmesi. | **Magic Byte Doğrulaması:** Dosya uzantısına güvenilmez; dosyanın ilk byte'ları JPG/PNG/WebP formatları için kontrol edilir. Dosyalar rastgele GUID ile web-root dışındaki güvenli depolama dizininde saklanır. SVG yüklemesine izin verilmez. |
| **Hassas Veri / Kart Bilgisi** | Kredi kartı numarası veya CVV gibi PCI-DSS kapsamındaki verilerin saklanması. | **Zero Card Data:** MasaPilot kart verisi toplamaz veya saklamaz. Kartlı ödemeler işletmenin harici banka POS cihazında tahsil edilir ve MasaPilot'a yalnızca "harici kart ile ödendi" bilgisi ve slipten referans no girilir. |
| **Brute Force / Parola Saldırısı** | Kasiyer PIN kodları veya yönetici girişlerine yönelik otomatik kaba kuvvet denemeleri. | **IP & Hesap Tabanlı Rate Limiting:** ASP.NET Core RateLimiter middleware ile login ve pin doğrulama uç noktaları 1 dakikada en fazla 5 başarısız denemeye izin verecek şekilde sınırlandırılır. |
| **SignalR Dinleme / Sızıntı** | Bir kullanıcının başka bir restoranın siparişlerini WebSocket üzerinden dinlemesi. | **Tenant-Branch İzolasyonlu Hub Grupları:** Kullanıcılar SignalR hub'ına bağlandığında yalnızca JWT token'larındaki `TenantId` ve `BranchId` ile oluşturulmuş özel gruplara (`branch_{branchId}`) atanır. |

---

## 3. Kimlik Doğrulama ve Oturum Güvenliği

- **Token Depolama:** Tarayıcıda `localStorage` içinde hassas token depolanmaz. Kimlik doğrulama `HttpOnly`, `SameSite=Strict`, ve (HTTPS ortamında) `Secure` bayraklarına sahip çerezler (Cookies) veya yetkili mobil istemciler için Authorization Header üzerinden yürütülür.
- **PIN Doğrulama:** Garson ve kasiyerlerin tablet/kasa üzerinde hızlı oturum açabilmesi için kullanılan PIN kodları veritabanında düz metin olarak DEĞİL, PBKDF2/Argon2 türevi tuzlu (salted) hash olarak saklanır.
- **Audit Logging:** İndirim yapma, hesap iptali, zayi/ikram satırı, adisyon birleştirme, kasa kapatma gibi tüm kritik operasyonlar `AuditLog` tablosuna aktör ID'si, tarih, işlem gerekçesi ve IP adresi ile kalıcı olarak yazılır.
