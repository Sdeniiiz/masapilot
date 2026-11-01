# MasaPilot Geri Yükleme ve Bütünlük Doğrulama Betiği (PowerShell)

param (
    [Parameter(Mandatory=$true)]
    [string]$BackupPath
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupPath)) {
    Write-Error "Yedek dosyası bulunamadı: $BackupPath"
}

Write-Host "Yedek dosyası doğrulanıyor: $BackupPath" -ForegroundColor Cyan

# 1. Checksum Verification
$ShaFile = "$BackupPath.sha256"
if (Test-Path $ShaFile) {
    $ExpectedHash = (Get-Content -Path $ShaFile).Trim().ToLower()
    $ActualHash = (Get-FileHash -Path $BackupPath -Algorithm SHA256).Hash.ToLower()

    if ($ExpectedHash -eq $ActualHash) {
        Write-Host "SHA-256 Sağlama Toplamı Eşleşti: $ActualHash" -ForegroundColor Green
    } else {
        Write-Error "Sağlama toplamı UYUŞMUYOR! Beklenen: $ExpectedHash, Gerçek: $ActualHash"
    }
} else {
    Write-Warning "Manifest .sha256 dosyası bulunamadı, kontrol atlanıyor."
}

# 2. Target restore
$TargetDb = "$PSScriptRoot\..\src\MasaPilot.Api\masapilot.db"
Copy-Item -Path $BackupPath -Destination $TargetDb -Force

Write-Host "Veritabanı başarıyla geri yüklendi: $TargetDb" -ForegroundColor Green
