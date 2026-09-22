# ==========================================
# Script de Inicialización de Proyecto: Digital Twin UniFi/AD
# ==========================================

$root = Get-Location

Write-Host "🚀 Creando estructura de carpetas..." -ForegroundColor Cyan

# 1. Crear directorios
$dirs = @(
    "assets/images",
    "assets/css",
    "assets/js",
    "data"
)

foreach ($dir in $dirs) {
    $path = Join-Path $root $dir
    if (-not (Test-Path $path)) {
        New-Item -ItemType Directory -Path $path | Out-Null
        Write-Host " [OK] Creada carpeta: $dir" -ForegroundColor Green
    }
}

# 2. Crear data/activos_mapeados.json (Estructura base de muestra)
$jsonContent = @"
[
  {
    "box_id": "BOX-17",
    "piso": 5,
    "top_pct": 45.0,
    "left_pct": 63.0,
    "width_pct": 3.5,
    "height_pct": 4.0,
    "ip_address": "192.168.1.189",
    "mac_address": "f4:b5:20:6f:35:f3",
    "hostname_actual": "PCB-06T",
    "hostname_nuevo": "P05-BOX017",
    "switch_connection": "USW-48-G2 5to Piso [Port 12]",
    "status": "VERIFICADO_ACTIVO"
  },
  {
    "box_id": "BOX-59",
    "piso": 5,
    "top_pct": 45.0,
    "left_pct": 59.0,
    "width_pct": 3.5,
    "height_pct": 4.0,
    "ip_address": "192.168.1.190",
    "mac_address": "f8:ed:fc:50:ba:0e",
    "hostname_actual": "DESKTOP-JBOHL1O",
    "hostname_nuevo": "P05-BOX059",
    "switch_connection": "USW-48-G2 5to Piso [Port 14]",
    "status": "SOLO_UNIFI_NO_AD"
  }
]
"@
Set-Content -Path (Join-Path $root "data/activos_mapeados.json") -Value $jsonContent -Encoding UTF8
Write-Host " [OK] Creado data/activos_mapeados.json" -ForegroundColor Green

# 3. Crear assets/css/styles.css
$cssContent = @"
body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    margin: 0;
    display: flex;
    background: #1e1e2e;
    color: #fff;
    height: 100vh;
    overflow: hidden;
}

#map-container {
    flex: 1;
    overflow: auto;
    padding: 20px;
    text-align: center;
}

#map-wrapper {
    position: relative;
    display: inline-block;
}

#map-image {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
}

.box-hotspot {
    position: absolute;
    border: 2px solid #00bfff;
    background: rgba(0, 191, 255, 0.2);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s ease;
}

.box-hotspot:hover {
    background: rgba(0, 255, 127, 0.5);
    border-color: #00ff7f;
    transform: scale(1.05);
}

.box-hotspot.active {
    background: rgba(255, 215, 0, 0.6);
    border-color: #ffd700;
}

#sidebar {
    width: 360px;
    background: #2b2b3d;
    padding: 20px;
    box-shadow: -2px 0 10px rgba(0,0,0,0.3);
    display: flex;
    flex-direction: column;
}

.card {
    background: #3b3b52;
    padding: 15px;
    border-radius: 8px;
    margin-top: 15px;
}

.form-group {
    margin-bottom: 12px;
}

label {
    display: block;
    font-size: 12px;
    color: #aaa;
    margin-bottom: 4px;
}

input {
    width: 100%;
    padding: 8px;
    border-radius: 4px;
    border: 1px solid #555;
    background: #1e1e2e;
    color: #fff;
    box-sizing: border-box;
}

button {
    background: #00bfff;
    color: #000;
    font-weight: bold;
    border: none;
    padding: 10px;
    border-radius: 4px;
    cursor: pointer;
    width: 100%;
    margin-top: 10px;
}

button:hover {
    background: #00ff7f;
}
"@
Set-Content -Path (Join-Path $root "assets/css/styles.css") -Value $cssContent -Encoding UTF8
Write-Host " [OK] Creado assets/css/styles.css" -ForegroundColor Green

# 4. Crear assets/js/app.js
$jsContent = @"
let activosData = [];
let cambiosGuardados = {};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('data/activos_mapeados.json');
        activosData = await response.json();
        renderHotspots();
    } catch (e) {
        console.error('Error al cargar activos_mapeados.json', e);
    }
});

function renderHotspots() {
    const wrapper = document.getElementById('map-wrapper');
    // Limpiar hotspots previos
    wrapper.querySelectorAll('.box-hotspot').forEach(el => el.remove());

    activosData.forEach(item => {
        const div = document.createElement('div');
        div.className = 'box-hotspot';
        div.style.top = item.top_pct + '%';
        div.style.left = item.left_pct + '%';
        div.style.width = item.width_pct + '%';
        div.style.height = item.height_pct + '%';
        div.title = item.box_id;

        div.onclick = (e) => selectBox(e, item);
        wrapper.appendChild(div);
    });
}

function selectBox(event, item) {
    document.querySelectorAll('.box-hotspot').forEach(el => el.classList.remove('active'));
    event.target.classList.add('active');

    document.getElementById('info-card').style.display = 'block';
    document.getElementById('box-id').value = item.box_id;
    document.getElementById('hostname-actual').value = item.hostname_actual;
    document.getElementById('hostname-nuevo').value = cambiosGuardados[item.box_id] || item.hostname_nuevo;
    document.getElementById('ip-address').value = item.ip_address;
    document.getElementById('switch-port').value = item.switch_connection;
    document.getElementById('status-diag').value = item.status;
}

function guardarCambio() {
    const boxId = document.getElementById('box-id').value;
    const nuevoHost = document.getElementById('hostname-nuevo').value;
    cambiosGuardados[boxId] = nuevoHost;
    alert('✅ Registrado cambio local para ' + boxId + ' -> ' + nuevoHost);
}

function generarPowerShell() {
    if (Object.keys(cambiosGuardados).length === 0) {
        alert('No hay cambios pendientes para generar el script.');
        return;
    }

    let script = '# Script de Renombrado Automático de Equipos en Active Directory\n\n';
    for (let boxId in cambiosGuardados) {
        const item = activosData.find(a => a.box_id === boxId);
        if (item) {
            script += `Rename-ADComputer -Identity "${item.hostname_actual}" -NewName "${cambiosGuardados[boxId]}" -Force\n`;
        }
    }

    const blob = new Blob([script], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'Renombrar_Equipos_AD.ps1';
    link.click();
}
"@
Set-Content -Path (Join-Path $root "assets/js/app.js") -Value $jsContent -Encoding UTF8
Write-Host " [OK] Creado assets/js/app.js" -ForegroundColor Green

# 5. Crear index.html
$htmlContent = @"
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Digital Twin - Plano Interactivo UniFi/AD</title>
    <link rel="stylesheet" href="assets/css/styles.css">
</head>
<body>

    <div id="map-container">
        <h2>Plano Interactivo - Control de Activos</h2>
        <div id="map-wrapper">
            <!-- Mover las imágenes PISO 5.jpg y PISO 17.jpg a la carpeta assets/images/ -->
            <img id="map-image" src="assets/images/PISO 5.jpg" alt="Plano de Planta">
        </div>
    </div>

    <div id="sidebar">
        <h3>📍 Información del Puesto</h3>
        <p style="color: #aaa; font-size: 13px;">Hacé clic en cualquier box para gestionar sus datos.</p>
        
        <div class="card" id="info-card" style="display: none;">
            <div class="form-group">
                <label>Ubicación / Box:</label>
                <input type="text" id="box-id" readonly>
            </div>
            <div class="form-group">
                <label>Hostname Actual (AD):</label>
                <input type="text" id="hostname-actual" readonly>
            </div>
            <div class="form-group">
                <label>Nuevo Hostname Propuesto:</label>
                <input type="text" id="hostname-nuevo">
            </div>
            <div class="form-group">
                <label>Dirección IP (UniFi):</label>
                <input type="text" id="ip-address" readonly>
            </div>
            <div class="form-group">
                <label>Switch & Puerto:</label>
                <input type="text" id="switch-port" readonly>
            </div>
            <div class="form-group">
                <label>Estado de Diagnóstico:</label>
                <input type="text" id="status-diag" readonly>
            </div>
            <button onclick="guardarCambio()">💾 Guardar Cambio Local</button>
        </div>

        <div style="margin-top: auto;">
            <button style="background: #28a745; color: #fff;" onclick="generarPowerShell()">⚡ Generar Script PowerShell (.ps1)</button>
        </div>
    </div>

    <script src="assets/js/app.js"></script>
</body>
</html>
"@
Set-Content -Path (Join-Path $root "index.html") -Value $htmlContent -Encoding UTF8
Write-Host " [OK] Creado index.html" -ForegroundColor Green

Write-Host "`n🎉 ¡Proyecto creado con éxito!" -ForegroundColor Yellow
Write-Host "Pasos siguientes:" -ForegroundColor White
Write-Host "1. Copia las imágenes 'PISO 5.jpg' y 'PISO 17.jpg' dentro de 'assets/images/'" -ForegroundColor Gray
Write-Host "2. Abre el archivo 'index.html' en tu navegador o ejecuta Live Server en VS Code." -ForegroundColor Gray