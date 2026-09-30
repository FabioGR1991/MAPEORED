# MAPEORED — Landing Page

## Navegación

**Marca:** MAPEORED  
**Enlaces:** Plataforma · Beneficios · Casos de uso · Cómo funciona  
**CTA:** Solicitar una demostración

---

## Hero

**MAPEO VISUAL DE INFRAESTRUCTURA Y ACTIVOS DE RED**

# Encontrá el equipo. Entendé su contexto. Revisá el dato.

## MAPEORED conecta la ubicación de boxes en el plano con la información técnica disponible en tus registros y exportaciones. Consultá activos por piso, revisá datos de red y prepará cambios de hostname para validación del equipo de IT.

**CTA principal:** Solicitar una demostración  
**CTA secundario:** Ver cómo funciona

**Microcopy:** Plano interactivo · Cruce de CSV · Preparación de cambios PowerShell

**Visual sugerido:** plano de una sede con un hotspot seleccionado y una ficha lateral que muestre información ficticia de box, hostname, IP y switch.

---

## De datos dispersos a una vista contextual

### Tu inventario técnico también tiene una ubicación.

Un registro puede decir hostname, IP y puerto; un plano puede mostrar un puesto, pero sin una referencia común cuesta relacionarlos. MAPEORED pone ambos contextos a la vista para ayudar a soporte e infraestructura a localizar activos y revisar discrepancias con más claridad.

---

## Bento Grid — Revisión visual de infraestructura

### 1. Ubicación en plano

**Cada box, en su contexto físico.**  
Navegá por los pisos configurados, seleccioná un hotspot y consultá la información asociada al puesto o activo.

**Icono sugerido:** `MapPinned`  
**Visual:** plano de planta con boxes interactivos y un puesto destacado.

### 2. Cruce de datos de red y directorio

**Compará exportaciones y encontrá registros para revisar.**  
Cargá los CSV disponibles de UniFi y Active Directory y consultá una tabla con hostname, IP, MAC, switch/puerto, sistema operativo y estado del cruce.

**Icono sugerido:** `GitCompare`  
**Visual:** panel de carga de dos CSV y tabla con estados de ejemplo claramente identificados.

### 3. Búsqueda y navegación entre lista y plano

**Del dato técnico al punto del mapa.**  
Buscá y filtrá registros por campos disponibles y estado. Desde un resultado, saltá al activo en el plano para consultar su ficha.

**Icono sugerido:** `Search`  
**Visual:** resultado seleccionado en una tabla y hotspot correspondiente resaltado en el plano.

### 4. Ajuste de mapa y cambios preparados para revisión

**Acomodá la representación y prepará la nomenclatura.**  
Ajustá la ubicación visual de los hotspots, revisá los datos JSON y prepará un script PowerShell descargable a partir de los hostnames propuestos.

**Icono sugerido:** `SlidersHorizontal` o `Terminal`  
**Visual:** modo de calibración junto a una vista previa del script; incluir una nota “revisar antes de ejecutar”.

---

## Casos de uso

### Soporte de IT

Usá el plano para orientar la búsqueda de un puesto o dispositivo y consultá su hostname, IP, switch/puerto y estado registrado.

### Infraestructura y redes

Contrastá exportaciones de red con los datos de directorio para preparar una lista de elementos que necesitan verificación.

### Administración de activos y sedes

Mantené una referencia visual de boxes y ubicaciones configuradas. Ajustá los hotspots para que correspondan mejor con la distribución física representada.

### Estandarización de hostnames

Editá nombres propuestos y generá un archivo PowerShell para revisión del administrador. La ejecución de cambios permanece fuera de la aplicación y bajo el proceso de aprobación de IT.

---

## Cómo funciona

### 1. Consultá el plano y los activos cargados

Elegí uno de los pisos configurados y seleccioná el box que querés revisar. La ficha presenta los datos asociados disponibles.

### 2. Cargá las exportaciones para comparar

Proporcioná los CSV de UniFi y Active Directory con las columnas esperadas. Revisá los registros y filtrá los resultados según los campos disponibles.

### 3. Revisá y prepara el siguiente paso

Ajustá la ubicación del hotspot o el hostname propuesto. Copiá o descargá el JSON actualizado y, si corresponde, generá un script PowerShell para que IT lo valide antes de ejecutarlo.

---

## Una visión complementaria para la empresa

MAPEORED aborda el **dónde físico** de puestos y activos de infraestructura. Topología Empresarial aborda el **quién y cómo se organiza** de las personas, áreas y relaciones jerárquicas. Son herramientas complementarias; la conexión entre ambas es una posibilidad futura y todavía no está implementada.

---

## CTA final

# Hacé más visible el vínculo entre el plano y tus datos técnicos.

Conocé cómo MAPEORED puede apoyar la consulta, revisión y actualización controlada de la información de infraestructura de tu organización.

**Botón:** Solicitar una demostración

**Texto de apoyo:** Revisá el flujo con datos de ejemplo o anonimizados antes de considerar su uso operativo.

---

## Nota de alcance

La comparación se basa en archivos cargados por el usuario y datos locales; no representa una sincronización en vivo con UniFi o Active Directory. MAPEORED prepara archivos JSON y scripts para revisión, pero no persiste automáticamente cambios en un servicio central ni ejecuta cambios de hostname. La aplicación actual no está integrada con Topología Empresarial.