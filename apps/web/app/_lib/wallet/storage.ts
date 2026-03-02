export const MANUAL_DISCONNECT_STORAGE_KEY = 'dexera.wallet.manual_disconnect';

function hasStorageAccess(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function isManuallyDisconnected(): boolean {
  if (!hasStorageAccess()) {
    return false;
  }

  return window.localStorage.getItem(MANUAL_DISCONNECT_STORAGE_KEY) === 'true';
}

export function setManualDisconnect(value: boolean): void {
  if (!hasStorageAccess()) {
    return;
  }

  if (value) {
    window.localStorage.setItem(MANUAL_DISCONNECT_STORAGE_KEY, 'true');
    return;
  }

  window.localStorage.removeItem(MANUAL_DISCONNECT_STORAGE_KEY);
}
