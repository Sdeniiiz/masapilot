@echo off
chcp 65001 >nul
title TıklaYönet — Restoran & Kafe Otomasyonu (Ana Kasa Sunucusu)
color 0B

echo ===============================================================================
echo          TIKLAYÖNET RESTORAN VE KAFE OTOMASYON SİSTEMİ
echo               (Tek Veritabanı & Offline-First Yerel Sunucu)
echo ===============================================================================
echo.

:: 1. Yönetici izinleriyle Windows Güvenlik Duvarı Kuralı Ekleme (Telefonların bağlanabilmesi için)
echo [1/3] Windows Güvenlik Duvarı (Port 5000) kontrol ediliyor...
netsh advfirewall firewall show rule name="MasaPilot-Port5000" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo       * Port 5000 için gelen bağlantı kuralı ekleniyor...
    netsh advfirewall firewall add rule name="MasaPilot-Port5000" dir=in action=allow protocol=TCP localport=5000 >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo       [OK] Güvenlik duvarı kuralı başarıyla eklendi.
    ) else (
        echo       [UYARI] Güvenlik duvarı için yönetici yetkisi gerekebilir. Telefonlar bağlanamazsa bu dosyayı 'Yönetici Olarak Çalıştır'ın.
    )
) else (
    echo       [OK] Güvenlik duvarı kuralı zaten aktif.
)

:: 2. Yerel IP Adresini Tespit Etme
echo.
echo [2/3] Yerel Ağ (Wi-Fi / Ethernet) IP adresi belirleniyor...
for /f "tokens=4" %%a in ('route print^|findstr 0.0.0.0.*0.0.0.0') do (
    set LOCAL_IP=%%a
    goto :FoundIP
)
:FoundIP
if "%LOCAL_IP%"=="" set LOCAL_IP=127.0.0.1

echo.
echo ===============================================================================
echo   BU BİLGİSAYAR:  http://localhost:5000
echo   GARSON TELEFONLARI (iOS / Android):  http://%LOCAL_IP%:5000
echo ===============================================================================
echo.
echo * iPhone/iPad ve Android telefonlardan kasanın bağlı olduğu Wi-Fi ağına bağlanın.
echo * Tarayıcıdan yukarıdaki adresi açın veya ekrandaki QR Kodu okutun.
echo.

:: 3. Sunucuyu Başlatma
echo [3/3] TıklaYönet Ana Sunucusu Başlatılıyor...
echo       (Kapatmak için bu pencereyi kapatabilirsiniz veya Ctrl+C yapabilirsiniz)
echo.

start "" "http://localhost:5000"

cd /d "%~dp0src\MasaPilot.Api"
dotnet run --no-launch-profile --urls "http://0.0.0.0:5000"

pause
