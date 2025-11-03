// db.js - Gestión de la base de datos IndexedDB

const DB = {
    // Nombre y versión de la base de datos
    dbName: 'fincontrol_db',
    dbVersion: 1,
    db: null,
    
    // Inicializar la base de datos
    init: function() {
        return new Promise((resolve, reject) => {
            // Abrir conexión a la base de datos
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            // Manejar errores
            request.onerror = (event) => {
                console.error('Error al abrir la base de datos:', event.target.error);
                reject(event.target.error);
            };
            
            // Manejar actualización de versión
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Crear almacenes de objetos si no existen
                if (!db.objectStoreNames.contains('transactions')) {
                    const transactionsStore = db.createObjectStore('transactions', { keyPath: 'id' });
                    transactionsStore.createIndex('date', 'date', { unique: false });
                    transactionsStore.createIndex('type', 'type', { unique: false });
                    transactionsStore.createIndex('category', 'category', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('loans')) {
                    const loansStore = db.createObjectStore('loans', { keyPath: 'id' });
                    loansStore.createIndex('startDate', 'startDate', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'id' });
                }
            };
            
            // Manejar conexión exitosa
            request.onsuccess = (event) => {
                this.db = event.target.result;
                APP.db = this.db;
                console.log('Base de datos inicializada correctamente');
                
                // Cargar configuración
                this.loadSettings()
                    .then(() => resolve())
                    .catch(err => reject(err));
            };
        });
    },
    
    // Cargar configuración
    loadSettings: function() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const request = store.get('theme');
            
            request.onsuccess = (event) => {
                if (event.target.result) {
                    // Aplicar tema
                    if (event.target.result.value === 'dark') {
                        document.body.classList.add('dark-theme');
                    }
                } else {
                    // Verificar preferencia del sistema
                    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                        document.body.classList.add('dark-theme');
                        this.saveSetting('theme', 'dark');
                    }
                }
                resolve();
            };
            
            request.onerror = (event) => {
                console.error('Error al cargar configuración:', event.target.error);
                reject(event.target.error);
            };
        });
    },
    
    // Guardar configuración
    saveSetting: function(id, value) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            const request = store.put({ id, value });
            
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    },
    
    // Exportar todos los datos
    exportData: function() {
        return new Promise((resolve, reject) => {
            const data = {
                transactions: [],
                loans: [],
                settings: []
            };
            
            // Exportar transacciones
            this.getAll('transactions')
                .then(transactions => {
                    data.transactions = transactions;
                    return this.getAll('loans');
                })
                .then(loans => {
                    data.loans = loans;
                    return this.getAll('settings');
                })
                .then(settings => {
                    data.settings = settings;
                    resolve(data);
                })
                .catch(err => reject(err));
        });
    },
    
    // Importar datos
    importData: function(data) {
        return new Promise((resolve, reject) => {
            // Limpiar datos actuales
            this.clearData()
                .then(() => {
                    // Importar transacciones
                    const promises = [];
                    
                    if (data.transactions && data.transactions.length > 0) {
                        data.transactions.forEach(transaction => {
                            promises.push(this.add('transactions', transaction));
                        });
                    }
                    
                    if (data.loans && data.loans.length > 0) {
                        data.loans.forEach(loan => {
                            promises.push(this.add('loans', loan));
                        });
                    }
                    
                    if (data.settings && data.settings.length > 0) {
                        data.settings.forEach(setting => {
                            promises.push(this.add('settings', setting));
                        });
                    }
                    
                    return Promise.all(promises);
                })
                .then(() => {
                    // Aplicar configuración
                    return this.loadSettings();
                })
                .then(() => resolve())
                .catch(err => reject(err));
        });
    },
    
    // Limpiar todos los datos
    clearData: function() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['transactions', 'loans', 'settings'], 'readwrite');
            
            transaction.onerror = (event) => reject(event.target.error);
            
            // Limpiar transacciones
            const transactionsStore = transaction.objectStore('transactions');
            const clearTransactions = transactionsStore.clear();
            
            // Limpiar préstamos
            const loansStore = transaction.objectStore('loans');
            const clearLoans = loansStore.clear();
            
            // Limpiar configuración
            const settingsStore = transaction.objectStore('settings');
            const clearSettings = settingsStore.clear();
            
            // Esperar a que todas las operaciones terminen
            Promise.all([
                new Promise(resolve => clearTransactions.onsuccess = resolve),
                new Promise(resolve => clearLoans.onsuccess = resolve),
                new Promise(resolve => clearSettings.onsuccess = resolve)
            ])
            .then(() => resolve())
            .catch(err => reject(err));
        });
    },
    
    // Obtener todos los elementos de un almacén
    getAll: function(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            
            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject(event.target.error);
        });
    },
    
    // Añadir elemento a un almacén
    add: function(storeName, item) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(item);
            
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    },
    
    // Obtener elemento por ID
    get: function(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);
            
            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject(event.target.error);
        });
    },
    
    // Eliminar elemento por ID
    delete: function(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);
            
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    }
};

// Exportar objeto DB
window.DB = DB;