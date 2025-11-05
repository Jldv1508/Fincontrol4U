/**
 * loans.js - Gestión de préstamos y financiaciones
 * Parte de la PWA de control financiero doméstico
 */

const LoansManager = {
    /**
     * Calcula el cuadro de financiación (plan de pagos)
     * @param {Object} loan - Datos del préstamo
     * @returns {Array} - Filas con idx, date, amount, interest, principal, balance, pendingAmount
     */
    computeSchedule(loan) {
        const amount = Number(loan.amount) || 0;
        const n = Number(loan.installments) || 0;
        const rate = (Number(loan.interestRate) || 0) / 100 / 12;
        const firstAmount = Number(loan.firstInstallmentAmount) || undefined;
        const lastAmount = Number(loan.lastInstallmentAmount) || undefined;
        const startDate = loan.firstInstallmentDate || loan.startDate || new Date().toISOString().slice(0,10);
        let installment = Number(loan.installmentAmount) || 0;
        if (installment <= 0 && amount > 0 && n > 0) {
            installment = rate > 0 ? (amount * rate) / (1 - Math.pow(1 + rate, -n)) : (amount / n);
        }
        installment = Math.round(installment * 100) / 100;
        const rows = [];
        let balance = amount; // Saldo pendiente para cálculo (antes de cada pago)

        for (let i = 0; i < n; i++) {
            const d = new Date(startDate);
            d.setMonth(d.getMonth() + i);
            // Ajustes de primera y última cuota
            let amt = installment;
            if (i === 0 && firstAmount) amt = firstAmount;
            if (i === n - 1 && lastAmount) amt = lastAmount;
            // Pendiente ANTES de pagar esta cuota (requerido: 1ª cuota = capital total)
            const pendingAmount = Math.max(0, Math.round(balance * 100) / 100);

            // Intereses y capital de esta cuota
            const interest = Math.round(balance * rate * 100) / 100;
            const principal = Math.max(0, Math.round((amt - interest) * 100) / 100);

            // Actualizar saldo para próximo cálculo (después de pagar esta cuota)
            balance = Math.max(0, Math.round((balance - principal) * 100) / 100);
            
            rows.push({ 
                idx: i + 1, 
                date: d.toISOString().slice(0,10), 
                amount: amt, 
                interest, 
                principal, 
                balance, // Saldo DESPUÉS de la cuota (compatibilidad)
                pendingAmount // Saldo ANTES de la cuota (lo mostrado en tabla "Pendiente")
            });
        }
        return rows;
    },

    /**
     * Recalcula el cuadro de financiación usando filas editadas (importes/fechas)
     * Mantiene el cálculo de intereses, capital y pendiente real por fila.
     * @param {Object} loan
     * @param {Array<{idx:number,date:string,amount:number}>} rows
     * @returns {Array}
     */
    computeCustomSchedule(loan, rows) {
        const amount = Number(loan.amount) || 0;
        const rate = (Number(loan.interestRate) || 0) / 100 / 12;
        let balance = amount;
        const out = [];
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const amt = Math.max(0, Math.round((Number(r.amount) || 0) * 100) / 100);
            const pendingAmount = Math.max(0, Math.round(balance * 100) / 100);
            const interest = Math.round(balance * rate * 100) / 100;
            const principal = Math.max(0, Math.round((amt - interest) * 100) / 100);
            balance = Math.max(0, Math.round((balance - principal) * 100) / 100);
            out.push({
                idx: i + 1,
                date: r.date,
                amount: amt,
                interest,
                principal,
                balance,
                pendingAmount
            });
        }
        return out;
    },
    /**
     * Obtiene todos los préstamos con filtros opcionales
     * @param {Object} filters - Filtros a aplicar
     * @returns {Promise} - Promise con los préstamos
     */
    async getAll(filters = {}) {
        try {
            let loans = await DB.getAll('loans');
            
            // Aplicar filtros si existen
            if (filters.status) {
                loans = loans.filter(l => l.status === filters.status);
            }
            
            if (filters.startDate) {
                loans = loans.filter(l => new Date(l.startDate) >= new Date(filters.startDate));
            }
            
            if (filters.endDate) {
                loans = loans.filter(l => new Date(l.endDate) <= new Date(filters.endDate));
            }
            
            // Ordenar por fecha de inicio (más reciente primero)
            return loans.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
        } catch (error) {
            console.error('Error al obtener préstamos:', error);
            UIManager.showToast('Error al cargar los préstamos', 'error');
            return [];
        }
    },
    
    /**
     * Obtiene un préstamo por su ID
     * @param {String} id - ID del préstamo
     * @returns {Promise} - Promise con el préstamo
     */
    async getById(id) {
        try {
            return await DB.get('loans', id);
        } catch (error) {
            console.error('Error al obtener préstamo:', error);
            return null;
        }
    },
    
    /**
     * Añade un nuevo préstamo
     * @param {Object} loan - Datos del préstamo
     * @returns {Promise} - Promise con el resultado
     */
    async add(loan) {
        try {
            // Validar datos mínimos
            if (!loan.amount || !loan.name || !loan.startDate) {
                throw new Error('Faltan datos obligatorios');
            }
            
            // Añadir ID único si no existe
            if (!loan.id) {
                loan.id = 'loan_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            }
            
            // Añadir estado por defecto
            if (!loan.status) {
                loan.status = 'active';
            }
            
            // Calcular cuotas si es necesario
            if (loan.installments && loan.amount && !loan.installmentAmount) {
                loan.installmentAmount = loan.amount / loan.installments;
            }

            // Guardar metadatos adicionales si existen
            loan.typeOfFinancing = loan.typeOfFinancing || loan.typeOfFinancing;
            loan.firstInstallmentDate = loan.firstInstallmentDate || loan.startDate;
            loan.firstInstallmentAmount = loan.firstInstallmentAmount || undefined;
            loan.lastInstallmentAmount = loan.lastInstallmentAmount || undefined;
            loan.institution = loan.institution || undefined;
            loan.concept = loan.concept || undefined;

            // Generar cuadro de financiación
            if (loan.installments) {
                loan.schedule = this.computeSchedule(loan);
            }

            await DB.add('loans', loan);
            
            // Si hay transacción inicial, añadirla
            if (loan.initialTransaction) {
                const transaction = {
                    id: 'trans_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                    date: loan.startDate,
                    amount: loan.amount,
                    type: loan.type || 'expense',
                    category: 'Préstamos',
                    description: `${loan.type === 'income' ? 'Recepción' : 'Concesión'} de préstamo: ${loan.name}`,
                    loanId: loan.id
                };
                
                await TransactionsManager.add(transaction);
            }
            
            UIManager.showToast('Préstamo añadido correctamente', 'success');
            return true;
        } catch (error) {
            console.error('Error al añadir préstamo:', error);
            UIManager.showToast('Error al añadir el préstamo', 'error');
            throw error;
        }
    },
    
    /**
     * Actualiza un préstamo existente
     * @param {Object} loan - Datos actualizados del préstamo
     * @returns {Promise} - Promise con el resultado
     */
    async update(loan) {
        try {
            if (!loan.id) {
                throw new Error('ID de préstamo no proporcionado');
            }
            // Si el usuario ha editado el plan de pagos (filas con amount/date),
            // recalcular intereses/capital/pendiente basados en dichas filas.
            if (Array.isArray(loan.schedule) && loan.schedule.length) {
                const rows = loan.schedule.map(r => ({ idx: r.idx, date: r.date, amount: r.amount }));
                loan.schedule = this.computeCustomSchedule(loan, rows);
                loan.installments = loan.schedule.length;
                loan.installmentAmount = loan.schedule[0] ? loan.schedule[0].amount : loan.installmentAmount;
                loan.firstInstallmentAmount = loan.schedule[0] ? loan.schedule[0].amount : loan.firstInstallmentAmount;
                loan.lastInstallmentAmount = loan.schedule[loan.schedule.length - 1] ? loan.schedule[loan.schedule.length - 1].amount : loan.lastInstallmentAmount;
            } else if (loan.installments) {
                // Recalcular cuadro si faltan importes
                loan.schedule = this.computeSchedule(loan);
            }

            await DB.add('loans', loan);

            UIManager.showToast('Préstamo actualizado correctamente', 'success');
            return true;
        } catch (error) {
            console.error('Error al actualizar préstamo:', error);
            UIManager.showToast('Error al actualizar el préstamo', 'error');
            throw error;
        }
    },
    
    /**
     * Elimina un préstamo
     * @param {String} id - ID del préstamo a eliminar
     * @returns {Promise} - Promise con el resultado
     */
    async delete(id) {
        try {
            await DB.delete('loans', id);
            
            // También eliminar transacciones asociadas
            const transactions = await TransactionsManager.getAll();
            const relatedTransactions = transactions.filter(t => t.loanId === id);
            
            for (const transaction of relatedTransactions) {
                await TransactionsManager.delete(transaction.id);
            }
            
            UIManager.showToast('Préstamo eliminado correctamente', 'success');
            return true;
        } catch (error) {
            console.error('Error al eliminar préstamo:', error);
            UIManager.showToast('Error al eliminar el préstamo', 'error');
            throw error;
        }
    },
    
    /**
     * Registra un pago de cuota
     * @param {String} loanId - ID del préstamo
     * @param {Number} amount - Cantidad pagada
     * @param {String} date - Fecha del pago
     * @returns {Promise} - Promise con el resultado
     */
    async registerPayment(loanId, amount, date = new Date().toISOString(), member = null) {
        try {
            // Obtener préstamo
            const loan = await this.getById(loanId);
            if (!loan) {
                throw new Error('Préstamo no encontrado');
            }
            
            // Crear transacción para el pago
            const transaction = {
                id: 'trans_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                date: date,
                amount: amount,
                type: 'expense',
                category: 'Préstamos',
                description: `Pago de cuota: ${loan.name}`,
                loanId: loan.id,
                member: member || null
            };
            
            await TransactionsManager.add(transaction);
            
            // Actualizar préstamo
            if (!loan.payments) {
                loan.payments = [];
            }
            
            loan.payments.push({
                date: date,
                amount: amount
            });
            
            // Calcular total pagado
            const totalPaid = loan.payments.reduce((sum, payment) => sum + payment.amount, 0);
            loan.paidAmount = totalPaid;
            
            // Actualizar estado si se ha pagado todo
            if (totalPaid >= loan.amount) {
                loan.status = 'completed';
            }
            
            await this.update(loan);
            
            UIManager.showToast('Pago registrado correctamente', 'success');
            return true;
        } catch (error) {
            console.error('Error al registrar pago:', error);
            UIManager.showToast('Error al registrar el pago', 'error');
            throw error;
        }
    },
    
    /**
     * Obtiene un resumen de los préstamos activos
     * @returns {Promise} - Promise con el resumen
     */
    async getSummary() {
        try {
            const loans = await this.getAll();
            
            const active = loans.filter(l => l.status === 'active');
            const completed = loans.filter(l => l.status === 'completed');
            
            const totalActive = active.reduce((sum, loan) => sum + loan.amount, 0);
            const totalPaid = active.reduce((sum, loan) => sum + (loan.paidAmount || 0), 0);
            const totalRemaining = totalActive - totalPaid;
            
            return {
                active: active.length,
                completed: completed.length,
                totalActive,
                totalPaid,
                totalRemaining
            };
        } catch (error) {
            console.error('Error al obtener resumen de préstamos:', error);
            return null;
        }
    },

    /**
     * Deshace el último pago registrado del préstamo
     * @param {String} loanId - ID del préstamo
     */
    async undoLastPayment(loanId) {
        try {
            const loan = await this.getById(loanId);
            if (!loan || !Array.isArray(loan.payments) || loan.payments.length === 0) {
                UIManager.showToast('No hay pagos para deshacer', 'warning');
                return false;
            }
            const lastPayment = loan.payments[loan.payments.length - 1];
            // Eliminar la transacción asociada al pago (por loanId y coincidencia básica)
            const allTx = await TransactionsManager.getAll();
            const txToDelete = allTx.find(t => t.loanId === loanId && Math.abs(Number(t.amount) - Number(lastPayment.amount)) < 0.01 && String(t.date).slice(0,10) === String(lastPayment.date).slice(0,10));
            if (txToDelete) {
                await TransactionsManager.delete(txToDelete.id);
            }
            // Quitar el pago del array y recalcular total
            loan.payments.pop();
            loan.paidAmount = loan.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            // Revertir estado si estaba completado
            if ((loan.status || 'active') === 'completed') {
                loan.status = 'active';
            }
            await this.update(loan);
            UIManager.showToast('Se deshizo el último pago', 'success');
            return true;
        } catch (error) {
            console.error('Error al deshacer último pago:', error);
            UIManager.showToast('Error al deshacer el pago', 'error');
            throw error;
        }
    }
};

// Exportar para uso en otros módulos
window.LoansManager = LoansManager;