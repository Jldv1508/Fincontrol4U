// backup.js - Gestión de copias de seguridad locales y restauración

(function(){
  const LS_KEY_BACKUP = 'fincontrol_backup_latest';

  async function createBackup() {
    const data = await DB.exportData();
    const payload = {
      createdAt: new Date().toISOString(),
      version: 1,
      data
    };
    const json = JSON.stringify(payload);
    try { localStorage.setItem(LS_KEY_BACKUP, json); } catch(e) { console.warn('No se pudo guardar en localStorage', e); }
    return payload;
  }

  async function restoreBackup() {
    const raw = localStorage.getItem(LS_KEY_BACKUP);
    if (!raw) throw new Error('No hay copia local guardada');
    const payload = JSON.parse(raw);
    if (!payload || !payload.data) throw new Error('Copia local inválida');
    await DB.importData(payload.data);
    return true;
  }

  async function downloadBackup() {
    const payload = await createBackup();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fincontrol_backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function uploadBackupFile(file) {
    const text = await file.text();
    const payload = JSON.parse(text);
    if (!payload || !payload.data) throw new Error('Archivo de copia inválido');
    await DB.importData(payload.data);
    return true;
  }

  window.BackupManager = {
    createBackup,
    restoreBackup,
    downloadBackup,
    uploadBackupFile,
    getLocalBackupInfo() {
      try {
        const raw = localStorage.getItem(LS_KEY_BACKUP);
        if (!raw) return null;
        const payload = JSON.parse(raw);
        return { createdAt: payload.createdAt, size: raw.length };
      } catch(e) { return null; }
    }
  };
})();