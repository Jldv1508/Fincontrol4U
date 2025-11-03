/**
 * family-manager.js - Gestión de miembros de familia
 */

const FamilyManager = {
    // Lista predefinida de miembros de familia
    members: ['Todos', 'Jose Luis', 'Gemma', 'Hugo', 'Alba', 'Familia', 'Otros'],
    
    /**
     * Obtiene la lista de miembros de familia
     * @returns {Array} Lista de miembros
     */
    getMembers() {
        return this.members;
    },
    
    /**
     * Añade un nuevo miembro a la familia
     * @param {string} memberName - Nombre del miembro
     */
    addMember(memberName) {
        if (memberName && !this.members.includes(memberName)) {
            // Insertar antes de 'Otros'
            const othersIndex = this.members.indexOf('Otros');
            if (othersIndex > -1) {
                this.members.splice(othersIndex, 0, memberName);
            } else {
                this.members.push(memberName);
            }
        }
    },
    
    /**
     * Genera opciones HTML para un select de miembros
     * @param {string} selectedMember - Miembro seleccionado por defecto
     * @returns {string} HTML de opciones
     */
    generateMemberOptions(selectedMember = '') {
        return this.members.map(member => 
            `<option value="${member}" ${member === selectedMember ? 'selected' : ''}>${member}</option>`
        ).join('');
    },
    
    /**
     * Muestra un diálogo para asignar familia a una transacción
     * @param {Object} transaction - Transacción a asignar
     */
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
                    <p><strong>Importe:</strong> ${transaction.amount ? transaction.amount.toFixed(2) : '0.00'} €</p>
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
                            // Actualizar la transacción con el miembro asignado
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
                            
                            // Recargar la vista actual si es necesario
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