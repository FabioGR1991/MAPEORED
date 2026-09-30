# 🗺️ ROADMAP DE PROYECTO: Digital Twin & Gestión Interactiva de Activos (UniFi + AD)

## 📌 Visión del Proyecto
Desarrollar una aplicación web interactiva que funcione como un **Gemelo Digital** de la infraestructura de red física (planos de los Pisos 5 y 17) y lógica (Active Directory + UniFi Network Controller). El objetivo principal es permitir la inspección visual, reubicación y estandarización masiva de Hostnames bajo normativa ISO 27001 (Control A.8.1.1).

---

## 🏗️ Arquitectura del Sistema

### 1. Fuentes de Datos
* **UniFi Controller Export:** Datos de capa física (MAC Address, IP actual, Switch de origen, Puerto, Tráfico y Última conexión).
* **Active Directory Export:** Datos de capa lógica (Hostname actual, OU, Sistema Operativo, IP en DNS, Estado).

### 2. Modo de Operación, Validación y Persistencia
* MAPEORED procesa los CSV localmente en el navegador y no establece conexión en vivo con UniFi o Active Directory. No hay backend, autenticación ni sincronización multiusuario.
* `data/activos_mapeados.json` es la fuente canónica. La UI valida esquema y geometría al cargar; cada CSV se limita a 10 MiB y 50.000 filas, valida columnas y reporta duplicados como ambiguos antes de aplicar el cruce.
* Las ediciones del navegador permanecen en memoria hasta que el operador descarga el JSON; la página no escribe automáticamente sobre el archivo local. `scripts/ingest.py` y `setup_proyecto.ps1` escriben mediante temporales validados, backups y reemplazo atómico; el scaffolder conserva el JSON existente salvo que se use `-ReplaceExistingData`.
* El script PowerShell generado usa `-WhatIf`; su preview informa el número de cambios y no ejecuta ni reinicia equipos.
* El tratamiento de inventario es local, pero la UI actual carga Tailwind, Font Awesome y fuentes desde CDNs; por ello la presentación completa aún necesita conectividad y no debe anunciarse como una distribución totalmente offline.
* La telemetría del navegador contiene únicamente eventos y métricas agregadas; no registra IP, MAC, hostname, contenido CSV ni tokens.

### 3. Estructura de Directorios
```text
INFRA INTERACTIVA/
├── assets/
│   └── images/
│       ├── PISO 5.jpg          # Plano de demostración Piso 5
│       └── PISO 17.jpg         # Plano de demostración Piso 17
├── data/
│   └── activos_mapeados.json   # Matriz Maestra en JSON (Unión de UniFi + AD + Coordenadas)
├── index.html                  # Dashboard principal interactivo
├── ROADMAP.md                  # Especificaciones del proyecto y guía para IA
└── setup_proyecto.ps1           # Script de inicialización de entorno

🚀 Fases de Desarrollo
🟢 Fase 1: Infraestructura Base & Frontend Interactivo (COMPLETADO)
[x] Interfaz interactiva en index.html con estado canónico validado en JSON.

[x] Incorporación de los planos de planta en assets/images/.

[x] Creación del panel lateral (Sidebar) para la lectura y edición de celdas.

[x] Integración de generación de scripts de PowerShell para Rename-ADComputer.

🟡 Fase 2: Trazado de Coordenadas & Mapeo Completo (EN PROCESO)
[ ] Definir el esquema JSON extendido para soportar los 82 boxes del Piso 5 y la distribución del Piso 17.

[ ] Mapear coordenadas relativas (porcentuales top%, left%, width%, height%) sobre las imágenes para garantizar responsividad.

[ ] Implementar selector desplegable en el Header para alternar instantáneamente entre el Piso 5 y el Piso 17.

🔵 Fase 3: Script Ingestor de Datos & Crosscheck (Python / Node)
[ ] Desarrollar un script en la carpeta /scripts/ingest.py que tome UniFi.csv y AD.xlsx y regenere automáticamente data/activos_mapeados.json.

[ ] Implementar algoritmos de resolución de discrepancias:

VERIFICADO_ACTIVO: Muestra color verde en el plano.

SOLO_UNIFI_NO_AD: Muestra color amarillo (Dispositivo no unido al dominio o invitado).

SOLO_AD_INACTIVO: Muestra color rojo (Equipo apagado, dado de baja o movido).

🟣 Fase 4: Búsqueda, Filtros Avanzados y Exportación Masiva
[ ] Añadir buscador en vivo por IP, MAC, Usuario o Hostname con auto-highlighting en el plano.

[ ] Permitir la edición de múltiples puestos simultáneamente (Batch Rename).

[ ] Exportación de reportes de auditoría en PDF y CSV Maestro actualizado.

📐 Regla de Nomenclatura Estándar para Hostnames
Formato: P[PISO]-BOX[NUMERO_PUESTO]

Ejemplos:

Puesto 6 en Piso 5: P05-BOX006

Puesto 42 en Piso 5: P05-BOX042

Puesto 12 en Piso 17: P17-BOX012

🤖 Contexto para Agentes de IA (Antigravity / Copilot)
Instrucción de lectura: `data/activos_mapeados.json` es la fuente canónica de activos y coordenadas. La interfaz actual está en `index.html`; mantener el esquema (`box_id`, `piso`, `top_pct`, `left_pct`, `width_pct`, `height_pct`, `hostname_actual`, `hostname_propuesto`) y validar cualquier cambio de coordenadas dentro del plano.