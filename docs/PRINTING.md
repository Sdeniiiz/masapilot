# MasaPilot — Yazdırma Mimarisi ve ESC/POS Kılavuzu (docs/PRINTING.md)

## 1. Yazdırma Mimarisi

Restoran operasyonunda siparişin mutfağa/bara anında iletilmesi ve hesap fişinin çıkarılması kritik süreçlerdir. MasaPilot, yazdırma işlemlerini kullanıcı isteğinden ayıran dayanıklı bir kuyruk modeli ile yönetir.

```
[Kullanıcı: "Mutfağa Gönder"]
         │
         ▼
[Sipariş Transaction (SQLite)]
  ├── Order & OrderLine kaydedilir
  └── PrintJob (Status = Queued) kaydedilir
         │ (Transaction başarılı olursa DB commit)
         ▼
[PrintWorker Arka Plan İşçisi]
  ├── Bekleyen PrintJob'ları sorgular (Status = Queued)
  ├── İşi rezerve eder (Status = Claimed)
  ├── Yazıcı tipine göre gönderir:
  │     ├── NetworkEthernet: TCP Raw Socket (Port 9100) ESC/POS
  │     ├── WindowsDriverUsb: Windows Spooler API ESC/POS RAW
  │     └── VirtualFake: Test ve simülasyon (çıktıyı loga ve önizlemeye yazar)
  │
  ├── Başarılı ise ──> Status = Printed
  └── Zaman aşımı/Hata ise ──>
        Attempts < 3 ise ──> Status = RetryableFailed (artan bekleme süresi)
        Attempts >= 3 ise ──> Status = ManualReview (Kullanıcı müdahalesi gerekir)
```

---

## 2. Baskı Durumu Belirsizliği ve Mükerrer Basım Önleme

Fiziksel termal yazıcılar çoğu zaman TCP soketinde byte'ların alındığını onaylasa dahi kağıt sıkışması, kağıt bitmesi veya elektriğin kesilmesi nedeniyle fişi basamamış olabilir.

- **Kural:** Sistem, başarısız veya zaman aşımına uğramış bir iş için **körlemesine sonsuz otomatik tekrar basımı yapmaz**. Aksi halde garsona aynı adisyondan 10 kez kağıt çıkarak mutfakta kargaşa yaratabilir.
- **Kullanıcı Onayı:** `ManualReview` durumuna geçen işler Kasa ve Yazıcı ekranlarında uyarı ile gösterilir:
  > *"Mutfak yazıcısından yanıt alınamadı. Lütfen yazıcıyı kontrol edin: Fiş çıktı mı?"*
  - Kullanıcı **"Fiş Çıktı, Tamamlandı Say"** veya **"Fiş Çıkmadı, Yeniden Bas"** butonunu seçer.
- **Tekrar Baskı Damgası:** Kullanıcı tarafından tekrar basılan her fişin tepesinde kalın ve belirgin şekilde şu ibare yazdırılır:
  ```
  ========================================
             *** TEKRAR BASKI ***
     Bu fiş daha önce yazdırılmış olabilir!
  ========================================
  ```

---

## 3. Desteklenen Yazıcı Bağlantı Tipleri ve Test

1. **Ethernet / Ağ Yazıcıları (Önerilen):**
   - Standart port: 9100 (RAW).
   - Statik IP atanması tavsiye edilir (örn. `192.168.1.200`).
2. **USB Termal Yazıcılar:**
   - Windows Generic / Text Only sürücüsü veya üretici sürücüsü üzerinden RAW spooler bağlantısı.
3. **Sanal / Fake Yazıcı (`VirtualFake`):**
   - Donanım olmayan test ve geliştirme ortamları için yerel dosya ve log tabanlı simülatör.
   - Gerçek ESC/POS baytlarını ASCII ve UTF-8 simülasyonu olarak kaydeder, testlerin donanımsız koşulabilmesini sağlar.
