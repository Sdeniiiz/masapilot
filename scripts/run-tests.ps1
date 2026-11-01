# MasaPilot Test Çalıştırma Betiği (PowerShell)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    MasaPilot Test Paketi Çalıştırılıyor " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Set-Location -Path "$PSScriptRoot\.."
dotnet test tests/MasaPilot.Tests/MasaPilot.Tests.csproj --logger "console;verbosity=detailed"
