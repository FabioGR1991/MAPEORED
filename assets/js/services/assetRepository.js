/**
 * @file assetRepository.js
 * Data Abstraction Layer (Repository / API Client Pattern) for MAPEORED.
 * Prepares the application for future integration with Backend / Database (SQL/NoSQL)
 * and credential authentication, while maintaining local persistence and data validation.
 */

import { CONFIG } from '../config.js';

/**
 * Validates that the loaded asset dataset satisfies the strict schema.
 * @param {Array} data
 * @returns {boolean}
 */
export function validarActivosData(data) {
  if (!Array.isArray(data)) return false;
  const boxIds = new Set();
  const statuses = new Set(['VERIFICADO_ACTIVO', 'SOLO_UNIFI_NO_AD', 'SOLO_AD_INACTIVO', 'AMBIGUO', 'BORRADOR']);
  const stringFields = ['box_id', 'ip_address', 'mac_address', 'hostname_actual', 'hostname_propuesto', 'switch_connection', 'status'];

  return data.every(asset => {
    if (!asset || typeof asset !== 'object'
      || stringFields.some(field => typeof asset[field] !== 'string' || !asset[field].trim())
      || !statuses.has(asset.status)
      || ![5, 17].includes(asset.piso)
      || boxIds.has(asset.box_id)) return false;

    const coordinates = ['top_pct', 'left_pct', 'width_pct', 'height_pct'];
    if (coordinates.some(field => !Number.isFinite(asset[field]) || asset[field] < 0 || asset[field] > 100)
      || asset.width_pct === 0 || asset.height_pct === 0
      || asset.top_pct + asset.height_pct > 100
      || asset.left_pct + asset.width_pct > 100) return false;

    boxIds.add(asset.box_id);
    return true;
  });
}

/**
 * Validates spatial coordinates and bounds.
 */
export function validGeometry(top, left, width, height) {
  return [top, left, width, height].every(value => Number.isFinite(value) && value >= 0 && value <= 100)
    && width > 0
    && height > 0
    && top + height <= 100
    && left + width <= 100;
}

/**
 * Safe operational telemetry logger.
 */
export function logOperationalEvent(eventName, attributes = {}) {
  const safeFields = new Set(['source', 'recordCount', 'changeCount', 'durationMs', 'errorType']);
  const safeAttributes = {};
  Object.entries(attributes).forEach(([key, value]) => {
    if (!safeFields.has(key)) return;
    if (key === 'source' && !['unifi', 'ad'].includes(value)) return;
    if (key === 'errorType' && (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9]*$/.test(value))) return;
    if (!['source', 'errorType'].includes(key) && (typeof value !== 'number' || !Number.isFinite(value))) return;
    safeAttributes[key] = value;
  });
  const entry = JSON.stringify({ component: 'MAPEORED', event: eventName, ...safeAttributes });
  if (eventName.endsWith('.error')) console.warn(entry);
  else console.info(entry);
}

/**
 * Normalizes strings for case-insensitive matching.
 */
export function normalizarValor(value) {
  return String(value || '').trim().toLowerCase();
}

/**
 * Normalizes CSV headers.
 */
export function normalizarHeaderCsv(header) {
  return String(header || '')
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\u2060\u00A0]/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Detects CSV delimiter (, ; or tab).
 */
export function detectarDelimitadorCsv(text) {
  const firstLine = text.split(/\r?\n/).find(line => line.trim()) || '';
  return [',', ';', '\t'].reduce((best, candidate) => {
    const count = firstLine.split(candidate).length - 1;
    return count > best.count ? { delimiter: candidate, count } : best;
  }, { delimiter: ',', count: 0 }).delimiter;
}

/**
 * Parses CSV text content into structured objects with strict row count and quote balancing limits.
 */
export function parseCsvRows(text) {
  const cleanText = String(text || '').replace(/^\uFEFF/, '');
  const delimiter = detectarDelimitadorCsv(cleanText);
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < cleanText.length; index += 1) {
    const character = cleanText[index];
    const nextCharacter = cleanText[index + 1];
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
      if (row.some(value => value !== '')) {
        rows.push(row);
        if (rows.length > CONFIG.MAX_CSV_ROWS + 1) throw new Error(`el CSV supera el límite de ${CONFIG.MAX_CSV_ROWS} filas.`);
      }
      row = [];
      field = '';
    } else {
      field += character;
    }
  }
  if (field || row.length) {
    row.push(field.trim());
    if (row.some(value => value !== '')) {
      rows.push(row);
      if (rows.length > CONFIG.MAX_CSV_ROWS + 1) throw new Error(`el CSV supera el límite de ${CONFIG.MAX_CSV_ROWS} filas.`);
    }
  }
  if (quoted) throw new Error('hay un campo entrecomillado sin cerrar.');
  if (rows.length < 2) throw new Error('el CSV no contiene filas de datos.');

  const headers = rows.shift().map(normalizarHeaderCsv);
  if (headers.some(header => !header) || new Set(headers).size !== headers.length) {
    throw new Error('los encabezados están vacíos o duplicados.');
  }
  return rows.map((values, rowIndex) => {
    if (values.length !== headers.length) throw new Error(`la fila ${rowIndex + 2} tiene un número de columnas inválido.`);
    return headers.reduce((record, header, index) => {
      record[header] = values[index] && values[index].trim() ? values[index].trim() : 'N/D';
      return record;
    }, {});
  });
}

/**
 * Validates mandatory columns for UniFi or Active Directory CSV sources.
 */
export function validarColumnasCsv(rows, source) {
  if (!rows.length) throw new Error('el CSV no contiene filas de datos.');
  const headers = new Set(Object.keys(rows[0]));
  const required = source === 'unifi'
    ? ['name', 'ip address', 'mac address', 'connection']
    : ['hostname_actual'];
  const missing = required.filter(header => !headers.has(normalizarHeaderCsv(header)));
  if (missing.length) throw new Error(`faltan columnas requeridas: ${missing.join(', ')}.`);
  if (source === 'ad' && !headers.has('ip_registrada_ad') && !headers.has('ip_resuelta_dns')) {
    throw new Error('Active Directory requiere IP_Registrada_AD o IP_Resuelta_DNS.');
  }
}

/**
 * AssetRepository Class: Decouples persistence and provides an API-Client contract.
 */
export class AssetRepository {
  constructor(config = CONFIG) {
    this.config = config;
    this.authToken = null;
  }

  /**
   * Configures bearer token for future authenticated backend requests.
   * @param {string|null} token
   */
  setAuthToken(token) {
    this.authToken = token;
  }

  /**
   * Generates authorization headers when authToken is present.
   */
  getHeaders() {
    const headers = { 'Accept': 'application/json' };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    return headers;
  }

  /**
   * Asynchronously retrieves assets, prioritizing local modifications or fetching canonical JSON.
   * @returns {Promise<Array>}
   */
  async getAssets() {
    // Check localStorage cache first
    try {
      const cached = localStorage.getItem(this.config.STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (validarActivosData(parsed)) {
          return parsed;
        }
      }
    } catch {
      // Fallback to fetch on storage error
    }

    const response = await fetch(this.config.ENDPOINTS.ASSETS_JSON, {
      cache: 'no-store',
      headers: this.getHeaders()
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    if (!validarActivosData(data)) {
      throw new Error('El JSON no cumple el esquema de activos esperado.');
    }
    return data;
  }

  /**
   * Asynchronously persists the entire array of assets.
   * @param {Array} assets
   * @returns {Promise<boolean>}
   */
  async saveAll(assets) {
    if (!validarActivosData(assets)) {
      throw new Error('Los activos proporcionados no cumplen el esquema de validación.');
    }
    try {
      localStorage.setItem(this.config.STORAGE_KEY, JSON.stringify(assets));
      return true;
    } catch (e) {
      console.warn('No se pudo guardar en localStorage:', e);
      return false;
    }
  }

  /**
   * Asynchronously updates or creates a single asset.
   * @param {Object} updatedAsset
   * @param {Array} currentAssets
   * @returns {Promise<Array>}
   */
  async saveAsset(updatedAsset, currentAssets) {
    const index = currentAssets.findIndex(a => a.box_id === updatedAsset.box_id);
    let nextList;
    if (index >= 0) {
      nextList = [...currentAssets];
      nextList[index] = { ...updatedAsset };
    } else {
      nextList = [...currentAssets, { ...updatedAsset }];
    }
    await this.saveAll(nextList);
    return nextList;
  }

  /**
   * Asynchronously deletes an asset by box_id.
   * @param {string} boxId
   * @param {Array} currentAssets
   * @returns {Promise<Array>}
   */
  async deleteAsset(boxId, currentAssets) {
    const nextList = currentAssets.filter(a => a.box_id !== boxId);
    await this.saveAll(nextList);
    return nextList;
  }

  /**
   * Reads, checks file size, and parses CSV file as an async stream/promise.
   * @param {File} file
   * @param {'unifi'|'ad'} type
   * @returns {Promise<Array>}
   */
  async importCsv(file, type) {
    if (file.size > this.config.MAX_CSV_SIZE_BYTES) {
      throw new Error(`Archivo demasiado grande: máximo ${this.config.MAX_CSV_SIZE_BYTES / 1024 / 1024} MB.`);
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const rows = parseCsvRows(String(reader.result || ''));
          validarColumnasCsv(rows, type);
          resolve(rows);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Error de lectura en el archivo CSV.'));
      reader.onabort = () => reject(new Error('Lectura cancelada.'));
      reader.readAsText(file);
    });
  }
}

export const assetRepository = new AssetRepository();
