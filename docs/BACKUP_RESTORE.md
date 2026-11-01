# MasaPilot — Yedekleme, Şifreleme ve Geri Yükleme Kılavuzu (docs/BACKUP_RESTORE.md)

## 1. Yedekleme Politikası

Veri kaybına karşı MasaPilot hem yerel hem bulut yedekleme döngüsüne sahiptir:
- **Yerel SQLite:** SQLite online backup API (`VACUUM INTO` veya `SqliteConnection.BackupDatabase`) kullanılarak çalışan uygulamayı durdurmadan tutarlı anlık görüntü (snapshot) alınır.
- **Şifreleme:** Yedek dosyaları AES-256-GCM ile şifrelenir ve SHA-256 sağlama toplamı (checksum) ile bütünlüğü doğrulanır.
- **Otomatik Zamanlama:** Her gün vardiya kapanışında veya belirlenen saatte otomatik tam yedek alınır.

---

## 2. Geri Yükleme ve Doğrulama Adımları

Yedek dosyasının sağlamlığını teyit etmek için otomatik test prosedürü uygulanır:
1. Şifreli yedek dosyası hedef geçici dizine açılır (Decryption).
2. SHA-256 hash değeri orijinal manifest ile karşılaştırılır.
3. SQLite bütünlük kontrolü (`PRAGMA integrity_check`) çalıştırılır.
4. Temel tabloların satır sayıları (`DiningTables`, `TableSessions`, `Orders`, `Payments`) sayılır ve raporlanır.
