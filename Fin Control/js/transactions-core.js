/**
 * transactions-core.js - Gestión básica de transacciones financieras
 * Parte de la PWA de control financiero doméstico
 */

// Objeto principal para gestionar transacciones
const TransactionsManager = {
    // Categorías predefinidas para transacciones
    categories: {
        income: ['Salario', 'Freelance', 'Inversiones', 'Regalos', 'Otros ingresos'],
        expense: ['Alimentación', 'Vivienda', 'Transporte', 'Servicios', 'Ocio', 
                 'Salud', 'Educación', 'Ropa', 'Tecnología', 'Otros gastos']
    },
    
    // Métodos de pago predefinidos
    paymentMethods: ['Efectivo', 'Tarjeta de débito', 'Tarjeta de crédito', 'Transferencia', 'Móvil'],
    
    /**
     * Obtiene todas las transacciones con filtros opcionales
     */
    async getAll(filters = {}) {
        try {
            const db = await DBManager.getDB();
            let transactions = await db.getAll('transactions');
            
            // Aplicar filtros básicos
            if (filters.startDate) {
                transactions = transactions.filter(t => new Date(t.date) >= new Date(filters.startDate));
            }
            
            if (filters.endDate) {
                transactions = transactions.filter(t => new Date(t.date) <= new Date(filters.endDate));
            }
            
            if (filters.category) {
                transactions = transactions.filter(t => t.category === filters.category);
            }
            
            if (filters.type) {
                transactions = transactions.filter(t => t.type === filters.type);
            }
            
            // Ordenar por fecha (más reciente primero)
            return transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        } catch (error) {
            console.error('Error al obtener transacciones:', error);
            UIManager.showToast('Error al cargar las transacciones', 'error');
            return [];
        }
    },
    
    /**
     * Obtiene las transacciones más recientes
     */
    async getRecent(limit = 5) {
        try {
            const all = await this.getAll();
            return all.slice(0, limit);
        } catch (error) {
            console.error('Error al obtener transacciones recientes:', error);
            return [];
        }
    },
    
    /**
     * Añade una nueva transacción
     */
    async add(transaction) {
        try {
            // Validar datos mínimos
            if (!transaction.amount || !transaction.type || !transaction.category) {
                throw new Error('Faltan datos obligatorios');
            }
            
            // Añadir fecha si no existe
            if (!transaction.date) {
                transaction.date = new Date().toISOString();
            }
            
            // Añadir ID único si no existe
            if (!transaction.id) {
                transaction.id = 'trans_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            }
            
            const db = await DBManager.getDB();
            const id = await db.add('transactions', transaction);
            
            UIManager.showToast('Transacción añadida correctamente', 'success');
            // Notificar alta para refrescar vistas de análisis
            try {
                window.dispatchEvent(new CustomEvent('transactions-changed', { detail: { reason: 'core-add', ids: [id] } }));
            } catch (_) {}
            return id;
        } catch (error) {
            console.error('Error al añadir transacción:', error);
            UIManager.showToast('Error al añadir la transacción', 'error');
            throw error;
        }
    },
    
    /**
     * Actualiza una transacción existente
     */
    async update(transaction) {
        try {
            if (!transaction.id) {
                throw new Error('ID de transacción no proporcionado');
            }
            
            const db = await DBManager.getDB();
            await db.put('transactions', transaction);
            
            UIManager.showToast('Transacción actualizada correctamente', 'success');
            // Notificar cambio para que vistas de análisis se refresquen
            try {
                window.dispatchEvent(new CustomEvent('transactions-changed', { detail: { reason: 'core-update', ids: [transaction.id] } }));
            } catch (_) {}
            return true;
        } catch (error) {
            console.error('Error al actualizar transacción:', error);
            UIManager.showToast('Error al actualizar la transacción', 'error');
            throw error;
        }
    },
    
    /**
     * Elimina una transacción
     */
    async delete(id) {
        try {
            const db = await DBManager.getDB();
            await db.delete('transactions', id);
            
            UIManager.showToast('Transacción eliminada correctamente', 'success');
            // Notificar baja para refrescar vistas de análisis
            try {
                window.dispatchEvent(new CustomEvent('transactions-changed', { detail: { reason: 'core-delete', ids: [id] } }));
            } catch (_) {}
            return true;
        } catch (error) {
            console.error('Error al eliminar transacción:', error);
            UIManager.showToast('Error al eliminar la transacción', 'error');
            throw error;
        }
    }
};

// Exportar para uso en otros módulos
window.TransactionsManager = TransactionsManager;