# MasaPilot — A'dan Z'ye Ürün ve Yazılım Geliştirme Ana Promptu

> Bu belgeyi güçlü bir kodlama ajanına (Cursor, Claude Code, Codex vb.) tek parça halinde ver. Proje adı **MasaPilot** olarak kalabilir; marka ismi daha sonra değiştirilebilir. Adisyo yalnızca ürün kapsamı ve kullanıcı akışları için referanstır. Marka, metinler, ekran kompozisyonları ve görsel kimlik özgün olmalıdır.

## 0. Rolün ve çalışma ilkelerin

Sen kıdemli yazılım mimarı, ürün tasarımcısı, full-stack geliştirici, veritabanı mühendisi, DevOps ve uygulama güvenliği mühendisi, QA/test mühendisi gibi davran. Bu, tek kafeye yapılan basit bir CRUD uygulaması değil; çok işletmeli, abonelikle satılabilecek ve gerçek işletmede günlük operasyonu durdurmaması gereken bir restoran POS/adisyon platformudur.

- Önce mevcut depoyu/klasörleri incele. Var olan kullanıcı verilerini, `.env`, veritabanını veya yüklenmiş ürün fotoğraflarını izinsiz silme. Şema değişikliğini geri alınabilir migration ile yap.
- Yalnızca ekran maketi üretme. Formların, butonların, API'lerin, veri tabanı işlemlerinin, yazıcı işlerinin ve eşitlemenin gerçekten çalışmasını sağla.
- Sahte başarı mesajı, işlevsiz buton, göstermelik test, rastgele demo verisiyle gerçek özelliği gizleme veya `TODO` bırakma. Uygulanmamış özellikleri açıkça “henüz yok” diye işaretle.
- Kodlamadan önce mimari kararları, modülleri, veri modeli ve test yaklaşımını kısa bir `docs/ARCHITECTURE.md` dosyasında yaz. Ardından sadece plan vermekle kalma; uygulamayı gerçekten oluştur ve testleri çalıştır.
- Her aşama sonunda çalıştırılan komutları, başarılı/başarısız testleri, bilinen sınırları ve bir sonraki adımı raporla. Başarısız test varsa saklama.
- “Kusursuz/güvenli” olduğunu kanıtsız iddia etme. Güvenlik ve güvenilirlik için somut kontroller, testler, izleme ve yedekleme uygula.
- Harici ücretli servis, ücretli API veya kullanıcıya ait olmayan gizli anahtar gerektiren özelliği varsayılan olarak kullanma. Gerekirse `.env.example`, dokümantasyon ve çalışır yerel alternatif sağla.
- Adisyo'nun adını, logosunu, metinlerini veya ekranını kopyalama. Sadece işlev kapsamını ve kullanım kolaylığını referans al; özgün bir marka, bileşen dili, metin ve sayfa düzeni oluştur.

## 1. Ürün tanımı ve ana hedef

MasaPilot, kafe/restoran işletmelerinin kendi çalışma alanını oluşturabildiği çok kiracılı (multi-tenant) bir SaaS + yerel ağ POS ürünüdür. Her işletme/şube kendi menüsünü, fotoğraflarını, salon ve masa planını, çalışanlarını, hazırlık istasyonlarını, yazıcılarını ve ödeme türlerini yönetir.

**En önemli şart:** İnternet (WAN) kesilse dahi restoranın yerel sunucusu ve yerel ağı çalışıyorsa, aynı LAN'daki kasa bilgisayarı, garson telefonları/tabletleri ve mutfak/bar ekranları sipariş almaya ve yerel yazıcıya iş göndermeye devam etmelidir. Yerel bilgisayarın kendisi, elektrik veya LAN çökerse çalışmaya devam edeceğini iddia etme; hata durumunu dürüstçe göster.

Sistem üç kullanıcı yüzeyine ayrılır:
1. **Herkese açık pazarlama sitesi:** özellikler, ekran görüntüleri, paketler, demo talebi, SSS, iletişim, gizlilik/KVKK metinleri ve işletme kayıt/başvuru akışı.
2. **Bulut yönetim portalı:** platform yöneticisinin tenant/işletme, abonelik/deneme, şube, cihaz, eşitleme sağlığı, yedekleme durumu ve destek taleplerini yönetmesi. İnternet varsa uzaktan raporlama ve yetkili yönetim.
3. **Yerel operasyon uygulaması:** şubedeki yerel sunucudan servis edilen masa, adisyon, kasa, mutfak/bar, ürün ve ayar ekranları. İşletmenin gerçek zamanlı operasyonundaki otorite yerel düğümdür. Bulut bağlantısı yokken yerel operasyonu buluta bağımlı hale getirme.

## 2. Önerilen teknoloji mimarisi

Birbirinden kopuk birkaç farklı uygulama yerine, ortak domain/business logic kullanan **modüler monolit + edge/local node** tasarla. Gereksiz mikroservis oluşturma.

### İstemci arayüzü
- React 19.x + TypeScript (strict mode) + Vite.
- React Router; form yönetimi için React Hook Form + Zod; sunucu durumu için TanStack Query; yerel ve geçici UI durumu için Zustand veya sade Context (tek state kütüphanesi seç, karıştırma).
- Tasarım sistemi: Tailwind CSS + erişilebilir bileşen kütüphanesi (ör. shadcn/ui/Radix); tüm özel bileşenler tipli ve yeniden kullanılabilir olsun.
- PWA özellikleri kontrollü kullanılmalı. Yerel ağdaki HTTP adreslerinde service worker her cihazda kurulabilir varsayma. Asıl çevrimdışı çalışma yerel sunucu + yerel veritabanı sayesinde sağlanmalı; PWA cache'i bunun yerine geçmez.
- UI Türkçe (tr-TR), TL (TRY), Europe/Istanbul saat dilimi, Türkçe karakterler ve klavye/dokunmatik kullanımına uygun olmalı. Para değerleri kayan nokta ile değil, decimal/uygun minor unit yaklaşımıyla tutulmalı.

### Sunucu ve gerçek zaman
- ASP.NET Core 10 LTS + C#; ASP.NET Core Identity veya güvenli, bakımlı kimlik doğrulama altyapısı; EF Core.
- Aynı kod tabanı hem `Edge` (şube yerel düğümü) hem de `Cloud` (merkezi SaaS) konfigürasyonuyla çalışmalı; modlar environment/config ile seçilmeli. Domain kuralları iki kez kopyalanmamalı.
- Yerel operasyon veritabanı: SQLite (WAL modu, busy timeout, transaction ve tek yazıcı/iş kuyruğu yaklaşımı ile). Bir şubedeki yazma işlemlerini tek yerel API üzerinden geçir; cihazların doğrudan SQLite dosyasına erişmesine izin verme.
- Bulut veritabanı: PostgreSQL'in güncel desteklenen kararlı sürümü. EF Core ile kullanılan iki sağlayıcının uyumluluğunu gerçek migration ve entegrasyon testleriyle doğrula; sağlayıcıya özel SQL kullanımını sınırla.
- Gerçek zamanlı sipariş/istasyon güncellemeleri için ASP.NET Core SignalR. WebSocket bağlantısı yoksa kontrollü yeniden bağlanma ve sınırlı aralıklı polling fallback'i ekle.
- Yerel edge Windows'ta servis olarak çalışmalı ve bilgisayar açıldığında otomatik başlamalı. Windows Service/Worker Service tercih et. Web API ile yazıcı işçisi aynı kurulum paketinden yönetilebilir.
- Yazdırma: Ethernet ESC/POS ilk sınıf; USB için Windows sürücüsü/uyumlu ESC/POS bağlantısı ve kullanıcı dostu kurulum sihirbazı. Her marka/modelin uyumlu olduğunu iddia etme; desteklenen modelleri dokümante et ve gerçek cihazla doğrula.
- Cloud işleri için dayanıklı kuyruk; yerelde yazdırma kuyruğu ve sync outbox kesinlikle diske kalıcı yazılmalı. In-memory queue tek başına kritik işlemlerde kullanılmamalı.
- Görsel yükleme için doğrulanan JPG/PNG/WebP dosyaları, boyut sınırı, güvenli isimlendirme ve yerel depolama; bulut senkronizasyonu için sürümlü dosya metadata'sı. Sadece uzak URL yazmayı tek fotoğraf seçeneği yapma.

### Ağ ve kurulum ilkeleri
- Yerel düğüm her şubede tek operasyonel otoritedir. POS, garson ve KDS istemcileri yerel düğümle aynı LAN üzerinden konuşur.
- WAN interneti kesilse bile LAN işlemleri sürer. Yerel sunucuya ulaşılamıyorsa açık ve belirgin bağlantı durumu, son veri zamanı ve güvenli yeniden deneme göster.
- Bulutla eşitleme, yerel kullanıcı işlemini bekletmemeli. Outbox/Inbox, benzersiz olay ID'si, idempotent işleyici, tekrar deneme/backoff, dead-letter/manuel inceleme ve sync health görünümü olmalı.
- Olay modeli append-only olmalı; kapalı adisyonun geçmişini güncel ürün fiyatı değiştirerek bozmamalı. Satış satırında ürün adı, fiyat, vergi/kDV ayarı, varyant ve indirim o anki haliyle snapshot olarak saklanmalı.
- Eşitlemede son yazan kazanır yaklaşımını kritik sipariş/tahsilat verisine körlemesine uygulama. Sipariş/tahsilat olayları benzersiz UUID ve idempotency key ile tekilleştirilmeli; çakışan katalog/ayar düzenlemeleri sürüm ve açık çözüm politikasıyla ele alınmalı.

## 3. Tenant / şube / kullanıcı modeli

Veri hiyerarşisi: `Platform → Tenant (işletme grubu) → Branch (şube) → Area/Floor → Table`. Tek işletme birden fazla şube ve her şube birden fazla alan/bar/mutfak istasyonu içerebilir.

Her tenant'a ait veride tenant_id; şubeye ait her operasyonda branch_id zorunlu olmalı. Tenant/branch kimliği istemcinin gönderdiği değere güvenilerek belirlenmemeli; authenticated principal ve sunucu tarafı yetkilendirmeden türetilmeli. Her sorgu, yazma, indirme, export, dosya erişimi, SignalR grubu ve background job scope kontrolünden geçmeli.

Gerekli rol ve izinler:
- Platform Owner/Super Admin: tenant ve plan yönetimi; müşteri sipariş içeriğine varsayılan erişim yok, destek erişimi gerekiyorsa onaylı ve denetlenebilir “break-glass” süreç.
- İşletme Sahibi: kendi tenant ve şubeleri, menü/ürünler, kullanıcılar, ödeme türleri, raporlar ve ayarlar.
- Şube Müdürü: yalnızca atanmış şube ve izin verilen yönetim işlemleri.
- Kasiyer: masa/adisyon, ön hesap, tahsilat kaydı, izinli iade/iptal akışı.
- Garson: masa görme, sipariş ekleme, kendi rolünün izin verdiği düzenleme; tahsilat/indirim/iptal yetkisi ayrı ayarlanmalı.
- Mutfak/Bar: yalnızca ilgili istasyon siparişleri, hazırlanıyor/hazır/tamamlandı durumları.
- Rapor kullanıcıları: sadece açıkça izin verilen raporlara salt okunur erişim.

En az ayrıcalık prensibi uygula. Sadece UI'da menüyü saklamak güvenlik değildir; her API route/resource için authorization policy/handler yaz.

## 4. Veri modeli ve veri bütünlüğü

En azından şu varlıkları düzgün ilişkiler, foreign key, unique constraint ve index'lerle modelle:
- Tenant, Branch, BranchDevice, Subscription/Plan/Trial, User, Role, Permission, UserBranchRole.
- Area/Floor, DiningTable, TableSession/Adisyon, Order, OrderLine, OrderLineModifier, Product, Category, ProductImage, ModifierGroup/ModifierOption, TaxProfile, PriceHistory.
- KitchenStation, ProductStationRoute, Printer, PrinterStationRoute, PrintJob, PrintAttempt.
- PaymentMethod, Payment, PaymentAllocation, Discount, Void/Refund record, Shift, CashMovement.
- InventoryItem, Recipe/BOM, RecipeLine, StockMovement, Supplier/Purchase (stok modülü fazlandırılabilir ancak temel veri yapısını kararlı kur).
- Customer (isteğe bağlı), Delivery/PickupOrder (fazlandırılabilir).
- AuditLog, OutboxEvent, InboxEvent, SyncCursor, BackupRecord, SupportTicket.

Kurallar:
- Aynı şubede bir masa için aynı anda en fazla bir açık masa adisyonu olsun; bunu yalnızca frontend kontrolüyle değil DB constraint + transaction ile koru.
- Sipariş ekleme, stok düşme ve event/outbox oluşturma gereken durumlarda transaction sınırı belirgin olsun.
- Satır fiyatı, toplam, vergi, indirim ve ödeme tutarları sunucuda hesaplanmalı; istemcinin gönderdiği toplam güvenilir kabul edilmemeli.
- Para ve miktarların decimal hassasiyeti açıkça belirlenmeli; floating-point hesapla para tutma.
- Kapalı adisyon/ödeme üzerinde sessizce değişiklik yapma. Düzeltme, iptal ve iade ayrı, yetkili kullanıcı + gerekçe + audit event ile yapılmalı.
- Masa taşıma/birleştirme, adisyon bölme, kısmi tahsilat ve birden fazla ödeme yöntemi senaryolarını transaction ve eşzamanlılık açısından tanımla.
- Soft-delete sadece uygun katalog kayıtlarında kullan. Finansal/audit olaylarını silme; düzeltme olaylarıyla ekle.

## 5. Ekranlar ve UX akışları

Bütün buton ve formlarda gerçek işlem, yükleme/başarı/hata durumları ve erişilebilir odak yönetimi olsun. Native `alert()`, `confirm()` ve `prompt()` kullanma. Bildirimler sayfanın alt köşesinde kısa süreli toast; kritik işlem onayları uygulama içinde tasarlanmış modal/drawer; alan doğrulama hataları ilgili alanın altında gösterilsin. Tarayıcının üstünde mesaj kutusu veya yerel browser dialog açılmasın.

### A. Pazarlama sitesi
- Modern, güven veren B2B SaaS ana sayfası; hero, gerçek ürün ekranı önizlemesi, faydalar, özellik modülleri, sektör tipleri, paket karşılaştırma, demo talep formu, sık sorulan sorular, iletişim, yasal sayfalar.
- Responsive, erişilebilir, hızlı; sayfa başlıkları, description, OG meta, canonical, sitemap, robots, yapılandırılmış veri ve Türkçe içerik.
- Gerçek olmayan müşteri sayısı, referans, sertifika, uptime veya performans iddiası yazma. “%100 kusursuz”, “sıfır hata” gibi kanıtsız pazarlama ifadeleri kullanma.

### B. Giriş, ilk kurulum ve onboarding
- İşletme oluşturma: işletme adı, slug, şube adı, saat dilimi, para birimi, vergi ayarları; ilk owner hesabı; benzersiz tenant; varsayılan roller; ilk şube.
- Kullanıcı daveti ve şifre sıfırlama güvenli olsun. İlk girişte 3-5 adımlı kurulum: işletme bilgileri → alan/masa → kategori/ürün → mutfak/bar istasyonları ve yazıcı → ödeme yöntemleri → test siparişi.
- Demoyu gerçek tenant verisine karıştırma; demo tenant'ı açıkça etiketle ve gerçek veriden fiziksel/mantıksal olarak ayır.

### C. Masa ve sipariş alma (en yüksek öncelik)
- POS masa görünümünde alan sekmeleri (Salon, Bahçe, Teras vb.), arama, boş/dolu/hesap istendi/rezervasyon durumu ve okunabilir renk+metin kombinasyonları.
- **Önce masa veya sipariş türü seçilmeli; seçim olmadan ürün menüsü açılmamalı.** Masa seçilince o masa için açık adisyon getir/oluştur; sonra ürün menüsünü göster. Gel-al/paket gibi masa dışı siparişler ayrı, açıkça seçilen sipariş türünden başlatılmalı.
- Masa seçilince büyük dokunma hedefleri ve ürün kartlarıyla hızlı menü açılır. Kategori sekmeleri, ürün arama, favoriler, ürün fotoğrafı varsa fotoğraf, fiyat, varyant/ekstra ve özel not.
- Ürün adı ve fiyat girerken polling/re-render nedeniyle form alanları sıfırlanmasın. Kontrollü form state'i kullan; arka plan veri yenilemesi kullanıcı tarafından değiştirilmekte olan formu resetlemesin.
- Sağ tarafta (mobilde alt drawer) sipariş özeti ve toplamlar sabit/erişilebilir olsun. Ürün miktar +/-; satır notu; gönderilmemiş sepet ve mutfağa gönderilmiş sipariş bölümü farklı gösterilsin.
- “Mutfağa Gönder” işleminden önce backend siparişi kalıcı olarak kaydetsin. İstemci timeout olduğunda otomatik tekrar aynı idempotency key ile yapılsın.
- Ürün kaldırma/iptal sebebi, kimin yaptığı ve mutfak fişine iptal bildirimi gerekiyorsa bağlı bir iptal print job kaydedilsin.

### D. Ürün, kategori ve menü yönetimi
- Kategori CRUD, ürün CRUD, SKU/internal code opsiyonel, adı, kısa açıklama, fiyat, vergi profili, görsel yükleme, aktif/pasif ve stokta yok durumu.
- Görsel yerel dosya yükleyerek seçilebilsin; önizleme, kırpma/yeniden boyutlandırma, dosya tipi ve boyut sınırı, değiştirme/silme. Görsel olmadan ürün ekleme de mümkün olmalı.
- Ürün seçenekleri/ekstralar (boy, süt, pişirme, sos vb.), zorunlu ve opsiyonel gruplar, minimum/maksimum seçim, ek ücret ve stokta yok seçeneği.
- Bir ürünün hangi mutfak/bar istasyonuna ve hangi yazıcıya gideceği ayarlanabilsin. Bir ürün birden fazla istasyona rota edilecekse bu davranış açık olsun.
- Excel/CSV menü içe aktarma şablonu, önizleme, validation error raporu ve duplicate koruması sonraki fazda; basit tek tek ürün işlemi ilk sürümde kusursuz olsun.

### E. Mutfak ve bar (KDS)
- Ayrı URL/cihaz modu, yalnızca yetkili istasyon siparişlerini gösterme.
- Yeni → hazırlanıyor → hazır → teslim edildi; sipariş yaşı/gecikme; sesli uyarı ayarı; büyük yazı; dokunmatik kullanım; istasyon/ürün bazlı filtre.
- Yeni sipariş ve ürün ekleri ayrı anlaşılır bileşenler olarak görünmeli; sonradan eklenen ürün sadece yeni satır olarak iletilmeli. İptal edilen satır görünür iptal işaretiyle belirtilmeli.
- Eş zamanlı iki operatör aynı siparişi değiştirirse çakışmayı engelle: sürüm numarası/optimistic concurrency ve backend state transition validation.

### F. Yazdırma otomasyonu
- İstasyona göre otomatik yönlendirme: mutfak sadece mutfak ürünleri, bar yalnızca bar ürünleri. Her fişte tenant/şube adı, masa/sipariş numarası, sipariş zamanı, ürün/miktar, not, gönderim sürümü ve gerekli operasyon bilgisi.
- Yazdırma işi, sipariş transaction'ı içinde kalıcı `PrintJob`/outbox kaydı oluşturularak güvenilir hale getirilmeli. Yazdırma işlemi DB transaction'ının içinde fiziksel baskı yapmamalı.
- Durumlar: queued, claimed, printing, printed/confirmed, retryable_failed, manual_review, cancelled. Her deneme, hata ve zaman damgası saklanmalı.
- Başarısız/timeout baskıdan sonra yazıcının fişi aslında basıp basmadığı bilinmiyorsa körlemesine otomatik tekrar yapma; “baskı durumu belirsiz, kontrol et ve yeniden bas” ekranı göster. Kullanıcı kontrollü yeniden yazdırma açıkça “TEKRAR BASKI” olarak işaretli olsun.
- En az bir kez teslim/at-least-once kuyruk + idempotent job kaydı kur; fiziksel yazdırmada exactly-once garantisi varmış gibi davranma. Windows servis kapanıp açıldığında kuyruk kurtarılsın.
- Yazıcı durum sayfası: erişilebilirlik, son başarılı baskı, kuyrukta bekleyen, başarısız işler, test fişi, istasyon eşlemesi, USB/Ethernet kurulum adımları.
- Üretimde gerçek yazıcı olmadan yapılan testler `FakePrinter` ile açıkça işaretlensin. Donanım testi için ayrıca checklist ver.

### G. Hesap, ön hesap ve tahsilat
- Hesap ekranı masadaki ürün satırlarını, miktarları, birim fiyat snapshot'ını, indirim/vergi ve toplamı gösterir.
- “Ön hesap yazdır” ayrı eylemdir ve sadece hesabın dökümünü basar. Bu çıktı mali fiş/yazar kasa fişi gibi tanıtılmamalı.
- Ödeme yöntemlerini işletme sahibi tanımlasın: nakit, banka/kredi kartı (harici POS'ta tahsil edilmişse kayıt), yemek kartı seçenekleri ve şirket içi izinli yöntemler. İlk sürüm kart numarası/PCI verisi toplamasın; gerçek tahsilat entegrasyonu varmış gibi davranmasın.
- Kısmi tahsilat, bölünmüş hesap ve çoklu ödeme türü muhasebe kuralları açıkça tanımlansın. Açık bakiye, iade/iptal, fazla/eksik ödeme engellensin.
- Tahsilat kaydı idempotent, audit log'lu ve tenant/branch scope'lu olmalı. Aynı ödeme isteği yeniden gönderildiğinde iki kez tahsilat kaydı açılmamalı.
- Türkiye mali mevzuatı için gerçek mali fiş/yeni nesil ÖKC entegrasyonu ayrı teknik ve yasal iş paketidir. Mock ön hesap çıktısını resmi belge gibi gösterme; GİB/ÖKC uyumluluğu doğrulanmadan “mali fiş basar” deme.

### H. Yönetim ve raporlar
- İşletme ayarları: logo, işletme adı, şubeler, çalışma alanları, vergi/para formatı, ödeme yöntemleri, çalışanlar, roller, istasyonlar, yazıcılar, sipariş numarası ve fiş görünümü.
- Raporlar: tarih filtresiyle net/brüt satış, ödeme yöntemi toplamı, ürün/kategori bazlı satış, iptal/indirim, vardiya/kasa hareketi, garson ve istasyon performansı. Her raporun formülü ve tarih sınırları belgelenmiş olsun.
- İptal, indirim, geçmiş adisyon görüntüleme, dışa aktarma ve yönetici işlemleri audit log'a yazılsın.
- Stok/maliyet modülü fazlı geliştirilsin: reçete/BOM, stok giriş/çıkış, satışta reçete miktarı düşümü, fire, sayım, kritik stok ve maliyet raporu. Stok verisini doğru kurmadan eksiksiz stok takibi iddia etme.

## 6. Tasarım sistemi ve görsel kalite

Özgün, profesyonel, hızlı, sakin ve operasyon odaklı bir B2B arayüz tasarla. Bir POS terminali için dekoratif görsellikten önce hız, okunabilirlik ve yanlış dokunmayı azaltma önemlidir.

- Ana masaüstü POS düzeni: sol bölüm/masa paneli; ortada menü ve kategori/ürün kartları; sağda adisyon sepeti. Kasa ekranında kritik tutarlar belirgin ve okunabilir; en sık kullanılan eylemler birincil butonlar.
- Telefonda: tek kolon, geniş dokunma alanı (tercihen en az 44x44 CSS px), masa seçimi → ürün menüsü → sabit alt sepet akışı; gereksiz yatay kaydırma yok. Küçük ekranlarda ürün adı/fiyat/ekleme butonu kesilmesin.
- KDS: koyu/kontrast arka plan opsiyonu, yüksek kontrast, büyük tipografi; yeni/hazırlanıyor/hazır renkleri aynı zamanda metin/ikonla belirtilsin (sadece renk farkı kullanma).
- Yönetim paneli: sol navigasyon, üst şube seçici, içerik alanı; tablo filtreleri, boş durum, skeleton, hata durumu, kaydediliyor durumu ve başarı geri bildirimi.
- Renk/token, spacing, typography, radius, shadow ve focus-ring sistemi tanımla. Marka renklerini Adisyo'dan kopyalama. Renk kontrastı WCAG 2.2 AA hedefi; klavye navigasyonu ve screen reader label'ları.
- Responsive hedefler: küçük telefon 360px; orta 768px; dizüstü 1280px; kasa ekranı 1440px+. Görseller sıkıştırılsın; liste ekranlarında pagination/virtualization gerektiği yerde uygulansın.
- İlk etapta tüm ekranlara animasyon yükleme. Hızlı geçişler ve azaltılmış hareket ayarı (`prefers-reduced-motion`) kullan.
- Her ekranın UI state'leri tamam olsun: loading, empty, error, offline, retrying, disabled, success, validation. Browser `alert/confirm/prompt` kesinlikle yok; uygulama içi dialog + toast sistemi kullan.

## 7. Güvenlik tehdit modeli ve zorunlu kontroller

- OWASP ASVS ve OWASP API Security ilkelerine göre tehdit modeli oluştur. En azından kimlik doğrulama, yetkilendirme, tenant veri sızıntısı, IDOR/BOLA, CSRF, XSS, SQL injection, brute force, SSRF, dosya upload, session hijack, secrets, replay, sync spoofing ve fiziksel cihaz yetkilendirmesi için kontroller tasarla.
- Password hashing için framework'ün güncel güvenli mekanizmasını kullan; düz metin/parola loglama yapma. Login/forgot-password endpoint'lerine rate limit, güvenli hata mesajları ve gerekiyorsa MFA/TOTP desteği.
- Browser auth token'larını `localStorage` içine koyma. SameSite/HttpOnly/Secure cookie ve CSRF politikasını seçilen mimariye göre doğru uygula. API'yi CORS `*` ile açma.
- TLS: bulut için HTTPS zorunlu. Edge-to-cloud outbound TLS; token/cihaz anahtarları ayrı tenant/device scope'lu, rotate/revoke edilebilir olsun. LAN HTTP ve PWA güvenlik bağlamı sınırlamalarını dokümante et; yerel ağ güvenliğini “LAN zaten güvenlidir” diye varsayma.
- Her tenant/şube kaynağında sunucu tarafı ownership validation. Başka tenant'ın ID'sini yollama testleri. SignalR private groups tenant+branch auth doğrulamasıyla kurulmalı.
- Rate limiting, request size limit, content-type validation, model validation, ORM parametreleme, secure headers, CSP, anti-clickjacking, HSTS (HTTPS'te), secret manager/env ve bağımlılık taraması.
- Upload edilen fotoğrafların magic bytes ve içerik türünü doğrula; dosya adını kullanıcıdan direkt alma; dosyaları çalıştırılabilir web root altında saklama; SVG'yi sanitize etmeden kabul etme.
- Audit log'da actor, tenant, branch, entity ID, action, reason, correlation ID, timestamp ve gerekli before/after özetini kaydet; parola, token, ödeme kartı hassas verisi yazma.
- Müşteri bilgilerini gereksiz toplama. KVKK aydınlatma, saklama/silme politikası, veri dışa aktarma ve yetkili erişim planı için dokümantasyon oluştur; hukuki uyumun hukuk danışmanı tarafından doğrulanması gerektiğini açıkça not et.
- Tenant verisini test/backup loglarında başka kullanıcıya göstermemek için redaction uygula. Prod'a demo admin/parolası veya sabit secret koyma.

## 8. Senkronizasyon, yedekleme ve kurtarma

- Yerel işletme operasyon verisinin authoritative kaynağı Edge DB'dir. Tüm önemli yazma işlemleri local DB transaction'ında kaydedilir ve aynı transaction içinde OutboxEvent oluşturur.
- Sync agent yalnızca dışarıya doğru TLS bağlantısı kurarak buluta olay gönderir. Bulutun şube ağına inbound bağlantı açması zorunlu olmasın.
- Her event: `event_id` UUID, tenant_id, branch_id, aggregate_type/id, schema_version, sequence/version, occurred_at UTC, payload, idempotency key. Payload içinde gereksiz kişisel veri taşınmasın.
- Cloud Inbox, event_id/tenant+branch sequence unique kısıtlarıyla tekrar gönderilen olayı idempotent işler. Ack verilmeyen olaylar retry/backoff ile gönderilsin. Geçersiz/uyumsuz event ölü kuyruğa/incelemeye alınsın ve panelde gösterilsin.
- Cihazların saatleri sapabilir; sıralamada sadece wall-clock timestamp'e güvenme. Aggregate sequence/version kullan.
- Yedekleme şifreli, otomatik, dönüştürme sonrası doğrulanmış ve geri yükleme testi yapılabilir olsun. En az günlük tam yedek + sık kritik veri checkpoint'i için politika tasarla; gerçek saklama süresi ve hedef RPO/RTO konfigüre edilebilir olsun. Yedeği sadece oluşturmak değil, test ortamında geri yüklemek de test planında yer alsın.
- Edge disk alanı, veritabanı boyutu, son bulut bağlantısı, bekleyen outbox, yazdırma kuyruğu ve son yedek durumu health ekranında görünmeli.

## 9. Test stratejisi — kod yazmak kadar önemli

Unit, integration, API, authorization, end-to-end ve failure/recovery testleri ekle. Testleri gerçekten çalıştır; raporda komut ve sonuçları paylaş.

Zorunlu senaryolar:
1. Tenant A kullanıcısı Tenant B ürünü/masa/adisyon/rapor/dosya/print job ID'sini tahmin edip erişemez.
2. Aynı masada iki cihaz eş zamanlı adisyon açmaya çalışır; duplicate açık adisyon oluşmaz.
3. Aynı sipariş POST'u aynı idempotency key ile iki kez gelir; tek sipariş/tek satır oluşur.
4. Ürün adı ve fiyatı girilirken background refresh form alanlarını temizlemez.
5. Masa seçilmeden ürün menüsü gösterilmez; masa seçilince ilgili adisyon yüklenir.
6. Ürün fotoğrafı yükleme: geçersiz MIME, aşırı boyut, path traversal ve bozuk dosya reddedilir.
7. Ürün rota kuralı mutfak/bar print job'larını doğru istasyona yönlendirir.
8. Yazıcı kapalı, zaman aşımı, worker kapanması ve tekrar açılması senaryolarında PrintJob kaybolmaz; belirsiz baskı mükerrer otomatik baskı üretmez.
9. Sipariş kaydedilirken process crash olursa sipariş ve outbox beraber tutarlı kalır; yarım transaction kalmaz.
10. İnternet kesilirken LAN siparişi, KDS ve yerel baskı çalışır; WAN gelince aynı event sadece bir kere buluta yansır.
11. Local DB ve cloud DB migration/serialization testleri.
12. Kısmi tahsilat, bölünmüş hesap, fazla ödeme, aynı ödeme isteğinin tekrar gönderilmesi ve kapalı hesabı düzenleme sınırları.
13. Garsonun yöneticiye özel indirim/iptal/rapor endpoint'lerine erişimi reddedilir.
14. SignalR tenant/branch channel sızıntısı yoktur.
15. Yedek alıp geri yükleme ile doğrulama/row count/checksum testi.
16. Mobil 360px, tablet, masaüstü 1280/1440px arayüz kontrolleri; form state ve toast/modal e2e testleri.
17. Fiyat değişince daha önce açılmış adisyonun snapshot fiyatı değişmez.
18. Yetkili iptal/indirim işleminde gerekçe ve audit event mevcuttur.

Mümkünse Playwright ile gerçek browser e2e; xUnit ile .NET unit/integration tests; API için integration test server; tenant isolation için otomatik test. Donanım testi gerektiren durumları “fake printer test” olarak ayrı belirt, gerçek fiziksel test yapılmış gibi gösterme.

## 10. Performans ve gözlemlenebilirlik

- Kritik kullanıcı işlemleri için hedef belirle ve ölç: yerel ağda yaygın test donanımında masa açma/sipariş ekleme API yanıtı p95 < 300ms (gerçek test ortamıyla doğrula); UI ilk anlamlı ekran ve arama yanıtı için ölçüm ekle. Donanım test edilmeden hedefe ulaştığını iddia etme.
- Index'ler: tenant_id/branch_id + tarih/status/aggregate sorgu örüntülerine göre tasarlansın. N+1 sorgular, tüm veri setini çekme ve her 2 saniyede tüm tabloları yenileme yapma.
- Yapılandırılmış log, correlation ID, hata izleme, health endpoints, local disk/DB/queue/sync health metriği. Hassas veriler loglara girmesin.
- Arayüzde connection badge: Yerel sunucu bağlantısı (bağlı/değil), bulut eşitlemesi (senkron/beklemede/hata), yazıcı durumu ayrı gösterilmeli. İnternetin varlığı, yerel sunucu erişimiyle karıştırılmamalı.

## 11. Fiş ve hukuki sınırlar

Mutfak/bar hazırlık fişi ve ön hesap dökümü, mali belge değildir. İlk sürümde sadece operasyon fişi ve ön hesap yazdır. Türkiye'de mali fiş/yeni nesil ödeme kaydedici cihaz (YN ÖKC) entegrasyonu ayrı bir entegrasyon/uyumluluk fazıdır; ilgili GİB protokolü, cihaz üreticisi SDK'sı, sertifikasyon ve mali müşavir/hukuk danışmanı görüşü doğrulanmadan uyumluluk iddiasında bulunma. Uygulama ödeme kartı verisi saklamasın.

## 12. Teslim edilecek dosyalar

- Çalışan kaynak kodu ve net repo yapısı.
- `.env.example` (gerçek secret yok), local config örneği.
- `README.md`: Windows kurulumu, geliştirici kurulumu, yerel sunucu açma, LAN'dan erişim, port/firewall, kullanıcı oluşturma, migration, test, yedek/geri yükleme, güncelleme ve kaldırma.
- `docs/ARCHITECTURE.md`, `docs/THREAT_MODEL.md`, `docs/DATA_MODEL.md`, `docs/PRINTING.md`, `docs/OFFLINE_SYNC.md`, `docs/BACKUP_RESTORE.md`, `docs/OPERATIONS_RUNBOOK.md`.
- Windows kurulum/başlatma/durdurma/yedek alma/test betikleri veya installer; scriptlerin idempotent ve hata durumunda anlaşılır olması.
- DB migrations ve demo seed'leri; demo seed yalnızca açık komutla oluşturulsun, production kurulumuna varsayılan admin koyma.
- Unit/integration/E2E testleri ve `TEST_REPORT.md`.
- Basit ama gerçek işlevli pazarlama sayfası ve ürün içi onboarding.
- Demo verileriyle ekran görüntüsü veya Playwright screenshot seti (gerçek çalışan arayüzden üret; tasarım mockup'ını gerçek uygulama diye sunma).

## 13. Aşamalı yürütme planı

Her aşamayı gerçekten bitirip test etmeden bir sonrakine atlama. Bununla birlikte yalnızca plan yazıp bekleme; çalışma ortamında ulaşılabilir aşamaları uygula.

**Faz 0 — Keşif ve tasarım:** mevcut repo kontrolü, kabul kriterleri, modül haritası, veri modeli, tehdit modeli, wireframe listesi, teknik karar kayıtları.

**Faz 1 — Çalışan altyapı:** backend modları (Edge/Cloud), veritabanı migration'ları, login/role policy, tenant ayrımı, audit/outbox, setup wizard, health status, test setup.

**Faz 2 — POS çekirdeği:** alan/masa, kategori/ürün/görsel, masa seç → menü → sepet → adisyon → mutfağa gönder; transaction/idempotency; responsive masaüstü ve telefon arayüzü.

**Faz 3 — KDS ve yazıcı:** station routing, local print worker, Ethernet/USB bağlantı sağlayıcıları, queued/failed/manual-review UI, fake printer ve donanım test dokümanı.

**Faz 4 — Hesap/kasa:** ön hesap, ödeme türleri, split/partial payment, shifts, void/refund workflow, audit ve rapor.

**Faz 5 — Offline/sync:** WAN disconnect/reconnect, outbox/inbox, idempotency, conflict policy, sync dashboard, backup/restore.

**Faz 6 — Tenant SaaS + website:** tenant provisioning, paket/deneme, cloud dashboard, eşitleme/cihazlar, marketing site, demo request, SSS/legal placeholders.

**Faz 7 — Hardening & QA:** tenant isolation testleri, security scan, accessibility, 360px/desktop test, yük/failure testleri, restore testi, installer testi ve release checklist.

## 14. Kabul kriterleri — teslim ettiğini iddia etmeden önce

- Sıfır işlevsiz temel buton; tüm navigasyon, form ve işlemler çalışan backend endpoint'ine bağlı.
- Yeni tenant oluşturulduğunda varsayılan veriler güvenli şekilde oluşur ve başka tenant'a erişim mümkün değildir.
- Aynı LAN'da en az iki istemci aynı şubede aynı anda sipariş akışını kullanabilir.
- WAN kablosu/internet bağlantısı kesildiğinde yerel masa/sipariş/KDS/yazdırma devam eder; internet gelince olaylar tekilleştirilerek eşitlenir.
- Mutfak ve bar yalnızca kendisine yönlendirilen ürünleri görür/yazdırır.
- Yazdırma hatası kaybolmaz; tekrar baskı açıkça işaretlenir ve durum belirsizliği kullanıcıya anlatılır.
- Ürün formu alanları veri yenilenmesiyle sıfırlanmaz; fotoğraf yerel dosyadan seçilip gösterilebilir.
- Masa seçilmeden menü gösterilmez; modal/toast bildirimleri browser dialog açmaz.
- Kritik tenant/auth/payment/order/sync testleri geçer; test sonucu gerçek komut çıktısından alınır.
- Başlangıç/kurulum/yedek/geri yükleme adımları Windows üzerinde temiz bir ortamda denenir ve belgelenir.
- Geliştirilmemiş parçalar ve gerçek donanımda doğrulanmayan bağlantılar teslim notunda açıkça belirtilir.

## 15. İlk yanıtında ve ilerleme raporunda beklenen format

1. Mimari kararlar ve nedenleri (kısa).
2. Oluşturulan/değiştirilen dosya ağacı.
3. Gerçekte çalışan özellikler ve eksik kalanlar.
4. Çalıştırılan test komutları ve sayısal sonuçları.
5. Windows'ta adım adım başlatma yönergesi.
6. Herhangi bir gerçek donanım/yasal entegrasyonun test edilmediği durumlarda açık uyarı.

Şimdi mevcut çalışma alanını incele, `docs/ARCHITECTURE.md` oluştur, sonra Faz 0 ve Faz 1'i uygula. Herhangi bir kritik eksik bilgi için beklemek yerine güvenli varsayımlar yap ve bunları belgele. Ancak gerçek API anahtarı, dış servis hesabı, mali cihaz SDK'sı gibi sağlanmayan bağımlılıkları uydurma.
