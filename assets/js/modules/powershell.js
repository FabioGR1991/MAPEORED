/**
 * @file powershell.js
 * NetBIOS Hostname Validation, Sanitization and PowerShell Script Generator (.ps1).
 * Strictly enforces P0-P2 security requirements:
 * - NetBIOS RFC compliance validation
 * - PowerShell literal escaping to prevent command injection
 * - -WhatIf safety switch by default (no automatic reboots)
 */

import { logOperationalEvent } from '../services/assetRepository.js';

/**
 * Validates NetBIOS hostname strictly: 1-15 chars, alphanumeric or hyphens,
 * no leading or trailing hyphen.
 * @param {string} hostname
 * @returns {boolean}
 */
export function isValidHostname(hostname) {
  return typeof hostname === 'string'
    && hostname.length >= 1
    && hostname.length <= 15
    && /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,13}[A-Za-z0-9])?$/.test(hostname);
}

/**
 * Safely wraps and escapes values into single-quoted PowerShell string literals.
 * @param {*} value
 * @returns {string}
 */
export function toPowerShellLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Generates and displays the PowerShell script modal.
 * @param {Array} activosData
 */
export function openPs1Modal(activosData) {
  const modal = document.getElementById('modal-ps1');
  const ps1Preview = document.getElementById('ps1-code-preview');
  const pendingChanges = activosData.filter(asset =>
    asset.status !== 'BORRADOR'
      && asset.hostname_actual
      && asset.hostname_propuesto
      && asset.hostname_actual !== asset.hostname_propuesto
  );

  if (pendingChanges.length === 0) {
    alert('No hay cambios pendientes para generar el script.');
    return;
  }
  if (pendingChanges.some(asset =>
    !isValidHostname(asset.hostname_actual) || !isValidHostname(asset.hostname_propuesto)
  )) {
    alert('No se generó el script: hay hostnames inválidos.');
    return;
  }
  document.getElementById('ps1-script-scope').textContent = `Alcance: ${pendingChanges.length} cambios de hostname. Modo -WhatIf; sin cambios aplicados.`;

  let script = `# ========================================================\n`;
  script += `# SCRIPT DE RENOMBRADO AUTOMÁTICO EN ACTIVE DIRECTORY\n`;
  script += `# Generado el: ${new Date().toLocaleString()}\n`;
  script += `# ========================================================\n\n`;

  pendingChanges.forEach(asset => {
    script += `Rename-Computer -ComputerName ${toPowerShellLiteral(asset.hostname_actual)} -NewName ${toPowerShellLiteral(asset.hostname_propuesto)} -DomainCredential (Get-Credential) -Force -WhatIf\n`;
  });

  ps1Preview.textContent = script;
  modal.classList.remove('hidden');
  logOperationalEvent('powershell.preview.generated', { changeCount: pendingChanges.length });
}

/**
 * Closes the PowerShell modal.
 */
export function closePs1Modal() {
  const modal = document.getElementById('modal-ps1');
  if (modal) modal.classList.add('hidden');
}

/**
 * Downloads the generated .ps1 script file safely via Blob.
 */
export function downloadPs1Script() {
  const ps1Text = document.getElementById('ps1-code-preview').textContent || '';
  logOperationalEvent('powershell.preview.downloaded', {
    changeCount: (ps1Text.match(/Rename-Computer/g) || []).length
  });
  const blob = new Blob([ps1Text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'rename_activos.ps1';
  a.click();
  URL.revokeObjectURL(url);
  closePs1Modal();
}
