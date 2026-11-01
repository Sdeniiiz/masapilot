# MasaPilot Build Script (PowerShell)
# Derleme ve paketleme otomasyonu

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "       MasaPilot Derleme Başlatıldı      " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Frontend Build
Write-Host "`n[1/3] Frontend paketleri derleniyor..." -ForegroundColor Yellow
Set-Location -Path "$PSScriptRoot\..\src\MasaPilot.Web"
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Frontend derlemesi başarısız oldu!"
}

# 2. Backend Build
Write-Host "`n[2/3] .NET 9 Backend çözümü derleniyor..." -ForegroundColor Yellow
Set-Location -Path "$PSScriptRoot\.."
dotnet build MasaPilot.sln -c Release
if ($LASTEXITCODE -ne 0) {
    Write-Error "Backend derlemesi başarısız oldu!"
}

# 3. Test Suite
Write-Host "`n[3/3] Otomatik test paketi çalıştırılıyor..." -ForegroundColor Yellow
dotnet test tests/MasaPilot.Tests/MasaPilot.Tests.csproj -c Release --no-build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Testler başarısız oldu!"
}

Write-Host "`n========================================" -ForegroundColor Green
Write-Host " MasaPilot Başarıyla Derlendi ve Doğrulandı! " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
