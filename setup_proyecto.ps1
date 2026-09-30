[CmdletBinding()]
param(
    [string]$Root = (Get-Location).Path,
    [switch]$ReplaceExistingData
)

$ErrorActionPreference = 'Stop'

function Write-ProjectFile {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Content,
        [switch]$ValidateJsonArray
    )

    $fullPath = [System.IO.Path]::GetFullPath($Path)
    $directory = Split-Path -Parent $fullPath
    $temporaryName = '.{0}.{1}.tmp' -f [System.IO.Path]::GetFileName($fullPath), [guid]::NewGuid().ToString('N')
    $temporaryPath = Join-Path $directory $temporaryName
    $encoding = New-Object System.Text.UTF8Encoding($false)

    try {
        [System.IO.File]::WriteAllText($temporaryPath, $Content, $encoding)
        $temporaryContent = [System.IO.File]::ReadAllText($temporaryPath, $encoding)
        if ([string]::IsNullOrWhiteSpace($temporaryContent)) {
            throw 'Generated file is empty.'
        }

        if ($ValidateJsonArray) {
            $parsedContent = ConvertFrom-Json -InputObject $temporaryContent -ErrorAction Stop
            if ($parsedContent -isnot [array]) {
                throw 'Generated JSON root must be an array.'
            }

            $requiredFields = @(
                'box_id', 'piso', 'top_pct', 'left_pct', 'width_pct', 'height_pct',
                'ip_address', 'mac_address', 'hostname_actual', 'hostname_propuesto',
                'switch_connection', 'status'
            )
            foreach ($asset in $parsedContent) {
                foreach ($field in $requiredFields) {
                    if ($null -eq $asset.PSObject.Properties[$field]) {
                        throw "Generated JSON asset is missing '$field'."
                    }
                }
            }
        }

        if (Test-Path -LiteralPath $fullPath) {
            $backupPath = "$fullPath.bak"
            if (Test-Path -LiteralPath $backupPath) {
                $backupName = '{0}.{1}.{2}.bak' -f [System.IO.Path]::GetFileName($fullPath), (Get-Date -Format 'yyyyMMddHHmmssfff'), [guid]::NewGuid().ToString('N')
                $backupPath = Join-Path $directory $backupName
            }
            [System.IO.File]::Replace($temporaryPath, $fullPath, $backupPath)
            Write-Host "Backup created: $backupPath" -ForegroundColor Yellow
        } else {
            [System.IO.File]::Move($temporaryPath, $fullPath)
        }
    } finally {
        if (Test-Path -LiteralPath $temporaryPath) {
            Remove-Item -LiteralPath $temporaryPath -Force
        }
    }
}

$directories = @('assets/images', 'data')
foreach ($directory in $directories) {
    $path = Join-Path $Root $directory
    if (-not (Test-Path -LiteralPath $path)) {
        New-Item -ItemType Directory -Path $path | Out-Null
    }
}

$jsonContent = @'
[
  {
    "box_id": "BOX-17",
    "piso": 5,
    "top_pct": 45.0,
    "left_pct": 63.0,
    "width_pct": 3.5,
    "height_pct": 4.0,
    "ip_address": "192.0.2.17",
    "mac_address": "02:00:00:00:00:17",
    "hostname_actual": "DEMO-PC-017",
    "hostname_propuesto": "DEMO-P05-BOX017",
    "switch_connection": "DEMO-SW-P05-PORT-12",
    "status": "VERIFICADO_ACTIVO"
  },
  {
    "box_id": "BOX-59",
    "piso": 5,
    "top_pct": 45.0,
    "left_pct": 59.0,
    "width_pct": 3.5,
    "height_pct": 4.0,
    "ip_address": "192.0.2.59",
    "mac_address": "02:00:00:00:00:59",
    "hostname_actual": "DEMO-PC-059",
    "hostname_propuesto": "DEMO-P05-BOX059",
    "switch_connection": "DEMO-SW-P05-PORT-14",
    "status": "SOLO_UNIFI_NO_AD"
  }
]
'@

$jsonPath = Join-Path $Root 'data/activos_mapeados.json'
if ((Test-Path -LiteralPath $jsonPath) -and -not $ReplaceExistingData) {
    Write-Host "Preserved existing data file: $jsonPath" -ForegroundColor Yellow
} else {
    Write-ProjectFile -Path $jsonPath -Content $jsonContent -ValidateJsonArray
    Write-Host "Demo data initialized: $jsonPath" -ForegroundColor Green
}

Write-Host 'Directory scaffolding complete. The current UI remains in index.html and was not overwritten.' -ForegroundColor Cyan
