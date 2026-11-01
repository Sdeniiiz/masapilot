@echo off
chcp 65001 >nul
title TıklaYönet — Restoran Sunucusu
color 0A

for /f "tokens=4" %%a in ('route print^|findstr 0.0.0.0.*0.0.0.0') do (
    set LOCAL_IP=%%a
    goto :FoundIP
)
:FoundIP
if "%LOCAL_IP%"=="" set LOCAL_IP=127.0.0.1

echo ===============================================================================
echo   TIKLAYÖNET RESTORAN SİSTEMİ ÇALIŞIYOR
echo   Kasa Ekranı:        http://localhost:5000
echo   Garson Telefonları: http://%LOCAL_IP%:5000
echo ===============================================================================
echo.

start "" "http://localhost:5000"

cd /d "%~dp0src\MasaPilot.Api"
dotnet run --no-launch-profile --urls "http://0.0.0.0:5000"
