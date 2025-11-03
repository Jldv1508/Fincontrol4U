/**
 * sync.js - Sincronización y respaldo de datos
 * Parte de la PWA de control financiero doméstico
 */

const SyncManager = {
    // Estado de sincronización
    status: {
        lastSync: null,
        inProgress: false,
        error: null
    },
    
    /**
     * Inicializa el sistema de sincronización
     */
    init: function() {
        // Comprobar si hay conexión
        window.addEventListener('online', this.handleConnectionChange.bind(this));
        window.addEventListener('offline', this.handleConnectionChange.bind(this));
        
        // Intentar sincronizar al iniciar si hay conexión
        if (navigator.onLine) {
            this.checkPendingSync();
        }
        
        // Programar sincronización periódica (cada 30 minutos)
        setInterval(this.checkPendingSync.bind(this), 30 * 60 * 1000);
        
        console.log('Sistema de sincronización inicializado');
    },
    
    /**
     * Maneja cambios en la conexión
     */
    handleConnectionChange: function(event) {
        if (event.type === 'online') {
            console.log('Conexión restablecida');
            UIManager.showToast('Conexión restablecida', 'info');
            this.checkPendingSync();
        } else {
            console.log('Conexión perdida');
            UIManager.showToast('Modo sin conexión activado', 'info');
        }
    },
    
    /**
     * Comprueba si hay datos pendientes de sincronizar
     */
    checkPendingSync: function() {
        if (!navigator.onLine || this.status.inProgress) return;
        
        // Comprobar última sincronización
        DB.get('settings', 'lastSync')
            .then(setting => {
                const lastSync = setting ? new Date(setting.value) : null;
                this.status.lastSync = lastSync;
                
                // Si nunca se ha sincronizado o ha pasado más de 1 hora
                if (!lastSync || (new Date() - lastSync) > 60 * 60 * 1000) {
                    this.syncData();
                }
            })
            .catch(err => console.error('Error al comprobar sincronización:', err));
    },
    
    /**
     * Sincroniza datos con el servidor o servicio de almacenamiento
     */
    syncData: function() {
        if (!navigator.onLine || this.status.inProgress) {
            return Promise.reject(new Error('No se puede sincronizar ahora'));
        }
        
        this.status.inProgress = true;
        this.status.error = null;
        UIManager.showToast('Sincronizando datos...', 'info');
        
        // En una implementación real, aquí se enviarían los datos al servidor
        // Por ahora, simularemos una sincronización exitosa
        
        return new Promise((resolve, reject) => {
            // Simular tiempo de sincronización
            setTimeout(() => {
                // Actualizar fecha de última sincronización
                const now = new Date();
                DB.saveSetting('lastSync', now.toISOString())
                    .then(() => {
                        this.status.lastSync = now;
                        this.status.inProgress = false;
                        UIManager.showToast('Datos sincronizados correctamente', 'success');
                        resolve();
                    })
                    .catch(err => {
                        this.status.inProgress = false;
                        this.status.error = err.message;
                        UIManager.showToast('Error al sincronizar datos', 'error');
                        reject(err);
                    });
            }, 1500);
        });
    },
    
    /**
     * Crea una copia de seguridad local
     */
    createBackup: function() {
        UIManager.showToast('Creando copia de seguridad...', 'info');
        
        return DB.exportData()
            .then(data => {
                // Convertir a JSON y crear blob
                const json = JSON.stringify(data);
                const blob = new Blob([json], {type: 'application/json'});
                
                // Crear URL para descargar
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                a.download = `fincontrol_backup_${timestamp}.json`;
                a.href = url;
                a.click();
                
                // Liberar URL
                setTimeout(() => URL.revokeObjectURL(url), 100);
                
                UIManager.showToast('Copia de seguridad creada correctamente', 'success');
                return true;
            })
            .catch(err => {
                console.error('Error al crear copia de seguridad:', err);
                UIManager.showToast('Error al crear copia de seguridad', 'error');
                throw err;
            });
    },
    
    /**
     * Restaura una copia de seguridad
     * @param {File} file - Archivo de copia de seguridad
     */
    restoreBackup: function(file) {
        if (!file) {
            return Promise.reject(new Error('No se ha seleccionado ningún archivo'));
        }
        
        UIManager.showToast('Restaurando copia de seguridad...', 'info');
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    
                    // Validar estructura básica
                    if (!data.transactions || !data.loans || !data.settings) {
                        throw new Error('Formato de archivo no válido');
                    }
                    
                    // Importar datos
                    DB.importData(data)
                        .then(() => {
                            UIManager.showToast('Copia de seguridad restaurada correctamente', 'success');
                            // Recargar la aplicación para reflejar los cambios
                            setTimeout(() => window.location.reload(), 1500);
                            resolve();
                        })
                        .catch(err => {
                            UIManager.showToast('Error al restaurar copia de seguridad', 'error');
                            reject(err);
                        });
                } catch (err) {
                    UIManager.showToast('Error al leer el archivo de copia de seguridad', 'error');
                    reject(err);
                }
            };
            
            reader.onerror = (event) => {
                UIManager.showToast('Error al leer el archivo', 'error');
                reject(new Error('Error al leer el archivo'));
            };
            
            reader.readAsText(file);
        });
    },
    
    /**
     * Obtiene el estado de sincronización
     */
    getStatus: function() {
        return {
            online: navigator.onLine,
            lastSync: this.status.lastSync,
            inProgress: this.status.inProgress,
            error: this.status.error
        };
    }
};

// Exportar para uso en otros módulos
window.SyncManager = SyncManager;