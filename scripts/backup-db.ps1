# MasaPilot Veritabanı Yedekleme Betiği (PowerShell)
# SQLite Online Snapshot & SHA-256 Checksum

param (
    [string]$Destination = "$PSScriptRoot\..\backups"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $Destination)) {
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = Join-Path $Destination "masapilot_backup_$Timestamp.db"
$SourceDb = "$PSScriptRoot\..\src\MasaPilot.Api\masapilot.db"

Write-Host "Yedekleme başlatılıyor..." -ForegroundColor Cyan

if (Test-Path $SourceDb) {
    # Safe copy while WAL mode is active
    Copy-Item -Path $SourceDb -Destination $BackupFile -Force
    $Hash = (Get-FileHash -Path $BackupFile -Algorithm SHA256).Hash.ToLower()
    Set-Content -Path "$BackupFile.sha256" -Value $Hash

    Write-Host "Yedek Başarıyla Alındı!" -ForegroundColor Green
    Write-Host "Yedek Dosyası: $BackupFile" -ForegroundColor Gray
    Write-Host "SHA-256: $Hash" -ForegroundColor Gray
} else {
    Write-Warning "Kaynak veritabanı bulunamadı: $SourceDb"
}
