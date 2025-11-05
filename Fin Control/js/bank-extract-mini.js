/**
 * bank-extract-mini.js - Versión mínima del módulo de extractos bancarios
 */

const BankExtractManager = {
    // Estado de inicialización
    initialized: false,
    
    // Base de datos de extractos
    extractsDB: {
        extracts: [],
        transactions: [],
        patterns: []
    },
    
    /**
     * Parseo robusto de importes con soporte de coma decimal (es-ES)
     */
    parseAmountString: function(s) {
        if (typeof s === 'number') return s;
        s = String(s || '').trim();
        const isNegative = /^-/.test(s) || /\(.*\)/.test(s);
        // limpiar todo excepto dígitos y separadores
        s = s.replace(/[^0-9.,]/g, '');
        // detectar separador decimal por 1-2 dígitos al final
        const m = s.match(/([.,])(\d{1,2})$/);
        if (m) {
            const dec = m[1];
            const thou = dec === '.' ? ',' : '.';
            s = s.replace(new RegExp('\\' + thou, 'g'), '');
            s = s.replace(new RegExp('\\' + dec, 'g'), '.');
        } else {
            // sin separador claro: eliminar ambos como miles
            s = s.replace(/[.,]/g, '');
        }
        const n = parseFloat(s);
        if (!isFinite(n)) return 0;
        return isNegative ? -Math.abs(n) : n;
    },
    
    /**
     * Inicializa el módulo de extractos bancarios
     */
    init: function() {
        if (this.initialized) return;
        
        console.log('Inicializando módulo de extractos bancarios');
        
        // Cargar datos guardados
        this.loadExtractsData()
            .then(() => {
                this.setupDefaultPatterns();
                this.initialized = true;
                console.log('Módulo de extractos bancarios inicializado');
            })
            .catch(error => {
                console.error('Error al inicializar el módulo de extractos bancarios:', error);
            });
    },
    
    /**
     * Carga los datos de extractos desde IndexedDB
     */
    loadExtractsData: function() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('finanzasPersonalesDB', 1);
            
            request.onupgradeneeded = function(event) {
                const db = event.target.result;
                
                // Crear almacenes si no existen
                if (!db.objectStoreNames.contains('bankExtracts')) {
                    db.createObjectStore('bankExtracts', { keyPath: 'id' });
                }
                
                if (!db.objectStoreNames.contains('bankTransactions')) {
                    db.createObjectStore('bankTransactions', { keyPath: 'id' });
                }
                
                if (!db.objectStoreNames.contains('bankPatterns')) {
                    db.createObjectStore('bankPatterns', { keyPath: 'id' });
                }
            };
            
            request.onsuccess = function(event) {
                const db = event.target.result;
                
                // Cargar extractos
                const extractsStore = db.transaction(['bankExtracts'], 'readonly')
                    .objectStore('bankExtracts');
                
                extractsStore.getAll().onsuccess = function(event) {
                    BankExtractManager.extractsDB.extracts = event.target.result || [];
                    
                    // Cargar transacciones
                    const transactionsStore = db.transaction(['bankTransactions'], 'readonly')
                        .objectStore('bankTransactions');
                    
                    transactionsStore.getAll().onsuccess = function(event) {
                        BankExtractManager.extractsDB.transactions = event.target.result || [];
                        
                        // Cargar patrones
                        const patternsStore = db.transaction(['bankPatterns'], 'readonly')
                            .objectStore('bankPatterns');
                        
                        patternsStore.getAll().onsuccess = function(event) {
                            BankExtractManager.extractsDB.patterns = event.target.result || [];
                            resolve();
                        };
                    };
                };
            };
            
            request.onerror = function(event) {
                reject(event.target.error);
            };
        });
    },
    
    /**
     * Guarda los datos de extractos en IndexedDB
     */
    saveExtractsData: function() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('finanzasPersonalesDB', 1);
            
            request.onsuccess = function(event) {
                const db = event.target.result;
                
                // Guardar extractos
                const extractsStore = db.transaction(['bankExtracts'], 'readwrite')
                    .objectStore('bankExtracts');
                
                // Limpiar almacén
                extractsStore.clear();
                
                // Añadir extractos
                BankExtractManager.extractsDB.extracts.forEach(extract => {
                    extractsStore.add(extract);
                });
                
                // Guardar transacciones
                const transactionsStore = db.transaction(['bankTransactions'], 'readwrite')
                    .objectStore('bankTransactions');
                
                // Limpiar almacén
                transactionsStore.clear();
                
                // Añadir transacciones
                BankExtractManager.extractsDB.transactions.forEach(transaction => {
                    transactionsStore.add(transaction);
                });
                
                // Guardar patrones
                const patternsStore = db.transaction(['bankPatterns'], 'readwrite')
                    .objectStore('bankPatterns');
                
                // Limpiar almacén
                patternsStore.clear();
                
                // Añadir patrones
                BankExtractManager.extractsDB.patterns.forEach(pattern => {
                    patternsStore.add(pattern);
                });
                
                resolve();
            };
            
            request.onerror = function(event) {
                reject(event.target.error);
            };
        });
    },
    
    /**
     * Configura patrones predeterminados para diferentes bancos
     */
    setupDefaultPatterns: function() {
        // Si ya hay patrones, no hacer nada
        if (this.extractsDB.patterns.length > 0) {
            return;
        }
        
        // Patrones predeterminados para diferentes bancos
        const defaultPatterns = [
            {
                id: this.generateUUID(),
                bankName: 'BBVA',
                description: 'Patrón para extractos de BBVA',
                linePattern: '(\\d{2}/\\d{2}/\\d{4})\\s+([A-Za-z0-9\\s.,\\-_/]+)\\s+([\\-+]?\\d{1,3}(?:[.,]\\d{3})*(?:[.,]\\d{2}))'
            },
            {
                id: this.generateUUID(),
                bankName: 'Santander',
                description: 'Patrón para extractos de Santander',
                linePattern: '(\\d{2}/\\d{2}/\\d{4})\\s+([A-Za-z0-9\\s.,\\-_/]+)\\s+([\\-+]?\\d{1,3}(?:[.,]\\d{3})*(?:[.,]\\d{2}))'
            },
            {
                id: this.generateUUID(),
                bankName: 'Genérico',
                description: 'Patrón genérico para extractos bancarios',
                linePattern: '(\\d{2}/\\d{2}/\\d{4})\\s+([A-Za-z0-9\\s.,\\-_/]+)\\s+([\\-+]?\\d{1,3}(?:[.,]\\d{3})*(?:[.,]\\d{2}))'
            }
        ];
        
        // Añadir patrones a la base de datos
        this.extractsDB.patterns = defaultPatterns;
        this.saveExtractsData();
    },
    
    /**
     * Procesa un extracto bancario
     * @param {Object} extractData - Datos del extracto
     * @returns {Array} - Transacciones extraídas
     */
    processExtract: function(extractData) {
        // Validar datos
        if (!extractData || !extractData.text || !extractData.bankName) {
            console.error('Datos de extracto inválidos');
            return [];
        }
        
        // Extraer transacciones
        const transactions = this.extractTransactionsFromText(
            extractData.text,
            extractData.bankName,
            extractData.date
        );
        
        // Crear objeto de extracto
        const extract = {
            id: this.generateUUID(),
            bankName: extractData.bankName,
            date: extractData.date,
            text: extractData.text,
            transactionIds: transactions.map(t => t.id),
            createdAt: new Date().toISOString()
        };
        
        // Guardar extracto y transacciones
        this.extractsDB.extracts.push(extract);
        this.extractsDB.transactions = this.extractsDB.transactions.concat(transactions);
        this.saveExtractsData();
        
        return transactions;
    },
    
    /**
     * Extrae transacciones del texto del extracto
     * @param {string} text - Texto del extracto
     * @param {string} bankName - Nombre del banco
     * @param {string} extractDate - Fecha del extracto
     * @returns {Array} - Transacciones extraídas
     */
    extractTransactionsFromText: function(text, bankName, extractDate) {
        // Buscar patrón para el banco
        const pattern = this.extractsDB.patterns.find(p => p.bankName === bankName);
        
        // Si no hay patrón específico, usar genérico
        const bankPattern = pattern || this.extractsDB.patterns.find(p => p.bankName === 'Genérico');
        
        if (!bankPattern) {
            console.error('No se encontró un patrón para el banco:', bankName);
            return [];
        }
        
        // Extraer transacciones usando el patrón
        const transactions = [];
        const regex = new RegExp(bankPattern.linePattern, 'gm');
        let match;
        
        while ((match = regex.exec(text)) !== null) {
            const date = match[1];
            const description = match[2].trim();
            const amount = this.parseAmountString(match[3]);
            
            if (!isNaN(amount)) {
                transactions.push({
                    id: this.generateUUID(),
                    date: date,
                    description: description,
                    amount: amount,
                    bankName: bankName,
                    extractDate: extractDate,
                    createdAt: new Date().toISOString()
                });
            }
        }
        // Fallback por bloques (Fecha, Descripción, Importe, Saldo)
        if (transactions.length === 0) {
            const rawLines = String(text || '').split(/\n/).map(l => l.trim());
            const headers = new Set(['fecha','fecha valor','movimiento','más datos','mas datos','importe','saldo']);
            const lines = rawLines.filter(l => l && !headers.has(l.toLowerCase()));
            const dateRe = /(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/;
            const amountLineRe = /^\(?\s*[\+\-]?\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d{2})\s*\)?$/;
            for (let i = 0; i < lines.length; i++) {
                const dm = lines[i].match(dateRe);
                if (!dm) continue;
                const txDate = dm[1];
                let j = i + 1;
                if (j < lines.length && dateRe.test(lines[j])) j++;
                const descParts = [];
                while (j < lines.length) {
                    const cur = lines[j];
                    if (amountLineRe.test(cur)) break;
                    if (dateRe.test(cur)) break;
                    descParts.push(cur);
                    j++;
                }
                if (j < lines.length && amountLineRe.test(lines[j])) {
                    const amountVal = this.parseAmountString(lines[j]);
                    const description = descParts.join(' ').replace(/\s+/g, ' ').trim() || 'Movimiento';
                    transactions.push({
                        id: this.generateUUID(),
                        date: txDate,
                        description,
                        amount: amountVal,
                        bankName: bankName,
                        extractDate: extractDate,
                        createdAt: new Date().toISOString()
                    });
                    i = j;
                }
            }
        }
        return transactions;
    },
    
    /**
     * Genera un UUID único
     * @returns {string} - UUID generado
     */
    generateUUID: function() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
};

// Exportar para uso global
window.BankExtractManager = BankExtractManager;