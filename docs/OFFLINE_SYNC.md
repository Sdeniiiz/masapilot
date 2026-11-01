# MasaPilot — Çevrimdışı Çalışma ve Bulut Eşitleme (docs/OFFLINE_SYNC.md)

## 1. Temel Prensip

- **Otoriter Kaynak (Authority):** Şube operasyonel verisinin (masalar, adisyonlar, siparişler, mutfak durumları, ödemeler) birincil ve otoriter kaynağı şubedeki **Edge Node**'dur.
- **İnternet Kesintisi Senaryosu:** Şubenin internet (WAN) bağlantısı koptuğunda, aynı yerel ağdaki (LAN) tüm cihazlar (kasa, tabletler, mutfak ekranları, yazıcılar) kesintisiz çalışmaya devam eder.
- **Bağlantı Geri Geldiğinde:** Yerel Outbox kuyruğunda birikmiş tüm olaylar güvenli giden TLS (outbound HTTPS) bağlantısı üzerinden buluta aktarılır. Bulutun şube ağına inbound port açması GEREKMEZ.

---

## 2. Transactional Outbox & Inbox Mekanizması

```
[Edge Node DB Transaction]
  ├── Sipariş / Ödeme Kaydı
  └── OutboxEvent Kaydı (IdempotencyKey, Sequence, Payload)
        │
        ▼ (Ağ bağlantısı varsa veya geri geldiğinde)
[SyncWorker]
  ├── İşlenmemiş OutboxEvent kayıtlarını çeker (IsDispatched = false)
  ├── Bulut API /api/v1/sync/push uç noktasına gönderir
        │
        ▼
[Cloud InboxEngine]
  ├── EventId ve IdempotencyKey benzersizlik kontrolü (InboxEvent)
  ├── Eğer daha önce işlendiyse: İşlemi atla, 200 OK (İdempotent Ack)
  └── Eğer yeni ise: PostgreSQL veritabanına yansıt, 200 OK
        │
        ▼
[Edge Node]
  └── IsDispatched = true, DispatchedAtUtc = Now
```

---

## 3. Çakışma ve Veri Bütünlüğü Politikası

1. **Finansal Olaylar (Sipariş & Tahsilat):** Kesinlikle `Append-Only` modeldedir. Bulut veya yerel taraf bir ödemeyi ezemez; tekilleştirme `EventId` ve `IdempotencyKey` ile sağlanır.
2. **Katalog Düzenlemeleri (Menü & Fiyat):** Fiyat veya ürün güncellemelerinde sürüm numarası (`VersionStamp`) kontrol edilir. Çakışma durumunda son geçerli yönetici onayı esas alınır; ancak geçmiş adisyonlar bu durumdan etkilenmez çünkü satır bazlı fiyat snapshot'ı kullanırlar.
