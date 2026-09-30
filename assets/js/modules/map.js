/**
 * @file map.js
 * Interactive Floorplan, Hotspot Rendering, Spatial Drag & Drop and Calibration Module.
 * Strictly adheres to P0-P3 security requirements:
 * - DOM construction via document.createElement and textContent (no innerHTML injection)
 * - Safe geometry constraints (0 <= top, left, width, height <= 100)
 * - Dynamic Floor Switching supporting "Piso 5" and "Piso 17"
 */

import { MAP_IMAGES } from '../config.js';
import { validGeometry, logOperationalEvent } from '../services/assetRepository.js';
import { isValidHostname } from './powershell.js';

/**
 * Determines whether an asset is assigned to the interactive floor plan.
 * @param {Object} row
 * @returns {boolean}
 */
export function activoEnPlano(row) {
  if (!row) return false;
  if (row.en_plano === true) return true;
  if (row.en_plano === false) return false;
  return typeof row.box_id === 'string' && /^BOX-\d+/i.test(row.box_id);
}

/**
 * Renders hotspots for the currently selected floor on the map.
 * @param {Object} state
 * @param {Function} onSelect
 */
export function renderFloorplanHotspots(state, onSelect) {
  const container = document.getElementById('hotspot-layer');
  if (!container) return;
  container.replaceChildren();

  const floorAssets = state.activosData.filter(asset => `Piso ${asset.piso}` === state.currentFloor && activoEnPlano(asset));
  const totalFloorCountElem = document.getElementById('total-floor-boxes');
  if (totalFloorCountElem) totalFloorCountElem.textContent = floorAssets.length;

  const fragment = document.createDocumentFragment();

  floorAssets.forEach(asset => {
    const hotspot = document.createElement('div');

    let statusClass = 'status-active';
    if (asset.status === 'SOLO_UNIFI_NO_AD') statusClass = 'status-warning';
    if (asset.status === 'SOLO_AD_INACTIVO') statusClass = 'status-danger';
    if (asset.status === 'BORRADOR') statusClass = 'status-draft';

    const isSelected = asset.box_id === state.selectedBoxId;

    hotspot.className = `box-hotspot ${statusClass} ${isSelected ? 'selected' : ''}`;
    hotspot.style.top = `${asset.top_pct}%`;
    hotspot.style.left = `${asset.left_pct}%`;
    hotspot.style.width = `${asset.width_pct}%`;
    hotspot.style.height = `${asset.height_pct}%`;
    hotspot.dataset.boxId = asset.box_id;
    hotspot.title = `${asset.box_id} - ${asset.hostname_actual || 'N/D'}`;
    hotspot.textContent = asset.box_id.replace('BOX-', '');
    hotspot.tabIndex = 0;
    hotspot.setAttribute('aria-label', `${asset.box_id}, ${asset.status}`);

    // Calibration resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    hotspot.appendChild(resizeHandle);

    // Click listener
    hotspot.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof onSelect === 'function') {
        onSelect(asset.box_id);
      }
    });

    if (state.isCalibrationMode) {
      makeElementDraggableAndResizable(hotspot, asset, state, () => {
        if (typeof onSelect === 'function') onSelect(state.selectedBoxId);
      });
    }

    fragment.appendChild(hotspot);
  });

  container.appendChild(fragment);
}

/**
 * Selects a hotspot on the plan and synchronizes the sidebar and controls.
 * @param {string|null} boxId
 * @param {Object} state
 * @param {Object} callbacks
 */
export function selectHotspot(boxId, state, callbacks = {}) {
  state.selectedBoxId = boxId;
  const nameElem = document.getElementById('selected-box-name');
  if (nameElem) nameElem.textContent = boxId || 'Ninguno';

  const btnEdit = document.getElementById('btn-edit-selected');
  const btnDel = document.getElementById('btn-delete-selected');
  if (btnEdit) btnEdit.disabled = !boxId;
  if (btnDel) btnDel.disabled = !boxId;

  renderFloorplanHotspots(state, (id) => selectHotspot(id, state, callbacks));
  updateSidebarPanel(state);
}

/**
 * Updates the details form in the sidebar with the active asset data.
 * @param {Object} state
 */
export function updateSidebarPanel(state) {
  const emptyPanel = document.getElementById('panel-empty');
  const detailsPanel = document.getElementById('panel-details');
  const badge = document.getElementById('detail-status-badge');

  if (!state.selectedBoxId) {
    if (emptyPanel) emptyPanel.classList.remove('hidden');
    if (detailsPanel) detailsPanel.classList.add('hidden');
    if (badge) {
      badge.textContent = 'SIN SELECCIÓN';
      badge.className = 'px-2 py-0.5 text-[10px] rounded font-bold bg-slate-800 text-slate-400';
    }
    return;
  }

  const asset = state.activosData.find(item => item.box_id === state.selectedBoxId);
  if (!asset) return;

  if (emptyPanel) emptyPanel.classList.add('hidden');
  if (detailsPanel) detailsPanel.classList.remove('hidden');

  document.getElementById('edit-box-id').value = asset.box_id;
  document.getElementById('edit-hostname').value = asset.hostname_actual || '';
  document.getElementById('edit-new-hostname').value = asset.hostname_propuesto || '';
  document.getElementById('edit-ip').value = asset.ip_address || '';
  document.getElementById('edit-mac').value = asset.mac_address || '';
  document.getElementById('edit-port').value = asset.switch_connection || '';
  document.getElementById('edit-os').value = asset.operating_system || 'N/D';

  document.getElementById('edit-top').value = asset.top_pct;
  document.getElementById('edit-left').value = asset.left_pct;
  document.getElementById('edit-width').value = asset.width_pct;
  document.getElementById('edit-height').value = asset.height_pct;

  if (badge) {
    badge.textContent = asset.status;
    if (asset.status === 'VERIFICADO_ACTIVO') {
      badge.className = 'px-2 py-0.5 text-[10px] rounded font-bold bg-emerald-950 text-emerald-400 border border-emerald-800';
    } else if (asset.status === 'SOLO_UNIFI_NO_AD') {
      badge.className = 'px-2 py-0.5 text-[10px] rounded font-bold bg-amber-950 text-amber-400 border border-amber-800';
    } else if (asset.status === 'BORRADOR') {
      badge.className = 'px-2 py-0.5 text-[10px] rounded font-bold bg-slate-800 text-slate-300 border border-slate-600';
    } else {
      badge.className = 'px-2 py-0.5 text-[10px] rounded font-bold bg-rose-950 text-rose-400 border border-rose-800';
    }
  }
}

function readCoordinateInput(id) {
  const value = document.getElementById(id).value.trim();
  return value === '' ? Number.NaN : Number(value);
}

/**
 * Saves modifications made in the right sidebar panel.
 * @param {Object} state
 * @param {Object} callbacks
 */
export async function saveActivePanelChanges(state, callbacks = {}) {
  if (!state.selectedBoxId) return;
  const asset = state.activosData.find(item => item.box_id === state.selectedBoxId);
  if (!asset) return;

  const hostname = document.getElementById('edit-hostname').value.trim();
  const proposedHostname = document.getElementById('edit-new-hostname').value.trim();
  const isDraft = asset.status === 'BORRADOR';
  if ((!isValidHostname(hostname) && !(isDraft && hostname === 'N/D'))
    || (!isValidHostname(proposedHostname) && !(isDraft && proposedHostname === 'N/D'))) {
    alert('Los hostnames deben tener hasta 15 caracteres alfanuméricos o guiones, sin guion al inicio o al final.');
    return;
  }

  const boxId = document.getElementById('edit-box-id').value.trim();
  if (!boxId || state.activosData.some(item => item !== asset && item.box_id === boxId)) {
    alert('El identificador del box no puede estar vacío ni duplicado.');
    return;
  }

  const top = readCoordinateInput('edit-top');
  const left = readCoordinateInput('edit-left');
  const width = readCoordinateInput('edit-width');
  const height = readCoordinateInput('edit-height');
  if (!validGeometry(top, left, width, height)) {
    alert('Coordenadas inválidas: top/left deben estar entre 0 y 100 y el box debe quedar dentro del plano.');
    return;
  }

  asset.box_id = boxId;
  asset.hostname_actual = hostname;
  asset.hostname_propuesto = proposedHostname;
  asset.ip_address = document.getElementById('edit-ip').value.trim();
  asset.mac_address = document.getElementById('edit-mac').value.trim();
  asset.switch_connection = document.getElementById('edit-port').value.trim();
  asset.operating_system = document.getElementById('edit-os').value || 'N/D';
  asset.top_pct = top;
  asset.left_pct = left;
  asset.width_pct = width;
  asset.height_pct = height;
  asset.en_plano = true;

  state.selectedBoxId = asset.box_id;

  if (callbacks.onSave) await callbacks.onSave(asset);
  renderFloorplanHotspots(state, (id) => selectHotspot(id, state, callbacks));
  if (callbacks.onRefresh) callbacks.onRefresh();
}

/**
 * Creates a new draft box hotspot on the current floor.
 * @param {Object} state
 * @param {Object} callbacks
 */
export async function addNewHotspot(state, callbacks = {}) {
  const usedBoxIds = new Set(state.activosData.map(asset => asset.box_id));
  const existingNumbers = state.activosData
    .map(asset => /^BOX-(\d+)$/i.exec(asset.box_id))
    .filter(Boolean)
    .map(match => Number(match[1]));
  let nextIndex = Math.max(0, ...existingNumbers) + 1;
  while (usedBoxIds.has(`BOX-${nextIndex}`)) nextIndex += 1;

  const newBox = {
    box_id: `BOX-${nextIndex}`,
    piso: Number(state.currentFloor.replace('Piso ', '')),
    top_pct: 40.0,
    left_pct: 40.0,
    width_pct: 3.5,
    height_pct: 4.2,
    ip_address: 'N/D',
    mac_address: 'N/D',
    hostname_actual: 'N/D',
    hostname_propuesto: 'N/D',
    switch_connection: 'N/D',
    operating_system: 'N/D',
    status: 'BORRADOR',
    en_plano: true
  };

  state.activosData.push(newBox);
  if (callbacks.onSave) await callbacks.onSave(newBox);
  selectHotspot(newBox.box_id, state, callbacks);
  if (callbacks.onRefresh) callbacks.onRefresh();
}

/**
 * Deletes the currently selected hotspot.
 * @param {Object} state
 * @param {Object} callbacks
 */
export async function deleteSelectedHotspot(state, callbacks = {}) {
  if (!state.selectedBoxId) return;
  const asset = state.activosData.find(item => item.box_id === state.selectedBoxId);
  if (!asset || !window.confirm(`¿Eliminar el activo ${asset.box_id} del plano? Esta acción solo afecta el estado local hasta exportar el JSON.`)) {
    logOperationalEvent('asset.delete.cancelled');
    return;
  }

  state.activosData = state.activosData.filter(item => item.box_id !== state.selectedBoxId);
  const deletedId = state.selectedBoxId;
  state.selectedBoxId = null;

  if (callbacks.onDelete) await callbacks.onDelete(deletedId);
  selectHotspot(null, state, callbacks);
  if (callbacks.onRefresh) callbacks.onRefresh();
  logOperationalEvent('asset.delete.confirmed', { recordCount: state.activosData.length });
}

/**
 * Switches the displayed floor image and coordinates.
 * @param {string} floorName
 * @param {Object} state
 * @param {Object} callbacks
 */
export function changeFloor(floorName, state, callbacks = {}) {
  state.currentFloor = floorName;
  state.selectedBoxId = null;
  updateSidebarPanel(state);

  const floorNumber = /^Piso (\d+)$/.exec(floorName)?.[1] || '';
  const imagePath = MAP_IMAGES[floorNumber];
  const image = document.getElementById('map-image');
  const imageStatus = document.getElementById('map-image-status');

  if (!imagePath) {
    if (image) {
      image.removeAttribute('src');
      image.classList.add('hidden');
    }
    if (imageStatus) {
      imageStatus.textContent = `No hay un plano configurado para ${floorName || 'este piso'}.`;
      imageStatus.classList.remove('hidden');
    }
    renderFloorplanHotspots(state, (id) => selectHotspot(id, state, callbacks));
    return;
  }

  if (image && imageStatus) {
    image.alt = `Plano real del Piso ${floorNumber}`;
    image.onerror = () => {
      image.classList.add('hidden');
      imageStatus.textContent = `No se pudo cargar el plano del Piso ${floorNumber}. Verificá ${imagePath}.`;
      imageStatus.classList.remove('hidden');
    };
    image.onload = () => imageStatus.classList.add('hidden');
    imageStatus.classList.add('hidden');
    image.classList.remove('hidden');
    image.src = imagePath;
  }

  const floorSelect = document.getElementById('floor-select');
  if (floorSelect && floorSelect.value !== floorName) {
    floorSelect.value = floorName;
  }

  renderFloorplanHotspots(state, (id) => selectHotspot(id, state, callbacks));
}

/**
 * Toggles physical calibration drag-and-drop mode.
 * @param {boolean} enabled
 * @param {Object} state
 * @param {Object} callbacks
 */
export function toggleCalibrationMode(enabled, state, callbacks = {}) {
  state.isCalibrationMode = enabled;
  const wrapper = document.getElementById('floorplan-wrapper');
  if (wrapper) {
    if (enabled) wrapper.classList.add('calibration-active');
    else wrapper.classList.remove('calibration-active');
  }
  renderFloorplanHotspots(state, (id) => selectHotspot(id, state, callbacks));
}

/**
 * Configures pointer events for drag and resize in calibration mode.
 */
export function makeElementDraggableAndResizable(elmnt, asset, state, onFinish) {
  const parent = document.getElementById('hotspot-layer');
  let activePointerId = null;
  let dragMode = 'move';
  let startX = 0;
  let startY = 0;
  let startTop = 0;
  let startLeft = 0;
  let startWidth = 0;
  let startHeight = 0;

  elmnt.addEventListener('pointerdown', startPointer);
  elmnt.addEventListener('pointermove', movePointer);
  elmnt.addEventListener('pointerup', finishPointer);
  elmnt.addEventListener('pointercancel', finishPointer);

  function startPointer(event) {
    if (!state.isCalibrationMode || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    event.stopPropagation();
    activePointerId = event.pointerId;
    dragMode = event.target.classList.contains('resize-handle') ? 'resize' : 'move';
    startX = event.clientX;
    startY = event.clientY;
    startTop = asset.top_pct;
    startLeft = asset.left_pct;
    startWidth = asset.width_pct;
    startHeight = asset.height_pct;
    elmnt.setPointerCapture(activePointerId);
  }

  function movePointer(event) {
    if (activePointerId !== event.pointerId) return;
    event.preventDefault();
    const parentRect = parent.getBoundingClientRect();
    if (!parentRect.width || !parentRect.height) return;
    const deltaX = ((event.clientX - startX) / parentRect.width) * 100;
    const deltaY = ((event.clientY - startY) / parentRect.height) * 100;

    if (dragMode === 'move') {
      asset.top_pct = Number(Math.min(Math.max(startTop + deltaY, 0), 100 - asset.height_pct).toFixed(2));
      asset.left_pct = Number(Math.min(Math.max(startLeft + deltaX, 0), 100 - asset.width_pct).toFixed(2));
      elmnt.style.top = `${asset.top_pct}%`;
      elmnt.style.left = `${asset.left_pct}%`;
    } else {
      const maximumWidth = 100 - asset.left_pct;
      const maximumHeight = 100 - asset.top_pct;
      asset.width_pct = Number(Math.min(Math.max(startWidth + deltaX, Math.min(1.5, maximumWidth)), maximumWidth).toFixed(2));
      asset.height_pct = Number(Math.min(Math.max(startHeight + deltaY, Math.min(1.5, maximumHeight)), maximumHeight).toFixed(2));
      elmnt.style.width = `${asset.width_pct}%`;
      elmnt.style.height = `${asset.height_pct}%`;
    }

    if (asset.box_id === state.selectedBoxId) updateSidebarPanel(state);
  }

  function finishPointer(event) {
    if (activePointerId !== event.pointerId) return;
    activePointerId = null;
    if (typeof onFinish === 'function') onFinish();
  }
}

/**
 * Keyboard hotkeys handler for fine-grained calibration.
 */
export function manejarTecladoCalibracion(event, state, callbacks = {}) {
  const activeElement = document.activeElement;
  if (event.key.toLowerCase() === 'c'
    && !['INPUT', 'SELECT', 'TEXTAREA'].includes(activeElement?.tagName)) {
    const toggle = document.getElementById('calibration-toggle');
    if (toggle) {
      toggle.checked = !toggle.checked;
      toggleCalibrationMode(toggle.checked, state, callbacks);
    }
    return;
  }
  if (!state.isCalibrationMode || !activeElement?.classList.contains('box-hotspot')) return;

  const movement = event.shiftKey ? 1 : 0.1;
  const deltas = {
    ArrowUp: [-movement, 0],
    ArrowDown: [movement, 0],
    ArrowLeft: [0, -movement],
    ArrowRight: [0, movement]
  }[event.key];
  if (!deltas) return;

  const asset = state.activosData.find(item => item.box_id === activeElement.dataset.boxId);
  if (!asset) return;
  event.preventDefault();
  asset.top_pct = Number(Math.min(Math.max(asset.top_pct + deltas[0], 0), 100 - asset.height_pct).toFixed(2));
  asset.left_pct = Number(Math.min(Math.max(asset.left_pct + deltas[1], 0), 100 - asset.width_pct).toFixed(2));
  activeElement.style.top = `${asset.top_pct}%`;
  activeElement.style.left = `${asset.left_pct}%`;
  if (asset.box_id === state.selectedBoxId) updateSidebarPanel(state);
  if (callbacks.onRefresh) callbacks.onRefresh();
}

/**
 * Navigates directly to the floorplan and focuses/selects an asset.
 * @param {string} boxId
 * @param {Object} state
 * @param {Object} callbacks
 */
export function selectAndGoToMap(boxId, state, callbacks = {}) {
  const asset = state.activosData.find(item => item.box_id === boxId);
  if (asset) {
    changeFloor(`Piso ${asset.piso}`, state, callbacks);
    selectHotspot(asset.box_id, state, callbacks);
  }
  if (typeof callbacks.switchTab === 'function') {
    callbacks.switchTab('plano');
  }
}
