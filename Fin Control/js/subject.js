// subject.js - Pestaña de asignación de gasto (Sujeto)
(function(){
  function ensureMain() {
    if (typeof window.ensureMain === 'function') return window.ensureMain();
    return document.getElementById('mainContent');
  }

  function formatAmount(v) {
    if (typeof window.formatAmount === 'function') {
      return window.formatAmount(v);
    }
    const num = Number(v) || 0;
    const s = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
    return s.replace(/\u00a0/g,'').replace(/\s*€/,'€');
  }

  async function renderSubjectList() {
    const container = document.getElementById('subject-list');
    if (!container) return;
    try {
      const all = await DB.getAll('transactions');
      const pending = all
        .filter(t => {
          const catLower = (t.category || '').toLowerCase();
          const isLoanCategory = catLower.includes('préstamo') || catLower.includes('prestamo') || catLower.includes('préstamos') || catLower.includes('prestamos');
          const hasNoMember = !t.member || t.member === '' || t.member === 'Todos';
          return hasNoMember && !t.loanId && !isLoanCategory;
        })
        .sort((a,b) => new Date(b.date) - new Date(a.date));

      if (!pending.length) {
        container.innerHTML = '<p class="empty-state">No hay transacciones pendientes de asignar.</p>';
        return;
      }

      container.innerHTML = pending.map(t => {
        const isExpense = (t.type || t.kind) === 'expense';
        const amt = formatAmount(Number(t.amount)||0);
        const sign = isExpense ? '-' : '+';
        const desc = t.description || '';
        const cat = t.category || '';
        const d = t.date ? new Date(t.date).toLocaleDateString('es-ES') : '';
        const selectHtml = (typeof FamilyManager !== 'undefined') ? FamilyManager.generateMemberOptions('Todos') : '<option value="Todos">Sujeto</option>';
        return `
          <div class="tx-item" data-id="${t.id}">
            <div class="tx-main">
              <span class="tx-date">${d}</span>
              <span class="tx-amount ${isExpense ? 'neg' : 'pos'}">${sign}${amt}</span>
            </div>
            <div class="tx-body">
              <span class="chip category"><i class="fas fa-tag"></i> ${cat}</span>
              <span class="tx-desc">${desc}</span>
            </div>
            <div class="tx-actions">
              <select class="form-control subject-select">${selectHtml}</select>
              <button class="btn assign-btn"><i class="fas fa-user-check"></i> Asignar</button>
            </div>
          </div>
        `;
      }).join('');

      container.querySelectorAll('.tx-item .assign-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const item = e.target.closest('.tx-item');
          const id = item?.getAttribute('data-id');
          const select = item?.querySelector('.subject-select');
          const member = select?.value || '';
          if (!id || !member || member === 'Todos') {
            UIManager.showToast('Selecciona un miembro válido', 'warning');
            return;
          }
          try {
            const tx = await DB.get('transactions', id);
            if (!tx) throw new Error('Transacción no encontrada');
            tx.member = member;
            tx.updated_at = new Date().toISOString();
            await DB.add('transactions', tx);
            UIManager.showToast(`Asignado a ${member}`, 'success');
            // Quitar del listado
            item.remove();
            if (!container.querySelector('.tx-item')) {
              container.innerHTML = '<p class="empty-state">No hay transacciones pendientes de asignar.</p>';
            }
            // Notificar actualización para refrescar análisis activos
            try {
              window.dispatchEvent(new CustomEvent('transactions-changed', { detail: { reason: 'assign-member', ids: [id] } }));
            } catch (_) {}
          } catch (err) {
            console.error('Error asignando sujeto:', err);
            UIManager.showToast('Error al asignar sujeto', 'error');
          }
        });
      });
    } catch (e) {
      console.error('Error cargando transacciones para sujeto:', e);
      container.innerHTML = '<p class="empty-state">Error cargando transacciones.</p>';
    }
  }

  function loadSubjectTab() {
    const main = ensureMain();
    if (!main) return;
    main.innerHTML = `
      <section class="subject-view">
        <div class="tx-toolbar">
          <div class="tx-title"><i class="fas fa-user-tag"></i> <span>Sujeto</span></div>
        </div>
        <p class="hint">Asigna un miembro de familia a transacciones sin sujeto.</p>
        <div id="subject-list" class="tx-list"><div class="loading">Cargando...</div></div>
      </section>
    `;
    renderSubjectList();
  }

  window.loadSubjectTab = loadSubjectTab;
})();