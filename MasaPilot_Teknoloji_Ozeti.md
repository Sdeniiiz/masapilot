# MasaPilot — Önerilen teknoloji seçimi

## Önerilen çekirdek

| Katman | Öneri | Neden |
|---|---|---|
| Operasyon paneli | React + TypeScript + Vite | Telefon, tablet ve kasa ekranında ortak arayüz; strict typing ve hızlı geliştirme |
| Backend | ASP.NET Core 10 LTS + C# | Aynı backend kodu yerel edge ve bulut modunda çalışabilir; Windows servisleri/yazıcı katmanıyla doğal uyum |
| Yerel veri | SQLite (WAL, transaction) | Tek şube yerel düğümünde WAN kesintisi sırasında kalıcı operasyon verisi |
| Bulut verisi | PostgreSQL | Çok kiracılı yönetim, raporlar ve merkezi işletme kayıtları |
| ORM | Entity Framework Core | Data access, migrations, ilişkiler; SQLite ve PostgreSQL için gerçek entegrasyon testleri şart |
| Gerçek zaman | ASP.NET Core SignalR | Sipariş ve KDS durumlarının diğer LAN istemcilerine canlı aktarımı |
| Yazıcı | .NET 10 Windows Worker/Service + ESC/POS | Ethernet yazıcılar ve desteklenen USB yazıcılar için kuyruk kontrollü yerel baskı |
| Sync | Transactional outbox/inbox + idempotent event IDs | WAN kesintisi, tekrar deneme ve mükerrer kayıtların önüne geçme |
| Test | xUnit + ASP.NET Core integration tests + Playwright | Domain, API, izinler ve gerçek tarayıcı akışlarını ayrı ayrı doğrulama |

## Kritik mimari not

İnternet kesintisi ile yerel sunucu/LAN kesintisi farklı olaylardır. Yerel sunucu ve LAN çalışıyorsa WAN olmadan adisyon sürdürülebilir. Yerel sunucu veya yerel ağın kendisi çalışmıyorsa bu mimari tüm cihazlara sihirli biçimde hizmet veremez. PWA tek başına çok cihazlı çevrimdışı POS çözümü değildir.

Yerel düğüm şube operasyon verisinin otoritesidir. Bulut tarafı tenant/plan yönetimi, uzaktan raporlama ve yedek/eşitleme işlevlerini yürütür. Sipariş ve ödeme olayları UUID/idempotency key ile tekilleştirilir; katalog düzenlemelerindeki sürüm çatışmaları açık politikayla çözülür.

## Resmi teknoloji kaynakları

- React sürümleri: https://react.dev/versions
- .NET resmi destek politikası: https://dotnet.microsoft.com/en-us/platform/support/policy
- ASP.NET Core SignalR: https://learn.microsoft.com/aspnet/core/signalr/introduction
- ASP.NET Core güvenlik: https://learn.microsoft.com/aspnet/core/security/
- PostgreSQL belgeleri: https://www.postgresql.org/docs/
- OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/
