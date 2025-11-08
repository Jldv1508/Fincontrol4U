/**
 * family-manager.js - Gestión de miembros/sujetos de familia (persistente)
 */

const FamilyManager = {
    // Lista por defecto; se actualizará desde ajustes si existe
    members: ['Todos', 'Jose Luis', 'Gemma', 'Hugo', 'Alba', 'Familia', 'Otros'],

    // Cargar lista de sujetos desde IndexedDB (settings: 'subjects')
    async loadFromSettings() {
        try {
            if (!window.DB?.db && typeof DB?.init === 'function') {
                await DB.init();
            }
            const rec = await DB.get('settings', 'subjects');
            const list = Array.isArray(rec?.value) ? rec.value.slice() : null;
            if (list && list.length) {
                // Asegurar 'Todos' al principio y 'Otros' al final
                const base = list.filter(Boolean);
                const hasTodos = base.includes('Todos');
                const hasOtros = base.includes('Otros');
                const final = [];
                final.push('Todos');
                base.filter(n => n !== 'Todos' && n !== 'Otros').forEach(n => final.push(n));
                if (!hasOtros) final.push('Otros'); else final.push('Otros');
                this.members = final;
            }
        } catch (e) {
            console.warn('No se pudo cargar sujetos desde ajustes:', e);
        }
    },

    // Guardar lista completa en ajustes (incluye 'Todos' y 'Otros')
    async saveToSettings() {
        try {
            const toSave = this.members.slice();
            await DB.saveSetting('subjects', toSave);
            // Notificar cambios por si alguna vista quiere refrescar opciones
            try { window.dispatchEvent(new CustomEvent('subjects-changed', { detail: { count: toSave.length } })); } catch (_) {}
        } catch (e) {
            console.error('Error guardando sujetos en ajustes:', e);
        }
    },

    /**
     * Obtener lista actual de sujetos
     */
    getMembers() {
        return this.members;
    },

    /** Añadir sujeto nuevo (antes de 'Otros') */
    addMember(memberName) {
        const name = (memberName || '').trim();
        if (!name) return false;
        if (this.members.includes(name)) return false;
        const othersIndex = this.members.indexOf('Otros');
        if (othersIndex > -1) {
            this.members.splice(othersIndex, 0, name);
        } else {
            this.members.push(name);
        }
        return true;
    },

    /** Eliminar sujeto (no permite eliminar 'Todos' ni 'Otros') */
    removeMember(name) {
        const n = (name || '').trim();
        if (!n || n === 'Todos' || n === 'Otros') return false;
        const idx = this.members.indexOf(n);
        if (idx > -1) {
            this.members.splice(idx, 1);
            return true;
        }
        return false;
    },

    /** Renombrar sujeto (no permite renombrar 'Todos' ni 'Otros') */
    renameMember(oldName, newName) {
        const o = (oldName || '').trim();
        const n = (newName || '').trim();
        if (!o || !n || o === 'Todos' || o === 'Otros' || this.members.includes(n)) return false;
        const idx = this.members.indexOf(o);
        if (idx > -1) {
            this.members[idx] = n;
            return true;
        }
        return false;
    },

    /**
     * Generar opciones para selects (mostrar 'Sujeto' para 'Todos')
     */
    generateMemberOptions(selectedMember = '') {
        return this.members.map(member => {
            const label = member === 'Todos' ? 'Sujeto' : member;
            return `<option value="${member}" ${member === selectedMember ? 'selected' : ''}>${label}</option>`;
        }).join('');
    },

    /** Diálogo de asignación (se mantiene por compatibilidad) */
    showFamilyAssignmentDialog(transaction) {
        if (!transaction) return;
        const html = `
            <form id="family-assign-form" class="family-form">
                <div class="form-group">
                    <label for="member-select">Asignar a miembro de familia:</label>
                    <select id="member-select" class="form-control" required>
                        ${this.generateMemberOptions(transaction.member || 'Todos')}
                    </select>
                </div>
                <div class="transaction-preview">
                    <h4>Transacción:</h4>
                    <p><strong>Descripción:</strong> ${transaction.description || 'Sin descripción'}</p>
                    <p><strong>Importe:</strong> ${window.formatAmount(transaction.amount || 0)}</p>
                    <p><strong>Fecha:</strong> ${transaction.date ? new Date(transaction.date).toLocaleDateString('es-ES') : 'Sin fecha'}</p>
                </div>
            </form>
        `;
        if (typeof showModal === 'function') {
            showModal({
                title: 'Asignar Familia',
                content: html,
                size: 'medium',
                buttons: [
                    { text: 'Cancelar', type: 'secondary', onClick: () => closeModal() },
                    { text: 'Asignar', type: 'primary', onClick: async () => {
                        const selectedMember = document.getElementById('member-select').value;
                        try {
                            const updatedTransaction = {
                                ...transaction,
                                member: selectedMember,
                                updated_at: new Date().toISOString()
                            };
                            await DB.add('transactions', updatedTransaction);
                            if (typeof showNotification === 'function') {
                                showNotification(`Transacción asignada a ${selectedMember}`, 'success');
                            }
                            closeModal();
                            if (typeof renderTransactionsList === 'function') {
                                renderTransactionsList();
                            }
                        } catch (error) {
                            console.error('Error asignando familia:', error);
                            if (typeof showNotification === 'function') {
                                showNotification('Error al asignar familia', 'error');
                            }
                        }
                    }}
                ]
            });
        }
    }
};

// Exponer globalmente
window.FamilyManager = FamilyManager;

// Cargar lista desde ajustes al inicio (best-effort)
(async () => {
    try { await FamilyManager.loadFromSettings(); } catch (_) {}
})();