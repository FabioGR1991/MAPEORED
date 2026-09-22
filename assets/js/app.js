let activosData = [];
let cambiosGuardados = {};
let pisoActual = 5;
let unifiCsvData = null;
let adCsvData = null;
let mergeSort = { key: '', direction: 1 };
let calibrationMode = false;
let dragState = null;

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('floor-selector').addEventListener('change', cambiarPiso);
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => mostrarVista(button.dataset.view));
    });
    document.getElementById('merge-search').addEventListener('input', renderMergeTable);
    document.getElementById('status-filter').addEventListener('change', renderMergeTable);
    document.getElementById('os-filter').addEventListener('change', renderMergeTable);
    document.querySelectorAll('.sort-button').forEach(button => {
        button.addEventListener('click', () => ordenarMergeTable(button.dataset.sortKey));
    });
    document.getElementById('unifi-file').addEventListener('change', event => cargarCsv(event, 'unifi'));
    document.getElementById('ad-file').addEventListener('change', event => cargarCsv(event, 'ad'));
    document.getElementById('calibration-mode').addEventListener('change', event => {
        setCalibrationMode(event.target.checked);
    });
    document.addEventListener('keydown', manejarTecladoCalibracion);

    try {
        const response = await fetch('data/activos_mapeados.json');
        activosData = await response.json();
        renderMergeTable();
        actualizarMapa();
    } catch (e) {
        console.error('Error al cargar activos_mapeados.json', e);
    }
});

function mostrarVista(viewId) {
    document.querySelectorAll('.view-section').forEach(view => {
        view.hidden = view.id !== viewId;
    });
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.toggle('active', button.dataset.view === viewId);
    });
}

function cambiarPiso(event) {
    pisoActual = Number(event.target.value);
    actualizarMapa();
    document.getElementById('info-card').style.display = 'none';
}

function actualizarMapa() {
    document.getElementById('map-image').src = `assets/images/PISO ${pisoActual}.jpg`;
    renderHotspots();
}

function setCalibrationMode(enabled) {
    calibrationMode = enabled;
    document.getElementById('map-wrapper').classList.toggle('calibration-active', enabled);
    document.getElementById('calibration-output').hidden = !enabled;
    if (!enabled) dragState = null;
}

function renderHotspots() {
    const wrapper = document.getElementById('map-wrapper');
    // Limpiar hotspots previos
    wrapper.querySelectorAll('.box-hotspot').forEach(el => el.remove());

    activosData.filter(item => item.piso === pisoActual).forEach(item => {
        const div = document.createElement('div');
        div.className = 'box-hotspot';
        div.style.top = item.top_pct + '%';
        div.style.left = item.left_pct + '%';
        div.style.width = item.width_pct + '%';
        div.style.height = item.height_pct + '%';
        div.title = item.box_id;
        div.tabIndex = 0;
        div.dataset.boxId = item.box_id;

        div.onclick = (event) => {
            if (!calibrationMode) selectBox(event, item);
        };
        div.addEventListener('pointerdown', event => iniciarArrastre(event, div, item));
        div.addEventListener('pointermove', event => moverHotspot(event, div, item));
        div.addEventListener('pointerup', finalizarArrastre);
        div.addEventListener('pointercancel', finalizarArrastre);
        wrapper.appendChild(div);
    });
}

function iniciarArrastre(event, element, item) {
    if (!calibrationMode) return;
    event.preventDefault();
    event.stopPropagation();
    document.querySelectorAll('.box-hotspot').forEach(hotspot => hotspot.classList.remove('active'));
    element.classList.add('active');
    element.focus();
    dragState = { element, item };
    element.setPointerCapture(event.pointerId);
}

function moverHotspot(event, element, item) {
    if (!calibrationMode || !dragState || dragState.element !== element) return;
    const wrapper = document.getElementById('map-wrapper');
    const bounds = wrapper.getBoundingClientRect();
    const maxLeft = 100 - Number(item.width_pct || 0);
    const maxTop = 100 - Number(item.height_pct || 0);
    const left = limitar(((event.clientX - bounds.left) / bounds.width) * 100, 0, maxLeft);
    const top = limitar(((event.clientY - bounds.top) / bounds.height) * 100, 0, maxTop);
    actualizarCoordenadas(item, element, top, left);
}

function finalizarArrastre() {
    if (!dragState) return;
    mostrarCoordenadas(dragState.item);
    dragState = null;
}

function manejarTecladoCalibracion(event) {
    if (event.key.toLowerCase() === 'c' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        const toggle = document.getElementById('calibration-mode');
        toggle.checked = !toggle.checked;
        setCalibrationMode(toggle.checked);
        return;
    }
    if (!calibrationMode || !document.activeElement.classList.contains('box-hotspot')) return;
    const movement = event.shiftKey ? 1 : 0.1;
    let topDelta = 0;
    let leftDelta = 0;
    if (event.key === 'ArrowUp') topDelta = -movement;
    if (event.key === 'ArrowDown') topDelta = movement;
    if (event.key === 'ArrowLeft') leftDelta = -movement;
    if (event.key === 'ArrowRight') leftDelta = movement;
    if (!topDelta && !leftDelta) return;

    event.preventDefault();
    const element = document.activeElement;
    const item = activosData.find(activeItem => activeItem.box_id === element.dataset.boxId);
    if (!item) return;
    const top = limitar(Number(item.top_pct || 0) + topDelta, 0, 100 - Number(item.height_pct || 0));
    const left = limitar(Number(item.left_pct || 0) + leftDelta, 0, 100 - Number(item.width_pct || 0));
    actualizarCoordenadas(item, element, top, left);
    mostrarCoordenadas(item);
}

function actualizarCoordenadas(item, element, top, left) {
    item.top_pct = Number(top.toFixed(2));
    item.left_pct = Number(left.toFixed(2));
    element.style.top = item.top_pct + '%';
    element.style.left = item.left_pct + '%';
}

function mostrarCoordenadas(item) {
    const output = document.getElementById('calibration-output');
    output.textContent = `${item.box_id}: top_pct: ${Number(item.top_pct).toFixed(2)}, left_pct: ${Number(item.left_pct).toFixed(2)}`;
    console.log(`${item.box_id}: { "top_pct": ${Number(item.top_pct).toFixed(2)}, "left_pct": ${Number(item.left_pct).toFixed(2)} }`);
}

function limitar(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
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

function renderMergeTable() {
    const tableBody = document.getElementById('merge-table-body');
    const emptyState = document.getElementById('merge-empty');
    actualizarOpcionesSistemaOperativo();
    const query = document.getElementById('merge-search').value.trim().toLowerCase();
    const selectedStatus = document.getElementById('status-filter').value;
    const selectedOs = document.getElementById('os-filter').value;
    let filteredItems = activosData.filter(item => {
        const searchableText = [item.ip_address, item.hostname_actual, item.mac_address, item.box_id, item.operating_system]
            .join(' ')
            .toLowerCase();
        return searchableText.includes(query)
            && (!selectedStatus || item.status === selectedStatus)
            && (!selectedOs || (item.operating_system || 'N/D') === selectedOs);
    });

    if (mergeSort.key) {
        filteredItems.sort((first, second) => compararValores(first[mergeSort.key], second[mergeSort.key]) * mergeSort.direction);
    }

    tableBody.replaceChildren();
    emptyState.hidden = filteredItems.length > 0;
    document.getElementById('merge-result-count').textContent = `Mostrando ${filteredItems.length} de ${activosData.length} registros`;
    actualizarIndicadoresOrden();

    filteredItems.forEach(item => {
        const statusColor = {
            VERIFICADO_ACTIVO: 'green',
            SOLO_UNIFI_NO_AD: 'yellow',
            SOLO_AD_INACTIVO: 'red'
        }[item.status] || 'yellow';
        const row = document.createElement('tr');
        const values = [
            item.box_id,
            item.hostname_actual,
            item.ip_address,
            item.mac_address,
            item.switch_connection,
            item.operating_system || 'N/D'
        ];

        const statusCell = document.createElement('td');
        const led = document.createElement('span');
        led.className = `status-led ${statusColor}`;
        led.title = item.status;
        led.setAttribute('aria-label', item.status);
        statusCell.appendChild(led);
        row.appendChild(statusCell);

        values.forEach(value => {
            const cell = document.createElement('td');
            cell.textContent = value;
            row.appendChild(cell);
        });

        const statusCellBadge = document.createElement('td');
        const badge = document.createElement('span');
        badge.className = `status-badge ${statusColor}`;
        badge.textContent = item.status;
        statusCellBadge.appendChild(badge);
        row.appendChild(statusCellBadge);

        const actionCell = document.createElement('td');
        const actionButton = document.createElement('button');
        actionButton.className = 'merge-action';
        actionButton.textContent = 'Seleccionar en Plano';
        actionButton.type = 'button';
        actionButton.addEventListener('click', () => seleccionarEnPlano(item));
        actionCell.appendChild(actionButton);
        row.appendChild(actionCell);
        tableBody.appendChild(row);
    });
}

function ordenarMergeTable(key) {
    if (mergeSort.key === key) {
        mergeSort.direction *= -1;
    } else {
        mergeSort = { key, direction: 1 };
    }
    renderMergeTable();
}

function compararValores(firstValue, secondValue) {
    return String(firstValue || 'N/D').localeCompare(
        String(secondValue || 'N/D'),
        undefined,
        { numeric: true, sensitivity: 'base' }
    );
}

function actualizarIndicadoresOrden() {
    document.querySelectorAll('.sort-button').forEach(button => {
        const isActive = button.dataset.sortKey === mergeSort.key;
        button.classList.toggle('active', isActive);
        button.querySelector('.sort-indicator').textContent = isActive
            ? (mergeSort.direction === 1 ? '▲' : '▼')
            : '⇅';
    });
}

function actualizarOpcionesSistemaOperativo() {
    const select = document.getElementById('os-filter');
    const selectedValue = select.value;
    const operatingSystems = [...new Set(activosData.map(item => item.operating_system || 'N/D'))]
        .sort((first, second) => compararValores(first, second));
    select.replaceChildren(new Option('Todos', ''));
    operatingSystems.forEach(operatingSystem => {
        select.appendChild(new Option(operatingSystem, operatingSystem));
    });
    select.value = operatingSystems.includes(selectedValue) ? selectedValue : '';
}

function cargarCsv(event, source) {
    const file = event.target.files[0];
    if (!file) return;

    document.getElementById(`${source}-file-name`).textContent = file.name;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const rows = parseCsv(reader.result);
            validarColumnas(rows, source);
            if (source === 'unifi') {
                unifiCsvData = rows;
            } else {
                adCsvData = rows;
            }
            actualizarEstadoCarga();
            if (unifiCsvData && adCsvData) cruzarExports(unifiCsvData, adCsvData);
        } catch (error) {
            actualizarEstadoCarga(`Error al leer ${file.name}: ${error.message}`, true);
        }
    };
    reader.onerror = () => actualizarEstadoCarga(`No se pudo leer ${file.name}.`, true);
    reader.readAsText(file, 'UTF-8');
}

function validarColumnas(rows, source) {
    const requiredColumns = source === 'unifi'
        ? ['Name', 'MAC Address', 'Connection', 'Network', 'IP Address', 'Activity', 'Download', '24h Usage', 'First Seen', 'Last Seen']
        : ['Hostname_Actual', 'IP_Registrada_AD', 'IP_Resuelta_DNS', 'Estado', 'Descripcion', 'OU_Actual', 'Sistema_Operativo'];
    return requiredColumns.filter(column => !Object.hasOwn(rows[0], normalizarHeader(column)));
}

function parseCsv(text) {
    const delimiter = detectarDelimitador(text);
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        const nextCharacter = text[index + 1];
        if (character === '"' && quoted && nextCharacter === '"') {
            field += '"';
            index += 1;
        } else if (character === '"') {
            quoted = !quoted;
        } else if (character === delimiter && !quoted) {
            row.push(field.trim());
            field = '';
        } else if ((character === '\n' || character === '\r') && !quoted) {
            if (character === '\r' && nextCharacter === '\n') index += 1;
            row.push(field.trim());
            if (row.some(value => value !== '')) rows.push(row);
            row = [];
            field = '';
        } else {
            field += character;
        }
    }
    if (field || row.length) {
        row.push(field.trim());
        if (row.some(value => value !== '')) rows.push(row);
    }
    if (rows.length < 2) throw new Error('el CSV no contiene filas de datos');

    const headers = rows.shift().map(normalizarHeader);
    return rows.map(values => headers.reduce((record, header, index) => {
        record[header] = values[index] ? values[index].trim() : 'N/D';
        return record;
    }, {}));
}

function detectarDelimitador(text) {
    const firstLine = text.split(/\r?\n/).find(line => line.trim()) || '';
    const candidates = [',', ';', '\t'];
    return candidates.reduce((best, candidate) => {
        const count = firstLine.split(candidate).length - 1;
        return count > best.count ? { delimiter: candidate, count } : best;
    }, { delimiter: ',', count: 0 }).delimiter;
}

function normalizarHeader(header) {
    return String(header || '')
        .replace(/^\uFEFF/, '')
        .replace(/[\u200B-\u200D\u2060\u00A0]/g, ' ')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

function csvValue(row, header) {
    const value = row[normalizarHeader(header)];
    return value && value.trim() ? value.trim() : 'N/D';
}

function actualizarEstadoCarga(message, isError = false) {
    const status = document.getElementById('merge-source-status');
    status.textContent = message || `UniFi: ${unifiCsvData ? 'listo' : 'pendiente'} | AD: ${adCsvData ? 'listo' : 'pendiente'}`;
    status.style.color = isError ? '#f56b75' : '#36d399';
}

function cruzarExports(unifiRows, adRows) {
    const baselineByIp = new Map(activosData.map(item => [normalizar(item.ip_address), item]));
    const adByIp = new Map(adRows.map(row => [normalizar(csvValue(row, 'IP_Registrada_AD')), row]));
    const adByHostname = new Map(adRows.map(row => [normalizar(csvValue(row, 'Hostname_Actual')), row]));
    const matchedAd = new Set();
    const merged = unifiRows.map(row => {
        const ad = adByIp.get(normalizar(csvValue(row, 'IP Address')))
            || adByHostname.get(normalizar(csvValue(row, 'Name')));
        if (ad) matchedAd.add(ad);
        const baseline = baselineByIp.get(normalizar(csvValue(row, 'IP Address'))) || {};
        return crearActivoMerge(row, ad, baseline, ad ? 'VERIFICADO_ACTIVO' : 'SOLO_UNIFI_NO_AD');
    });

    adRows.forEach(ad => {
        if (matchedAd.has(ad)) return;
        const baseline = baselineByIp.get(normalizar(csvValue(ad, 'IP_Registrada_AD'))) || {};
        merged.push(crearActivoMerge(null, ad, baseline, 'SOLO_AD_INACTIVO'));
    });

    activosData = merged;
    renderMergeTable();
    actualizarMapa();
    document.getElementById('merge-source-status').textContent = `Cruce completado: ${merged.length} registros.`;
}

function crearActivoMerge(unifi, ad, baseline, status) {
    return {
        ...baseline,
        box_id: (unifi && csvValue(unifi, 'Name')) || baseline.box_id || (ad && csvValue(ad, 'Hostname_Actual')) || 'N/D',
        hostname_actual: (ad && csvValue(ad, 'Hostname_Actual')) || 'N/D',
        mac_address: (unifi && csvValue(unifi, 'MAC Address')) || baseline.mac_address || 'N/D',
        ip_address: (unifi && csvValue(unifi, 'IP Address')) || (ad && csvValue(ad, 'IP_Registrada_AD')) || baseline.ip_address || 'N/D',
        switch_connection: (unifi && csvValue(unifi, 'Connection')) || baseline.switch_connection || 'N/D',
        last_seen: (unifi && csvValue(unifi, 'Last Seen')) || 'N/D',
        operating_system: (ad && csvValue(ad, 'Sistema_Operativo')) || baseline.operating_system || 'N/D',
        estado_ad: (ad && csvValue(ad, 'Estado')) || baseline.estado_ad || 'N/D',
        ou_actual: (ad && csvValue(ad, 'OU_Actual')) || baseline.ou_actual || 'N/D',
        status
    };
}

function normalizar(value) {
    return String(value || '').trim().toLowerCase();
}

function seleccionarEnPlano(item) {
    pisoActual = item.piso;
    document.getElementById('floor-selector').value = String(item.piso);
    mostrarVista('map-view');
    actualizarMapa();

    const hotspot = [...document.querySelectorAll('.box-hotspot')]
        .find(element => element.title === item.box_id);
    if (hotspot) {
        selectBox({ target: hotspot }, item);
    }
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
