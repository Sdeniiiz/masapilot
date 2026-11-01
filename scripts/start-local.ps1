# MasaPilot Yerel Sunucu Başlatma Betiği (PowerShell)
# Edge Node (SQLite + Kestrel / Windows Servisi)

param (
    [int]$Port = 5000,
    [string]$Mode = "Edge"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "      MasaPilot Yerel Sunucu Başlatılıyor" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Mod: $Mode | Port: $Port" -ForegroundColor Gray
Write-Host "Erişim: http://localhost:$Port" -ForegroundColor Green
Write-Host "LAN Erişimi: http://<Bilgisayar-IP-Adresi>:$Port" -ForegroundColor Green
Write-Host "Durdurmak için Ctrl+C tuşlayın.`n" -ForegroundColor Yellow

$env:RuntimeMode = $Mode

Set-Location -Path "$PSScriptRoot\..\src\MasaPilot.Api"
dotnet run --no-launch-profile --urls "http://0.0.0.0:$Port"
