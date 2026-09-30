/**
 * @file app.js
 * Main Application Orchestrator & Frontend Entry Point (ES Modules).
 * Coordinates state, integrates the Asset Repository service, and wires modules.
 */

import { CONFIG, MAP_IMAGES } from './config.js';
import { assetRepository, logOperationalEvent } from './services/assetRepository.js';
import {
  renderFloorplanHotspots,
  selectHotspot,
  changeFloor,
  updateSidebarPanel,
  saveActivePanelChanges,
  addNewHotspot,
  deleteSelectedHotspot,
  toggleCalibrationMode,
  manejarTecladoCalibracion,
  selectAndGoToMap,
  activoEnPlano
} from './modules/map.js';
import {
  renderMergeTable,
  programarRenderMergeTable,
  resetearPaginaMerge,
  cambiarPaginaMerge,
  sortTable,
  populateOsFilterDropdown,
  handleCsvUpload,
  reintentarCargaCsv,
  confirmarAplicarCruce,
  ejecutarCruceCSV
} from './modules/table.js';
import {
  openPs1Modal,
  closePs1Modal,
  downloadPs1Script
} from './modules/powershell.js';

/**
 * Global reactive Application State
 */
export const state = {
  activosData: [],
  currentFloor: "Piso 5",
  selectedBoxId: null,
  isCalibrationMode: false,
  unifiCsvRows: null,
  adCsvRows: null,
  mergeAmbiguities: [],
  currentMergePage: 0,
  currentSortColumn: 'box_id',
  isSortAsc: true,
  isAppLoading: false,
  isCrossProcessing: false
};

/**
 * Shared callbacks bundle for loose coupling between modules and repository
 */
export const callbacks = {
  repository: assetRepository,
  onSave: async (asset) => {
    state.activosData = await assetRepository.saveAsset(asset, state.activosData);
    updateJsonPreview();
  },
  onDelete: async (boxId) => {
    state.activosData = await assetRepository.deleteAsset(boxId, state.activosData);
    updateJsonPreview();
  },
  onSaveAll: async (assets) => {
    await assetRepository.saveAll(assets);
    updateJsonPreview();
  },
  onRefresh: () => {
    updateJsonPreview();
  },
  switchTab: (tabName) => switchTab(tabName),
  selectHotspot: (boxId) => selectHotspot(boxId, state, callbacks),
  renderTable: () => renderMergeTable(state, callbacks),
  renderMap: () => renderFloorplanHotspots(state, (id) => selectHotspot(id, state, callbacks))
};

/**
 * Switches the primary view tab (plano / merge / json).
 * @param {'plano'|'merge'|'json'} tabName
 */
export function switchTab(tabName) {
  const viewPlano = document.getElementById('view-plano');
  const viewMerge = document.getElementById('view-merge');
  const viewJson = document.getElementById('view-json');

  if (viewPlano) viewPlano.classList.add('hidden');
  if (viewMerge) viewMerge.classList.add('hidden');
  if (viewJson) viewJson.classList.add('hidden');

  const tabPlanoBtn = document.getElementById('tab-plano-btn');
  const tabMergeBtn = document.getElementById('tab-merge-btn');
  const tabJsonBtn = document.getElementById('tab-json-btn');

  const inactiveClass = "px-4 py-1.5 rounded-md text-xs font-medium text-slate-400 hover:text-slate-200 transition-all";
  const activeClass = "px-4 py-1.5 rounded-md text-xs font-medium bg-cyan-600 text-white shadow-sm transition-all";

  if (tabPlanoBtn) tabPlanoBtn.className = inactiveClass;
  if (tabMergeBtn) tabMergeBtn.className = inactiveClass;
  if (tabJsonBtn) tabJsonBtn.className = inactiveClass;

  if (tabName === 'plano') {
    if (viewPlano) viewPlano.classList.remove('hidden');
    if (tabPlanoBtn) tabPlanoBtn.className = activeClass;
    renderFloorplanHotspots(state, (id) => selectHotspot(id, state, callbacks));
  } else if (tabName === 'merge') {
    if (viewMerge) viewMerge.classList.remove('hidden');
    if (tabMergeBtn) tabMergeBtn.className = activeClass;
    renderMergeTable(state, callbacks);
  } else if (tabName === 'json') {
    if (viewJson) viewJson.classList.remove('hidden');
    if (tabJsonBtn) tabJsonBtn.className = activeClass;
    updateJsonPreview();
  }
}

/**
 * Synchronizes the JSON manager preview code block.
 */
export function updateJsonPreview() {
  const codeBlock = document.getElementById('json-preview-code');
  if (codeBlock) {
    codeBlock.textContent = JSON.stringify(state.activosData, null, 2);
  }
}

/**
 * Copies canonical JSON data to the system clipboard.
 */
export function copyJsonToClipboard() {
  const jsonStr = JSON.stringify(state.activosData, null, 2);
  const textArea = document.createElement('textarea');
  textArea.value = jsonStr;
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
  alert('¡JSON copiado al portapapeles!');
}

/**
 * Downloads canonical JSON data as a local file.
 */
export function downloadJsonFile() {
  const jsonStr = JSON.stringify(state.activosData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'activos_mapeados.json';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Initializes the application, fetching data via AssetRepository and setting up UI.
 */
export async function initializeApp() {
  if (state.isAppLoading) return;
  state.isAppLoading = true;

  const loadingPanel = document.getElementById('app-load-status');
  const errorPanel = document.getElementById('app-load-error');
  const retryButton = document.getElementById('app-load-retry');
  const loadingMessage = document.getElementById('app-load-message');
  const spinner = loadingPanel?.querySelector('.loading-spinner');
  const startedAt = performance.now();

  if (retryButton) retryButton.disabled = true;
  if (errorPanel) errorPanel.classList.add('hidden');
  if (loadingPanel) loadingPanel.classList.remove('hidden');
  if (spinner) spinner.classList.remove('hidden');
  if (loadingMessage) loadingMessage.textContent = 'Cargando activos…';

  try {
    const data = await assetRepository.getAssets();
    state.activosData = data;

    changeFloor(state.currentFloor, state, callbacks);
    renderMergeTable(state, callbacks);
    updateJsonPreview();
    populateOsFilterDropdown(state);

    if (spinner) spinner.classList.add('hidden');
    if (loadingMessage) loadingMessage.textContent = `${data.length} activos cargados.`;

    logOperationalEvent('assets.load.success', {
      recordCount: data.length,
      durationMs: Math.round(performance.now() - startedAt)
    });

    window.setTimeout(() => {
      if (loadingPanel) loadingPanel.classList.add('hidden');
    }, 2400);
  } catch (error) {
    if (loadingPanel) loadingPanel.classList.add('hidden');
    const errMsg = document.getElementById('app-load-error-message');
    if (errMsg) {
      errMsg.textContent = `No se pudieron cargar los activos. Verificá data/activos_mapeados.json y que el proyecto se sirva por HTTP(S). ${error.message}`;
    }
    if (errorPanel) errorPanel.classList.remove('hidden');
    logOperationalEvent('assets.load.error', { errorType: error.name || 'Error' });
  } finally {
    state.isAppLoading = false;
    if (retryButton) retryButton.disabled = false;
  }
}

// Window Event Listeners
window.addEventListener('load', initializeApp);
document.addEventListener('keydown', (e) => manejarTecladoCalibracion(e, state, callbacks));

/**
 * Expose methods on window to preserve complete backward compatibility with HTML onclick/onchange attributes
 */
window.switchTab = switchTab;
window.changeFloor = (floor) => changeFloor(floor, state, callbacks);
window.addNewHotspot = () => addNewHotspot(state, callbacks);
window.deleteSelectedHotspot = () => deleteSelectedHotspot(state, callbacks);
window.toggleCalibrationMode = (enabled) => toggleCalibrationMode(enabled, state, callbacks);
window.saveActivePanelChanges = () => saveActivePanelChanges(state, callbacks);
window.handleCsvUpload = (event, type) => handleCsvUpload(event, type, state, callbacks);
window.reintentarCargaCsv = (type) => reintentarCargaCsv(type, state, callbacks);
window.confirmarAplicarCruce = () => confirmarAplicarCruce(state, callbacks);
window.programarRenderMergeTable = () => programarRenderMergeTable(state, callbacks);
window.resetearPaginaMerge = () => resetearPaginaMerge(state, callbacks);
window.cambiarPaginaMerge = (delta) => cambiarPaginaMerge(delta, state, callbacks);
window.sortTable = (key) => sortTable(key, state, callbacks);
window.openPs1Modal = () => openPs1Modal(state.activosData);
window.closePs1Modal = closePs1Modal;
window.downloadPs1Script = downloadPs1Script;
window.copyJsonToClipboard = copyJsonToClipboard;
window.downloadJsonFile = downloadJsonFile;
window.initializeApp = initializeApp;
window.activoEnPlano = activoEnPlano;
/** Backwards-compat stub: scrolls the sidebar edit panel into view when a hotspot is selected. */
window.toggleEditModal = () => {
  const panel = document.getElementById('sidebar-panel') || document.getElementById('edit-panel') || document.querySelector('[data-edit-panel]');
  if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
