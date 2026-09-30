# Brief de Marketing — MAPEORED

## 1. El problema

Los datos sobre puestos, equipos conectados, direcciones IP y nombres de host suelen estar repartidos entre planos, exportaciones de red y directorios corporativos. Resolver dónde se encuentra físicamente un activo o comparar lo que observa la red con lo registrado en Active Directory puede exigir búsquedas manuales y conocimiento específico de la oficina.

## 2. La solución

MAPEORED es una interfaz de mapeo físico de infraestructura que ubica boxes y activos sobre planos de planta y ofrece una vista de datos de red/AD para consulta y contraste. Permite cargar exportaciones CSV, revisar diferencias, ajustar posiciones y preparar un archivo de cambios de hostname para que el personal técnico lo revise y ejecute fuera de la aplicación.

## 3. Funcionalidades técnicas traducidas a beneficios

| Capacidad observada | Beneficio para el negocio |
| --- | --- |
| Plano interactivo con selección de piso y hotspots de boxes/activos | Facilita asociar un registro con una ubicación física sin depender únicamente de una lista de códigos. |
| Ficha del activo con identificador de box, hostname actual/propuesto, IP, puerto/switch y estado de cruce | Reúne contexto útil para soporte y revisión de inventario en una consulta visual. |
| Carga de CSV de UniFi y Active Directory y vista de cruce por IP | Ayuda a comparar exportaciones de red y directorio y a destacar registros que requieren validación. El cruce utiliza archivos proporcionados por el usuario, no una conexión en vivo. |
| Estados visuales para registros verificados, presentes solo en UniFi o solo en AD (según el flujo de la interfaz) | Hace más fácil priorizar discrepancias para revisión; los estados dependen de la calidad y correspondencia de los archivos de entrada. |
| Búsqueda, filtros por estado y sistema operativo, ordenamiento y salto desde una fila al plano | Reduce pasos para ubicar un equipo dentro de una lista extensa y volver a su contexto físico. |
| Modo de calibración para arrastrar hotspots y cambiar su ubicación en el plano | Permite ajustar la representación visual a la disposición física de cada sede. Los cambios se exportan/copían como datos; no se guardan automáticamente en un servicio central. |
| Administrador de JSON para previsualizar, copiar y descargar los datos del mapa | Ofrece un flujo explícito para revisar y trasladar los cambios al archivo de datos del proyecto. |
| Edición de hostname propuesto y generación/descarga de un script PowerShell `Rename-ADComputer` | Acelera la preparación de comandos de renombrado, manteniendo la ejecución bajo control del equipo técnico. El script no se ejecuta desde MAPEORED y requiere revisión previa. |
| Script Python de ingesta que combina datos CSV de UniFi y AD por IP y conserva coordenadas conocidas | Puede ayudar a actualizar una matriz de datos fuera de línea, reduciendo el trabajo de combinar columnas manualmente cuando los archivos cumplen el formato esperado. |

## 4. Público objetivo

- **Usuarios directos:** soporte de IT, administradores de red, técnicos de infraestructura y responsables de inventario de puestos/equipos.
- **Decisores:** responsables de IT, infraestructura, soporte, seguridad operativa o administración de sedes.
- **Organizaciones con mejor encaje:** empresas que necesitan relacionar ubicaciones físicas de oficina con datos de red y registros del directorio, especialmente en espacios con muchos puestos o equipos.
- **Tareas prioritarias:** localizar un activo por box, revisar su información de red, identificar diferencias en exportaciones y preparar propuestas de nomenclatura.

## 5. Posicionamiento y mensaje

- **Categoría:** herramienta visual de inventario y revisión de infraestructura física y de red.
- **Promesa prudente:** conectar el contexto del plano con los datos técnicos disponibles para que la revisión y el mantenimiento del inventario sean más claros.
- **Titular orientativo:** “Del plano de oficina al dato de infraestructura, en una vista”.
- **Tono:** técnico y operativo; enfatizar visualización, consulta y preparación controlada de cambios.

## 6. Diferenciadores y recursos visuales

- Plano con hotspots y selector entre pisos configurados.
- Tabla de cruce con identificadores, hostname, IP, MAC, switch/puerto, sistema operativo y estados.
- Ficha lateral de activo y acciones de calibración.
- Previsualización del JSON y del script PowerShell descargable.
- Identidad visual oscura, acentos cian y códigos de estado por color.
- En contenidos visuales, usar datos ficticios o anonimizados: las IP, MAC, nombres de host y topología de red pueden ser información sensible.

## 7. Límites y cautelas

- El frontend trabaja con archivos CSV/JSON y datos locales; no se verifica conexión en vivo a UniFi ni Active Directory, ni escritura directa a dichos sistemas.
- Generar un script PowerShell no implica ejecutar un cambio. Todo script debe revisarse, probarse y aprobarse por el administrador antes de usarlo en un dominio.
- El ingestor Python y la app HTML tienen formatos/esquemas de datos distintos en ciertas partes del repositorio; validar el flujo end-to-end y respaldar el JSON antes de usarlo como proceso operativo.
- El roadmap incluye cobertura y funciones futuras. No prometer mapeo completo de todos los puestos, reportes de auditoría PDF/CSV, gestión masiva productiva, cumplimiento ISO 27001 ni certificación: no están demostrados por la implementación actual.
- No hay integración implementada con Topología. La combinación de mapa físico de activos con organigrama y estructura empresarial es una oportunidad de evolución, no una capacidad disponible hoy.
- No se observan controles de autenticación o autorización en la aplicación MAPEORED. No publicar datos internos en un despliegue accesible externamente sin controles y revisión de seguridad.
