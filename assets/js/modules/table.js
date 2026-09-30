/**
 * @file table.js
 * Data Merge Table, Filters, Sorting, Pagination and CSV Ingestion Engine.
 * Adheres strictly to security requirements:
 * - Pure DOM creation via document.createElement and textContent
 * - No innerHTML injection (XSS remediation P0)
 * - Safe CSV parsing and ambiguity detection (P1)
 * - "Añadir al Plano +" workflow with floor selection
 */

import { CONFIG } from '../config.js';
import { normalizarValor, normalizarHeaderCsv, logOperationalEvent } from '../services/assetRepository.js';
import { activoEnPlano, selectAndGoToMap, renderFloorplanHotspots } from './map.js';

let mergeSearchTimer = null;

/**
 * Renders the Data Merge Pre-Check table.
 * @param {Object} state
 * @param {Object} callbacks
 */
export function renderMergeTable(state, callbacks = {}) {
  const tbody = document.getElementById('merge-table-body');
  if (!tbody) return;
  tbody.replaceChildren();

  const searchInput = document.getElementById('merge-search');
  const searchVal = searchInput ? searchInput.value.toLowerCase() : '';
  const statusFilterElem = document.getElementById('filter-status');
  const statusFilter = statusFilterElem ? statusFilterElem.value : 'ALL';
  const osFilterElem = document.getElementById('filter-os');
  const osFilter = osFilterElem ? osFilterElem.value : 'ALL';

  let filtered = state.activosData.filter(item => {
    const matchesSearch = (item.box_id && item.box_id.toLowerCase().includes(searchVal)) ||
                          (item.hostname_actual && item.hostname_actual.toLowerCase().includes(searchVal)) ||
                          (item.ip_address && item.ip_address.toLowerCase().includes(searchVal)) ||
                          (item.mac_address && item.mac_address.toLowerCase().includes(searchVal));

    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
    const matchesOs = osFilter === 'ALL' || item.operating_system === osFilter;

    return matchesSearch && matchesStatus && matchesOs;
  });

  // Sorting
  filtered.sort((a, b) => {
    let valA = a[state.currentSortColumn] || '';
    let valB = b[state.currentSortColumn] || '';
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (valA < valB) return state.isSortAsc ? -1 : 1;
    if (valA > valB) return state.isSortAsc ? 1 : -1;
    return 0;
  });

  const pageCount = Math.max(1, Math.ceil(filtered.length / CONFIG.MERGE_PAGE_SIZE));
  state.currentMergePage = Math.min(Math.max(state.currentMergePage, 0), pageCount - 1);
  const startIndex = state.currentMergePage * CONFIG.MERGE_PAGE_SIZE;
  const visibleItems = filtered.slice(startIndex, startIndex + CONFIG.MERGE_PAGE_SIZE);

  const countElem = document.getElementById('merge-count');
  const totalElem = document.getElementById('merge-total');
  const rangeElem = document.getElementById('merge-page-range');
  const indElem = document.getElementById('merge-page-indicator');
  const prevBtn = document.getElementById('merge-prev-page');
  const nextBtn = document.getElementById('merge-next-page');

  if (countElem) countElem.textContent = filtered.length;
  if (totalElem) totalElem.textContent = state.activosData.length;
  if (rangeElem) {
    rangeElem.textContent = filtered.length
      ? `${startIndex + 1}-${startIndex + visibleItems.length} visibles`
      : '0 visibles';
  }
  if (indElem) indElem.textContent = `${state.currentMergePage + 1} / ${pageCount}`;
  if (prevBtn) prevBtn.disabled = state.currentMergePage === 0;
  if (nextBtn) nextBtn.disabled = state.currentMergePage >= pageCount - 1;

  const fragment = document.createDocumentFragment();

  visibleItems.forEach(row => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-800/40 transition-colors";

    let ledColor = "led-green";
    let badgeClass = 'bg-emerald-950 text-emerald-400 border-emerald-800/50';
    let statusLabel = 'VERIFICADO_ACTIVO';
    if (row.status === 'SOLO_UNIFI_NO_AD') {
      ledColor = "led-yellow";
      badgeClass = 'bg-amber-950 text-amber-400 border-amber-800/50';
      statusLabel = 'SOLO_UNIFI_NO_AD';
    } else if (row.status === 'SOLO_AD_INACTIVO') {
      ledColor = "led-red";
      badgeClass = 'bg-rose-950 text-rose-400 border-rose-800/50';
      statusLabel = 'SOLO_AD_INACTIVO';
    } else if (row.status === 'AMBIGUO') {
      ledColor = "led-red";
      badgeClass = 'bg-rose-950 text-rose-400 border-rose-800/50';
      statusLabel = 'AMBIGUO';
    } else if (row.status === 'BORRADOR') {
      ledColor = 'led-gray';
      badgeClass = 'bg-slate-800 text-slate-300 border-slate-600';
      statusLabel = 'BORRADOR';
    }

    const statusCell = document.createElement('td');
    statusCell.className = 'py-3 px-4 text-center';
    const led = document.createElement('span');
    led.className = `led-dot ${ledColor}`;
    statusCell.appendChild(led);
    tr.appendChild(statusCell);

    [
      { value: row.box_id, className: 'py-3 px-4 text-cyan-300 font-bold' },
      { value: row.hostname_actual || 'N/D', className: 'py-3 px-4 text-slate-200' },
      { value: row.ip_address || 'N/D', className: 'py-3 px-4 text-slate-300' },
      { value: row.mac_address || 'N/D', className: 'py-3 px-4 text-slate-400' },
      { value: row.switch_connection || 'N/D', className: 'py-3 px-4 text-slate-400' },
      { value: row.operating_system || 'N/D', className: 'py-3 px-4 text-slate-300' }
    ].forEach(({ value, className }) => {
      const cell = document.createElement('td');
      cell.className = className;
      cell.textContent = value;
      tr.appendChild(cell);
    });

    const statusBadgeCell = document.createElement('td');
    statusBadgeCell.className = 'py-3 px-4';
    const statusBadge = document.createElement('span');
    statusBadge.className = `${badgeClass} border px-2 py-0.5 rounded text-[10px] font-bold`;
    statusBadge.textContent = statusLabel;
    statusBadgeCell.appendChild(statusBadge);
    tr.appendChild(statusBadgeCell);

    const actionCell = document.createElement('td');
    actionCell.className = 'py-3 px-4 text-center';
    const actionButton = document.createElement('button');

    const isAssigned = activoEnPlano(row);

    if (isAssigned) {
      actionButton.className = 'bg-cyan-950 hover:bg-cyan-900 text-cyan-400 border border-cyan-800/60 px-2.5 py-1 rounded text-[11px] font-medium transition-all';
      actionButton.textContent = 'Ver en Plano';
      actionButton.addEventListener('click', () => {
        selectAndGoToMap(row.box_id, state, callbacks);
      });
    } else {
      actionButton.className = 'bg-amber-950 hover:bg-amber-900 text-amber-400 border border-amber-800/60 px-2.5 py-1 rounded text-[11px] font-medium transition-all';
      actionButton.textContent = 'Añadir al Plano +';
      actionButton.addEventListener('click', async () => {
        const pisoElegido = window.prompt("Seleccionar piso para ubicar el activo en el plano:\n- Ingrese 5 para Piso 5\n- Ingrese 17 para Piso 17", "5");
        if (pisoElegido !== null) {
          const normalizado = pisoElegido.trim().replace(/^piso\s*/i, '');
          const numPiso = Number(normalizado);
          if (numPiso === 5 || numPiso === 17) {
            const usedBoxIds = new Set(state.activosData.map(a => a.box_id));
            const existingNumbers = state.activosData
              .map(a => /^BOX-(\d+)$/i.exec(a.box_id))
              .filter(Boolean)
              .map(m => Number(m[1]));
            let nextIndex = Math.max(0, ...existingNumbers) + 1;
            while (usedBoxIds.has(`BOX-${nextIndex}`)) nextIndex += 1;

            row.box_id = `BOX-${nextIndex}`;
            row.piso = numPiso;
            row.top_pct = 40.0;
            row.left_pct = 40.0;
            row.width_pct = 3.5;
            row.height_pct = 4.2;
            row.en_plano = true;

            if (callbacks.onSave) await callbacks.onSave(row);

            renderFloorplanHotspots(state, (id) => callbacks.selectHotspot(id, state, callbacks));
            renderMergeTable(state, callbacks);
            if (callbacks.onRefresh) callbacks.onRefresh();
            selectAndGoToMap(row.box_id, state, callbacks);
          } else {
            window.alert("Piso no válido. Por favor elija 5 o 17.");
          }
        }
      });
    }

    actionCell.appendChild(actionButton);
    tr.appendChild(actionCell);
    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);
}

/**
 * Debounced search triggering table render.
 */
export function programarRenderMergeTable(state, callbacks = {}) {
  window.clearTimeout(mergeSearchTimer);
  mergeSearchTimer = window.setTimeout(() => {
    state.currentMergePage = 0;
    renderMergeTable(state, callbacks);
  }, 180);
}

export function resetearPaginaMerge(state, callbacks = {}) {
  state.currentMergePage = 0;
  renderMergeTable(state, callbacks);
}

export function cambiarPaginaMerge(delta, state, callbacks = {}) {
  state.currentMergePage += delta;
  renderMergeTable(state, callbacks);
}

export function sortTable(columnKey, state, callbacks = {}) {
  if (state.currentSortColumn === columnKey) {
    state.isSortAsc = !state.isSortAsc;
  } else {
    state.currentSortColumn = columnKey;
    state.isSortAsc = true;
  }
  renderMergeTable(state, callbacks);
}

export function populateOsFilterDropdown(state) {
  const select = document.getElementById('filter-os');
  if (!select) return;
  select.replaceChildren();

  const defaultOpt = document.createElement('option');
  defaultOpt.value = 'ALL';
  defaultOpt.textContent = 'Todos los Sistemas Operativos';
  select.appendChild(defaultOpt);

  const osList = [...new Set(state.activosData.map(asset => asset.operating_system || 'N/D'))];
  osList.forEach(os => {
    const opt = document.createElement('option');
    opt.value = os;
    opt.textContent = os;
    select.appendChild(opt);
  });
}

function csvValue(row, column) {
  const value = row[normalizarHeaderCsv(column)];
  return value && value.trim() ? value.trim() : 'N/D';
}

function encontrarDuplicados(rows, getters) {
  const rowsByValue = new Map();
  rows.forEach(row => {
    const keys = new Set(getters
      .map(getter => normalizarValor(getter(row)))
      .filter(value => value && value !== 'n/d'));
    keys.forEach(key => {
      if (!rowsByValue.has(key)) rowsByValue.set(key, []);
      rowsByValue.get(key).push(row);
    });
  });

  const duplicateRows = new Set();
  const duplicateValues = [];
  rowsByValue.forEach((matches, value) => {
    if (matches.length < 2) return;
    duplicateValues.push(value);
    matches.forEach(row => duplicateRows.add(row));
  });
  return { rows: duplicateRows, values: duplicateValues };
}

function agregarIndice(index, key, row) {
  const normalizedKey = normalizarValor(key);
  if (!normalizedKey || normalizedKey === 'n/d') return;
  if (!index.has(normalizedKey)) index.set(normalizedKey, []);
  index.get(normalizedKey).push(row);
}

function buscarEnIndice(index, keys) {
  const matches = new Set();
  keys.forEach(key => {
    const rows = index.get(normalizarValor(key)) || [];
    rows.forEach(row => matches.add(row));
  });
  return [...matches];
}

function buscarActivoBase(ip, name, state) {
  const normIp = normalizarValor(ip);
  const normName = normalizarValor(name);
  return state.activosData.find(asset => {
    const assetIp = normalizarValor(asset.ip_address);
    const assetBox = normalizarValor(asset.box_id);
    const assetHost = normalizarValor(asset.hostname_actual);
    const matchIp = normIp && normIp !== 'n/d' && assetIp === normIp;
    const matchBox = normName && normName !== 'n/d' && assetBox === normName;
    const matchHost = normName && normName !== 'n/d' && assetHost === normName;
    return matchIp || matchBox || matchHost;
  }) || {};
}

function crearActivoDesdeCruce(unifi, ad, baseline, status, usedBoxIds, currentFloor) {
  const name = unifi ? csvValue(unifi, 'Name') : 'N/D';
  const adHostname = ad ? csvValue(ad, 'Hostname_Actual') : 'N/D';
  const ip = unifi ? csvValue(unifi, 'IP Address') : csvValue(ad, 'IP_Registrada_AD');
  const ipAddress = ip === 'N/D' ? csvValue(ad || {}, 'IP_Resuelta_DNS') : ip;
  const requestedBoxId = baseline.box_id || (unifi && name !== 'N/D' ? name : adHostname !== 'N/D' ? adHostname : `AD-${ipAddress}`);
  let boxId = requestedBoxId;
  let suffix = 2;
  while (usedBoxIds.has(boxId)) {
    boxId = `${requestedBoxId}-${suffix}`;
    suffix += 1;
    status = 'AMBIGUO';
  }
  usedBoxIds.add(boxId);
  const isBaselineMapped = Boolean(baseline.box_id && /^BOX-\d+/i.test(baseline.box_id) && baseline.top_pct != null);
  return {
    ...baseline,
    box_id: boxId,
    piso: baseline.piso || Number(currentFloor.replace('Piso ', '')),
    top_pct: baseline.top_pct ?? 50,
    left_pct: baseline.left_pct ?? 50,
    width_pct: baseline.width_pct ?? 3.5,
    height_pct: baseline.height_pct ?? 4,
    en_plano: isBaselineMapped,
    hostname_actual: adHostname,
    hostname_propuesto: baseline.hostname_propuesto || adHostname,
    ip_address: ipAddress,
    mac_address: unifi ? csvValue(unifi, 'MAC Address') : (baseline.mac_address || 'N/D'),
    switch_connection: unifi ? csvValue(unifi, 'Connection') : (baseline.switch_connection || 'N/D'),
    operating_system: ad ? csvValue(ad, 'Sistema_Operativo') : (baseline.operating_system || 'N/D'),
    status
  };
}

export function mostrarEstadoCsv(type, message, isError = false, isLoading = false, canRetry = false) {
  const element = document.getElementById(type === 'unifi' ? 'unifi-file-status' : 'ad-file-status');
  const retryButton = document.getElementById(type === 'unifi' ? 'retry-unifi-file' : 'retry-ad-file');
  if (!element) return;
  element.replaceChildren();
  if (isLoading) {
    const spinner = document.createElement('span');
    spinner.className = 'loading-spinner mr-2 align-middle';
    spinner.setAttribute('aria-hidden', 'true');
    element.appendChild(spinner);
  }
  element.appendChild(document.createTextNode(message));
  element.className = isError
    ? 'text-[11px] text-rose-400 font-semibold'
    : isLoading ? 'text-[11px] text-slate-300 font-semibold' : 'text-[11px] text-emerald-400 font-semibold';
  if (retryButton) retryButton.classList.toggle('hidden', !canRetry);
}

export function actualizarEstadoCruce(message, isError = false, isLoading = false) {
  const status = document.getElementById('merge-source-status');
  if (!status) return;
  status.replaceChildren();
  if (isLoading) {
    const spinner = document.createElement('span');
    spinner.className = 'loading-spinner mr-2 align-middle';
    spinner.setAttribute('aria-hidden', 'true');
    status.appendChild(spinner);
  }
  status.appendChild(document.createTextNode(message));
  status.className = isError
    ? 'mt-3 text-xs text-rose-300'
    : isLoading ? 'mt-3 text-xs text-slate-200' : 'mt-3 text-xs text-slate-400';
}

/**
 * Handles CSV Upload for UniFi or Active Directory.
 */
export async function handleCsvUpload(event, type, state, callbacks = {}, isRetry = false) {
  const input = event.target;
  const file = input.files[0];
  if (!file) return;

  const previousRows = type === 'unifi' ? state.unifiCsvRows : state.adCsvRows;
  if (previousRows && !isRetry && !window.confirm('Reemplazar este CSV descarta su importación validada actual. ¿Continuar?')) {
    input.value = '';
    logOperationalEvent('csv.replacement.cancelled', { source: type });
    return;
  }

  const startedAt = performance.now();
  mostrarEstadoCsv(type, 'Leyendo archivo CSV…', false, true);
  actualizarEstadoCruce('Leyendo y validando los archivos…', false, true);

  try {
    const rows = await callbacks.repository.importCsv(file, type);
    if (type === 'unifi') state.unifiCsvRows = rows;
    else state.adCsvRows = rows;

    mostrarEstadoCsv(type, `CSV validado: ${rows.length} filas.`, false);
    logOperationalEvent('csv.read.success', {
      source: type,
      recordCount: rows.length,
      durationMs: Math.round(performance.now() - startedAt)
    });

    const applyBtn = document.getElementById('merge-apply-button');
    if (state.unifiCsvRows && state.adCsvRows) {
      if (applyBtn) applyBtn.classList.remove('hidden');
      actualizarEstadoCruce(`UniFi: ${state.unifiCsvRows.length} filas; AD: ${state.adCsvRows.length} filas. Revisá y aplicá el cruce.`);
    } else {
      actualizarEstadoCruce(`CSV ${type} validado; falta el otro archivo.`);
    }
  } catch (error) {
    input.value = '';
    mostrarEstadoCsv(type, `Error de validación: ${error.message}`, true, false, true);
    actualizarEstadoCruce('El CSV no se aceptó; cualquier importación anterior sigue vigente.', true);
    logOperationalEvent('csv.validation.error', { source: type, errorType: error.name || 'ValidationError' });
  }
}

export function reintentarCargaCsv(type, state, callbacks = {}) {
  const input = document.getElementById(type === 'unifi' ? 'csv-unifi-input' : 'csv-ad-input');
  if (!input || !input.files.length) {
    mostrarEstadoCsv(type, 'Seleccioná nuevamente el archivo para reintentar.', true);
    return;
  }
  handleCsvUpload({ target: input }, type, state, callbacks, true);
}

export function confirmarAplicarCruce(state, callbacks = {}) {
  if (state.isCrossProcessing || !state.unifiCsvRows || !state.adCsvRows) return;
  const replaceCount = state.activosData.length;
  if (!window.confirm(`Aplicar el cruce reemplazará los ${replaceCount} activos del estado actual. ¿Continuar?`)) {
    logOperationalEvent('csv.merge.cancelled', { recordCount: replaceCount });
    return;
  }

  const button = document.getElementById('merge-apply-button');
  state.isCrossProcessing = true;
  if (button) button.disabled = true;
  actualizarEstadoCruce('Calculando correspondencias y ambigüedades…', false, true);

  window.setTimeout(() => {
    const startedAt = performance.now();
    try {
      ejecutarCruceCSV(state, callbacks);
      if (button) button.classList.add('hidden');
      logOperationalEvent('csv.merge.applied', {
        recordCount: state.activosData.length,
        durationMs: Math.round(performance.now() - startedAt)
      });
    } catch (error) {
      actualizarEstadoCruce('No se pudo aplicar el cruce. Los CSV siguen disponibles para reintentar.', true);
      logOperationalEvent('csv.merge.error', { errorType: error.name || 'MergeError' });
    } finally {
      state.isCrossProcessing = false;
      if (button) button.disabled = false;
    }
  }, 20);
}

export function ejecutarCruceCSV(state, callbacks = {}) {
  const adByIp = new Map();
  const adByHostname = new Map();
  const matchedAdRows = new Set();
  const ambiguousAdRows = new Set();
  const usedBoxIds = new Set();
  state.mergeAmbiguities = [];

  const duplicateUnifiIps = encontrarDuplicados(state.unifiCsvRows, [row => csvValue(row, 'IP Address')]);
  const duplicateUnifiNames = encontrarDuplicados(state.unifiCsvRows, [row => csvValue(row, 'Name')]);
  const duplicateAdIps = encontrarDuplicados(state.adCsvRows, [
    row => csvValue(row, 'IP_Registrada_AD'),
    row => csvValue(row, 'IP_Resuelta_DNS')
  ]);
  const duplicateAdHostnames = encontrarDuplicados(state.adCsvRows, [row => csvValue(row, 'Hostname_Actual')]);
  [duplicateAdIps, duplicateAdHostnames].forEach(info => info.rows.forEach(row => ambiguousAdRows.add(row)));

  [
    ['IP UniFi', duplicateUnifiIps],
    ['hostname UniFi', duplicateUnifiNames],
    ['IP Active Directory', duplicateAdIps],
    ['hostname Active Directory', duplicateAdHostnames]
  ].forEach(([label, info]) => {
    info.values.slice(0, 10).forEach(value => state.mergeAmbiguities.push(`${label} duplicado: ${value}`));
  });

  state.adCsvRows.forEach(row => {
    agregarIndice(adByIp, csvValue(row, 'IP_Registrada_AD'), row);
    agregarIndice(adByIp, csvValue(row, 'IP_Resuelta_DNS'), row);
    agregarIndice(adByHostname, csvValue(row, 'Hostname_Actual'), row);
  });

  const mergedAssets = [];
  state.unifiCsvRows.forEach(unifi => {
    const ip = csvValue(unifi, 'IP Address');
    const name = csvValue(unifi, 'Name');
    const candidates = buscarEnIndice(adByIp, [ip]).concat(buscarEnIndice(adByHostname, [name]));
    const uniqueCandidates = [...new Set(candidates)];
    const ambiguous = duplicateUnifiIps.rows.has(unifi)
      || duplicateUnifiNames.rows.has(unifi)
      || uniqueCandidates.length > 1
      || uniqueCandidates.some(row => ambiguousAdRows.has(row));
    const ad = !ambiguous && uniqueCandidates.length === 1 ? uniqueCandidates[0] : null;
    if (ambiguous) uniqueCandidates.forEach(row => ambiguousAdRows.add(row));
    if (ad) matchedAdRows.add(ad);

    const baseline = buscarActivoBase(ip, name, state);
    const status = ambiguous ? 'AMBIGUO' : ad ? 'VERIFICADO_ACTIVO' : 'SOLO_UNIFI_NO_AD';
    mergedAssets.push(crearActivoDesdeCruce(unifi, ad, baseline, status, usedBoxIds, state.currentFloor));
  });

  state.adCsvRows.forEach(ad => {
    if (matchedAdRows.has(ad)) return;
    const ip = csvValue(ad, 'IP_Registrada_AD') !== 'N/D'
      ? csvValue(ad, 'IP_Registrada_AD')
      : csvValue(ad, 'IP_Resuelta_DNS');
    const baseline = buscarActivoBase(ip, csvValue(ad, 'Hostname_Actual'), state);
    const status = ambiguousAdRows.has(ad) ? 'AMBIGUO' : 'SOLO_AD_INACTIVO';
    mergedAssets.push(crearActivoDesdeCruce(null, ad, baseline, status, usedBoxIds, state.currentFloor));
  });

  state.activosData = mergedAssets;
  state.currentMergePage = 0;

  if (callbacks.onSaveAll) callbacks.onSaveAll(mergedAssets);

  renderMergeTable(state, callbacks);
  populateOsFilterDropdown(state);
  if (callbacks.onRefresh) callbacks.onRefresh();
  renderFloorplanHotspots(state, (id) => callbacks.selectHotspot(id, state, callbacks));

  const summary = `Cruce completado: ${mergedAssets.length} registros.`;
  actualizarEstadoCruce(state.mergeAmbiguities.length
    ? `${summary} Ambigüedades: ${state.mergeAmbiguities.join('; ')}`
    : `${summary} Sin ambigüedades.`);
}
