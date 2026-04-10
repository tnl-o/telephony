$ErrorActionPreference = "Stop"
$sslDir = Join-Path $PSScriptRoot "..\ssl"
New-Item -ItemType Directory -Force -Path $sslDir | Out-Null
$key = Join-Path $sslDir "key.pem"
$cert = Join-Path $sslDir "cert.pem"
$openssl = Get-Command openssl -ErrorAction SilentlyContinue
if (-not $openssl) {
    Write-Error "openssl не найден в PATH. Установите OpenSSL или используйте Git Bash и скрипт gen-ssl.sh"
}
& openssl req -x509 -nodes -days 825 -newkey rsa:2048 `
    -keyout $key -out $cert `
    -subj "/CN=telephony-dev" `
    -addext "subjectAltName=DNS:localhost,DNS:host.docker.internal,IP:127.0.0.1"
Write-Host "Готово: $cert и $key"
Write-Host "Для доступа с другого ПК в LAN добавьте свой IP в SAN и пересоздайте сертификат, например:"
Write-Host '  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:192.168.1.10"'
