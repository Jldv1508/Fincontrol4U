/**
 * bank-extract-ui-mini.js - Versión mínima de la interfaz de usuario para extractos bancarios
 */

const BankExtractUI = {
    /**
     * Muestra la interfaz para escanear un extracto bancario
     */
    showScanInterface: function() {
        // Bancos disponibles
        const banks = [
            { id: 'BBVA', name: 'BBVA' },
            { id: 'Santander', name: 'Santander' },
            { id: 'CaixaBank', name: 'CaixaBank' },
            { id: 'ING', name: 'ING' },
            { id: 'Otro', name: 'Otro banco' }
        ];
        
        // Generar opciones HTML
        let banksHTML = '';
        banks.forEach(bank => {
            banksHTML += `<option value="${bank.id}">${bank.name}</option>`;
        });
        
        // Crear modal
        const modalContent = `
            <div class="bank-extract-scan">
                <div class="form-group">
                    <label for="bank-select">Banco</label>
                    <select id="bank-select" class="form-control">
                        <option value="">Seleccionar banco</option>
                        ${banksHTML}
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="extract-date">Fecha del extracto</label>
                    <input type="date" id="extract-date" class="form-control" 
                        value="${new Date().toISOString().split('T')[0]}">
                </div>
                
                <div class="form-group">
                    <p class="hint">La opción de pegar texto del extracto ha sido eliminada.</p>
                    <p class="hint">Usa la carga de archivo en la sección Escanear: PDF/Excel/CSV.</p>
                </div>
                
                <div class="form-actions">
                    <button id="cancel-extract-btn" class="btn btn-secondary">Cancelar</button>
                </div>
            </div>
        `;
        
        // Mostrar modal
        window.showModal({
            title: 'Escanear extracto bancario',
            content: modalContent,
            size: 'large',
            onOpen: () => {
                // Se elimina el procesamiento por texto pegado. Usa la carga de archivo en Escanear.
                
                document.getElementById('cancel-extract-btn').addEventListener('click', () => {
                    window.closeModal();
                });
            }
        });
    },
    
    /**
     * Muestra los resultados de un extracto procesado
     * @param {Array} transactions - Transacciones extraídas
     */
    showExtractResults: function(transactions) {
        // Si no hay transacciones, mostrar mensaje
        if (!transactions || transactions.length === 0) {
            alert('No se encontraron transacciones en el extracto');
            return;
        }
        
        // Generar HTML para las transacciones
        let transactionsHTML = '';
        
        transactions.forEach(transaction => {
            const amountClass = transaction.amount < 0 ? 'negative' : 'positive';
            const amountFormatted = window.formatAmount(transaction.amount);
            
            transactionsHTML += `
                <div class="transaction-item" data-id="${transaction.id}">
                    <div class="transaction-date">${transaction.date}</div>
                    <div class="transaction-description">${transaction.description}</div>
                    <div class="transaction-amount ${amountClass}">${amountFormatted}</div>
                    <div class="transaction-actions">
                        <button class="btn-icon add-transaction" title="Añadir a la aplicación">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        // Crear modal
        const modalContent = `
            <div class="extract-results">
                <div class="results-summary">
                    <p>Se encontraron ${transactions.length} transacciones en el extracto.</p>
                </div>
                
                <div class="transactions-container">
                    ${transactionsHTML}
                </div>
                
                <div class="form-actions">
                    <button id="add-all-btn" class="btn btn-primary">Añadir todas</button>
                    <button id="close-results-btn" class="btn btn-secondary">Cerrar</button>
                </div>
            </div>
        `;
        
        // Mostrar modal
        window.showModal({
            title: 'Resultados del extracto',
            content: modalContent,
            size: 'large',
            onOpen: () => {
                // Configurar eventos
                document.getElementById('add-all-btn').addEventListener('click', () => {
                    this.addAllTransactionsToApp(transactions);
                    window.closeModal();
                });
                
                document.getElementById('close-results-btn').addEventListener('click', () => {
                    window.closeModal();
                });
                
                // Eventos para botones de acciones individuales
                document.querySelectorAll('.add-transaction').forEach(button => {
                    button.addEventListener('click', (e) => {
                        const transactionId = e.target.closest('.transaction-item').dataset.id;
                        const transaction = transactions.find(t => t.id === transactionId);
                        
                        if (transaction) {
                            this.addTransactionToApp(transaction);
                            e.target.closest('.transaction-item').classList.add('added');
                        }
                    });
                });
            }
        });
    },
    
    /**
     * Añade todas las transacciones a la aplicación
     * @param {Array} transactions - Transacciones a añadir
     */
    addAllTransactionsToApp: function(transactions) {
        transactions.forEach(transaction => {
            this.addTransactionToApp(transaction);
        });
        
        alert(`Se añadieron ${transactions.length} transacciones a la aplicación`);
    },
    
    /**
     * Añade una transacción a la aplicación
     * @param {Object} transaction - Transacción a añadir
     */
    addTransactionToApp: function(transaction) {
        // Convertir transacción al formato de la aplicación
        const appTransaction = {
            id: transaction.id,
            date: transaction.date,
            description: transaction.description,
            amount: transaction.amount,
            source: `Extracto bancario - ${transaction.bankName}`,
            createdAt: new Date().toISOString()
        };
        
        // Añadir a la aplicación (simulado)
        console.log('Transacción añadida:', appTransaction);
        
        // En una implementación real, se añadiría a la aplicación
        if (window.TransactionManager) {
            window.TransactionManager.addTransaction(appTransaction);
        }
    }
};

// Exportar para uso global
window.BankExtractUI = BankExtractUI;