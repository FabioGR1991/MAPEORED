/**
 * @file config.js
 * Centralized configuration constants for MAPEORED.
 */

export const MAP_IMAGES = {
  "5": "assets/images/PISO 5.jpg",
  "17": "assets/images/PISO 17.jpg"
};

export const CONFIG = {
  MAX_CSV_SIZE_BYTES: 10 * 1024 * 1024, // 10 MB
  MAX_CSV_ROWS: 50000,
  MERGE_PAGE_SIZE: 200,
  STORAGE_KEY: 'mapeored_activos_data',
  ENDPOINTS: {
    ASSETS_JSON: 'data/activos_mapeados.json',
    // Future backend endpoints (REST / GraphQL)
    API_BASE: '/api/v1',
    AUTH_LOGIN: '/api/v1/auth/login',
    REMOTE_ASSETS: '/api/v1/assets',
    AUDIT_LOGS: '/api/v1/audit'
  }
};
