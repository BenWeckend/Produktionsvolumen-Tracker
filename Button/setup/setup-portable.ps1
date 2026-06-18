param(
    [string]$NodeMajor = "22"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Write-Step($Text) {
    Write-Host ""
    Write-Host "==> $Text" -ForegroundColor Cyan
}

function Require-File($Path, $Message) {
    if (-not (Test-Path $Path)) {
        throw $Message
    }
}

Write-Step "Portable Node.js vorbereiten"
$nodeExe = Join-Path $root "node\node.exe"
$npmCmd = Join-Path $root "node\npm.cmd"
$npmCli = Join-Path $root "node\node_modules\npm\bin\npm-cli.js"

if (-not (Test-Path $nodeExe)) {
    $arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
    $indexUrl = "https://nodejs.org/dist/index.json"
    Write-Host "Lade Node.js Versionsliste..."
    $versions = Invoke-RestMethod -Uri $indexUrl
    $selected = $versions | Where-Object { $_.version -like "v$NodeMajor.*" -and $_.files -contains "win-$arch-zip" } | Select-Object -First 1
    if (-not $selected) {
        throw "Keine passende Node.js v$NodeMajor Windows-$arch ZIP-Version gefunden."
    }

    $version = $selected.version
    $zipName = "node-$version-win-$arch.zip"
    $zipUrl = "https://nodejs.org/dist/$version/$zipName"
    $downloadDir = Join-Path $root ".portable-downloads"
    $zipPath = Join-Path $downloadDir $zipName
    New-Item -ItemType Directory -Force -Path $downloadDir | Out-Null

    Write-Host "Lade $zipName..."
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath

    $extractDir = Join-Path $downloadDir "extract"
    if (Test-Path $extractDir) { Remove-Item -Recurse -Force $extractDir }
    New-Item -ItemType Directory -Force -Path $extractDir | Out-Null

    Write-Host "Entpacke Node.js..."
    Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force
    $nodeFolder = Get-ChildItem $extractDir -Directory | Select-Object -First 1
    if (-not $nodeFolder) { throw "Node.js ZIP konnte nicht entpackt werden." }

    if (Test-Path (Join-Path $root "node")) { Remove-Item -Recurse -Force (Join-Path $root "node") }
    Move-Item -Path $nodeFolder.FullName -Destination (Join-Path $root "node")
} else {
    Write-Host "Node.js ist bereits vorhanden."
}

Require-File $nodeExe "node\node.exe fehlt."
if (-not (Test-Path $npmCmd)) { Require-File $npmCli "npm wurde im portablen Node.js Ordner nicht gefunden." }

Write-Host "Node-Version:"
& $nodeExe --version
Write-Host "npm-Version:"
if (Test-Path $npmCmd) { & $npmCmd --version } else { & $nodeExe $npmCli --version }

Write-Step "Abhaengigkeiten installieren"
if (Test-Path $npmCmd) { & $npmCmd install --omit=dev } else { & $nodeExe $npmCli install --omit=dev }
if ($LASTEXITCODE -ne 0) { throw "npm install ist fehlgeschlagen." }

Write-Step "Browser-Bibliotheken lokal kopieren"
$libDir = Join-Path $root "public\lib"
$faTarget = Join-Path $libDir "font-awesome"
New-Item -ItemType Directory -Force -Path $libDir | Out-Null

$chartSource = Join-Path $root "node_modules\chart.js\dist\chart.umd.min.js"
Require-File $chartSource "Chart.js wurde nicht gefunden."
Copy-Item -Force $chartSource (Join-Path $libDir "chart.umd.min.js")

$faCss = Join-Path $root "node_modules\@fortawesome\fontawesome-free\css"
$faWebfonts = Join-Path $root "node_modules\@fortawesome\fontawesome-free\webfonts"
Require-File $faCss "Font Awesome CSS wurde nicht gefunden."
Require-File $faWebfonts "Font Awesome Webfonts wurden nicht gefunden."
if (Test-Path $faTarget) { Remove-Item -Recurse -Force $faTarget }
New-Item -ItemType Directory -Force -Path $faTarget | Out-Null
Copy-Item -Recurse -Force $faCss (Join-Path $faTarget "css")
Copy-Item -Recurse -Force $faWebfonts (Join-Path $faTarget "webfonts")

Write-Step "Portable Installation pruefen"
& $nodeExe -e "require('express'); require('node:sqlite'); console.log('OK: Server-Abhaengigkeiten geladen')"
if ($LASTEXITCODE -ne 0) { throw "Node-Abhaengigkeiten konnten nicht geladen werden." }

Write-Host ""
Write-Host "Portable Vorbereitung abgeschlossen." -ForegroundColor Green
Write-Host "Kopiere den kompletten Ordner auf den USB-Stick und starte offline start.bat."




