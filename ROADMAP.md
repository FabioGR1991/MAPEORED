# 🗺️ ROADMAP DE PROYECTO: Digital Twin & Gestión Interactiva de Activos (UniFi + AD)

## 📌 Visión del Proyecto
Desarrollar una aplicación web interactiva que funcione como un **Gemelo Digital** de la infraestructura de red física (planos de los Pisos 5 y 17) y lógica (Active Directory + UniFi Network Controller). El objetivo principal es permitir la inspección visual, reubicación y estandarización masiva de Hostnames bajo normativa ISO 27001 (Control A.8.1.1).

---

## 🏗️ Arquitectura del Sistema

### 1. Fuentes de Datos
* **UniFi Controller Export:** Datos de capa física (MAC Address, IP actual, Switch de origen, Puerto, Tráfico y Última conexión).
* **Active Directory Export:** Datos de capa lógica (Hostname actual, OU, Sistema Operativo, IP en DNS, Estado).

### 2. Estructura de Directorios
```text
INFRA INTERACTIVA/
├── assets/
│   ├── css/
│   │   └── styles.css          # Estilos visuales del frontend y sidebar
│   ├── images/
│   │   ├── PISO 5.jpg          # Plano de arquitectura Piso 5 (82 boxes)
│   │   └── PISO 17.jpg         # Plano de arquitectura Piso 17
│   └── js/
│       └── app.js              # Lógica de renderizado dinámico, eventos y exportación
├── data/
│   └── activos_mapeados.json   # Matriz Maestra en JSON (Unión de UniFi + AD + Coordenadas)
├── index.html                  # Dashboard principal interactivo
├── ROADMAP.md                  # Especificaciones del proyecto y guía para IA
└── setup_proyecto.ps1           # Script de inicialización de entorno

🚀 Fases de Desarrollo
🟢 Fase 1: Infraestructura Base & Frontend Interactivo (COMPLETADO)
[x] Generación de la estructura modular de archivos (HTML5, CSS3, JS).

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
Instrucción de lectura: Al trabajar sobre este proyecto, priorizar la modificación de data/activos_mapeados.json para ajustar coordenadas de cajas y mantener la lógica de renderizado responsivo en assets/js/app.js usando porcentajes CSS (%) en lugar de píxeles fijos (px).