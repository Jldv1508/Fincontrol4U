// Simple helpers y loaders para transacciones y pestañas
// Depende de `DB` global (definido en db.js) y del contenedor `mainContent`

(function () {
  // Helper para clases de color por miembro
  function getMemberClass(name) {
    if (!name) return '';
    const slug = (name || '').toString().trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-');
    switch (slug) {
      case 'jose-luis': return 'jose-luis';
      case 'gemma': return 'gemma';
      case 'hugo': return 'hugo';
      case 'alba': return 'alba';
      case 'familia': return 'familia';
      case 'otros': return 'otros';
      default: return 'otros';
    }
  }
  async function getAllTransactions() {
    try {
      const list = await DB.getAll('transactions');
      return Array.isArray(list) ? list : [];
    } catch (e) {
      console.error('Error obteniendo transacciones:', e);
      return [];
    }
  }

  async function getRecentTransactions(limit = 5) {
    const all = await getAllTransactions();
    return all
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, limit);
  }

  async function getTransactionsSummary(startDate, endDate) {
    const all = await getAllTransactions();
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    const within = all.filter((t) => {
      const d = new Date(t.date);
      return (!start || d >= start) && (!end || d <= end);
    });
    const income = within
      .filter((t) => (t.type || t.kind) === 'income')
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const expense = within
      .filter((t) => (t.type || t.kind) === 'expense')
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    return { totalIncome: income, totalExpense: expense };
  }

  function ensureMain() {
    const el = document.getElementById('mainContent');
    if (!el) {
      console.warn('mainContent no encontrado');
    }
    return el;
  }

  function formatAmount(v) {
    if (typeof window.formatAmount === 'function') {
      return window.formatAmount(v);
    }
    const num = Number(v) || 0;
    const s = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
    return s.replace(/\u00a0/g,'').replace(/\s*€/,'€');
  }

  // Identificar capital inicial de préstamo (debe excluirse de Previsión de gastos)
  function isLoanCapitalTransaction(t) {
    if (!t) return false;
    const hasLoan = !!t.loanId;
    const desc = String(t.description || '').toLowerCase();
    const isInstallment = desc.includes('pago de cuota');
    const isCapitalHint = desc.includes('concesión de préstamo') || desc.includes('recepción de préstamo');
    // Si está vinculado a préstamo y NO es un pago de cuota, lo consideramos capital
    return hasLoan && !isInstallment && (isCapitalHint || (t.type || t.kind) === 'expense');
  }

  async function loadTransactions() {
    const main = ensureMain();
    if (!main) return;
    const zeroAmt = (typeof window.formatAmount === 'function') ? window.formatAmount(0) : '0,00€';
    main.innerHTML = `
      <section class="transactions-view">
        <div class="tx-toolbar">
          <div class="tx-title"><i class="fas fa-exchange-alt"></i> <span>Transacciones</span></div>
          <div class="tx-actions">
            <button id="tx-delete-all-btn" class="btn"><i class="fas fa-trash"></i> Borrar todo</button>
            <button id="tx-select-toggle" class="btn"><i class="fas fa-check-square"></i> Seleccionar</button>
            <button id="tx-select-all" class="btn"><i class="fas fa-list"></i> Seleccionar todo</button>
            <button id="tx-edit-selected" class="btn"><i class="fas fa-pen"></i> Editar seleccionados</button>
            <button id="tx-delete-selected" class="btn"><i class="fas fa-trash-alt"></i> Eliminar seleccionados</button>
          </div>
        </div>

        <div class="tx-summary" id="tx-summary">
          <div class="card income"><h4>Ingresos</h4><div class="amount" id="sum-income">${zeroAmt}</div></div>
          <div class="card expense"><h4>Gastos</h4><div class="amount" id="sum-expense">${zeroAmt}</div></div>
          <div class="card balance"><h4>Balance</h4><div class="amount" id="sum-balance">${zeroAmt}</div></div>
          <div class="card"><h4>Transacciones</h4><div class="amount" id="sum-count">0</div></div>
        </div>

        <div class="tx-filters">
          <div class="filters-basic">
            <select id="flt-type" class="form-control">
              <option value="">Todos</option>
              <option value="expense">Gasto</option>
              <option value="income">Ingreso</option>
              <option value="transfer">Transferencia</option>
              <option value="traspaso">Traspaso</option>
            </select>
            <select id="flt-member" class="form-control">
              <option value="">Todos los miembros</option>
            </select>
            <input type="text" id="flt-query" class="form-control" placeholder="Buscar descripción o categoría" />
            <select id="flt-sort" class="form-control">
              <option value="date_desc">Fecha (recientes primero)</option>
              <option value="date_asc">Fecha (antiguos primero)</option>
              <option value="amount_desc">Importe (mayor a menor)</option>
              <option value="amount_asc">Importe (menor a mayor)</option>
            </select>
            <button id="apply-filters" class="btn"><i class="fas fa-filter"></i> Filtrar</button>
            <button id="clear-filters" class="btn"><i class="fas fa-broom"></i> Limpiar filtros</button>
            <button id="export-csv" class="btn"><i class="fas fa-file-csv"></i> Exportar CSV</button>
            <button id="toggle-advanced" class="btn"><i class="fas fa-sliders-h"></i> Filtros avanzados</button>
          </div>
          <div class="filters-advanced collapsed" id="filters-advanced">
            <input type="date" id="flt-start" class="form-control" placeholder="Desde" />
            <input type="date" id="flt-end" class="form-control" placeholder="Hasta" />
            <input type="text" id="flt-category" list="categories-list" class="form-control" placeholder="Categorías (separa por comas)" />
            <datalist id="categories-list"></datalist>
            <div id="flt-cat-chips" class="chips"></div>
            <button id="clear-categories" class="btn"><i class="fas fa-times"></i> Limpiar categorías</button>
          </div>
        </div>

        <form id="tx-add-form" class="tx-add-form">
          <div class="row">
            <input type="number" step="0.01" id="tx-amount" placeholder="Importe" required />
            <select id="tx-type" required>
              <option value="expense">Gasto</option>
              <option value="income">Ingreso</option>
              <option value="transfer">Transferencia</option>
              <option value="traspaso">Traspaso</option>
            </select>
            <select id="tx-category" class="form-control" required></select>
            <input type="text" id="tx-category-other" placeholder="Otra categoría" style="display:none;" />
            <input type="text" id="tx-subcategory" list="subcategories-list" placeholder="Subcategoría (ej. Fruta)" />
            <datalist id="subcategories-list"></datalist>
            <select id="tx-member" class="form-control">
              <option value="Todos">Todos</option>
            </select>
            <input type="text" id="tx-desc" placeholder="Descripción" />
            <button type="submit" class="btn btn-primary"><i class="fas fa-plus"></i> Añadir transacción</button>
          </div>
          
        </form>

        <div id="tx-list" class="tx-list">
          <div class="loading">Cargando transacciones...</div>
        </div>
      </section>
    `;

    // Inicializar selector de miembros (alta)
    const memberSelect = document.getElementById('tx-member');
    if (typeof FamilyManager !== 'undefined') {
      if (memberSelect) memberSelect.innerHTML = FamilyManager.generateMemberOptions('Todos');
    }

    // Inicializar filtros de miembro
    const memberFilter = document.getElementById('flt-member');
    if (memberFilter && typeof FamilyManager !== 'undefined') {
      const members = FamilyManager.getMembers();
      // Añadir opción explícita para filtrar por miembro "Todos" y mantener opción sin filtro
      memberFilter.innerHTML = '<option value="">Todos los miembros</option><option value="Todos">Todos</option>' + members.filter(m => m !== 'Todos').map(m => `<option value="${m}">${m}</option>`).join('');
    }
    // Alinear el sujeto por defecto del alta con el filtro activo (si existe)
    if (memberFilter) {
      const activeMember = memberFilter.value || 'Todos';
      if (memberSelect) {
        // Si el miembro activo existe como opción, seleccionarlo en el alta
        const opt = Array.from(memberSelect.options).find(o => o.value === activeMember);
        if (opt) memberSelect.value = activeMember; else memberSelect.value = 'Todos';
      }
      
    }

    // Inicializar autocompletado de categorías (filtros avanzados)
    initCategoryFilter();
    // Rellenar desplegable de categorías para alta rápida
    try {
      await populateCategorySelect(document.getElementById('tx-category'));
      const addCatSel = document.getElementById('tx-category');
      const addCatOther = document.getElementById('tx-category-other');
      const addSubcatInput = document.getElementById('tx-subcategory');
      const addSubcatList = document.getElementById('subcategories-list');
      if (addCatSel && addCatOther) {
        addCatSel.addEventListener('change', () => {
          if (addCatSel.value === '__other__') {
            addCatOther.style.display = '';
            addCatOther.focus();
            if (addSubcatList) addSubcatList.innerHTML = '';
          } else {
            addCatOther.style.display = 'none';
            addCatOther.value = '';
            // Actualizar sugerencias de subcategoría según la categoría
            if (addSubcatList) { populateSubcategoriesDatalist(addCatSel.value); }
          }
        });
      }
      // Inicializar sugerencias de subcategorías si hay categoría preseleccionada
      if (addCatSel && addSubcatList) { populateSubcategoriesDatalist(addCatSel.value); }
      
    } catch (_) {}

    // Inicializar chips de categorías
    initCategoryChips();

    // Alta rápida de transacción
    const form = document.getElementById('tx-add-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const amount = Number(document.getElementById('tx-amount').value);
        const type = document.getElementById('tx-type').value;
        let category = document.getElementById('tx-category').value || '';
        if (category === '__other__') {
          category = (document.getElementById('tx-category-other').value || '').trim();
        }
        category = category.trim() || 'Otros';
        const subcategory = (document.getElementById('tx-subcategory')?.value || '').trim();
        const member = document.getElementById('tx-member').value;
        const description = document.getElementById('tx-desc').value.trim();
        
        const tx = {
          id: 'trans_' + Date.now(),
          amount,
          type,
          category,
          subcategory: subcategory || undefined,
          member,
          description,
          date: new Date().toISOString().slice(0,10)
        };
        try {
          await DB.add('transactions', tx);
          if (typeof showNotification === 'function') {
            showNotification('Transacción añadida', 'success');
          }
          if (typeof UIManager !== 'undefined' && UIManager.showToast) {
            try { UIManager.showToast('Transacción añadida', 'success'); } catch (_) {}
          }
          // Aviso si los filtros activos pueden ocultar la transacción añadida
          try {
            const visible = getFilteredTransactions([tx]).length;
            const filtersActive = (
              (document.getElementById('flt-start')?.value || '') ||
              (document.getElementById('flt-end')?.value || '') ||
              (document.getElementById('flt-type')?.value || '') ||
              (document.getElementById('flt-member')?.value || '') ||
              (document.getElementById('flt-query')?.value || '') ||
              (getSelectedCategories() || []).length
            );
            if (!visible && filtersActive && typeof UIManager !== 'undefined') {
              UIManager.showToast('Hay filtros activos; puede que no veas la transacción añadida.', 'warning');
            }
          } catch (_) {}
          // Recargar listado y resumen
          renderTransactionsList();
          renderTransactionsSummary();
          initCategoryFilter();
          initCategoryChips();
          // Notificar alta para refrescar vistas de análisis si están activas
          try {
            window.dispatchEvent(new CustomEvent('transactions-changed', { detail: { reason: 'add', ids: [tx.id] } }));
          } catch (_) {}
        } catch (err) {
          console.error('No se pudo añadir la transacción', err);
          if (typeof showNotification === 'function') {
            showNotification('Error al añadir transacción', 'error');
          }
          if (typeof UIManager !== 'undefined' && UIManager.showToast) {
            try { UIManager.showToast('Error al añadir transacción', 'error'); } catch (_) {}
          }
          }
        form.reset();
      });
    }

    // Eliminado botón de añadir manual en la barra de herramientas

    // Botón borrar todo
    const deleteAllBtn = document.getElementById('tx-delete-all-btn');
    if (deleteAllBtn) {
      deleteAllBtn.addEventListener('click', async () => {
        const ok = confirm('¿Seguro que quieres borrar TODAS las transacciones? Esta acción no se puede deshacer.');
        if (!ok) return;
        try {
          if (typeof DB.clearStore === 'function') {
            await DB.clearStore('transactions');
          } else {
            const all = await DB.getAll('transactions');
            for (const t of all) {
              try { await DB.delete('transactions', t.id); } catch (_) {}
            }
          }
          UIManager.showToast('Transacciones borradas', 'success');
          renderTransactionsList();
          renderTransactionsSummary();
          initCategoryFilter();
          try {
            window.dispatchEvent(new CustomEvent('transactions-changed', { detail: { reason: 'delete-all' } }));
          } catch (_) {}
        } catch (e) {
          console.error('Error al borrar todas las transacciones:', e);
          UIManager.showToast('Error al borrar transacciones', 'error');
        }
      });
    }

    // Aplicar filtros
    const applyBtn = document.getElementById('apply-filters');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        applyAndSaveFilters();
      });
    }

    // Exportar CSV
    const exportBtn = document.getElementById('export-csv');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        exportFilteredTransactionsToCSV();
      });
    }

    // Limpiar categorías
    const clearCatsBtn = document.getElementById('clear-categories');
    if (clearCatsBtn) {
      clearCatsBtn.addEventListener('click', () => {
        const chips = document.getElementById('flt-cat-chips');
        if (chips) chips.innerHTML = '';
        document.getElementById('flt-category').value = '';
        applyAndSaveFilters();
      });
    }

    // Limpiar todos los filtros
    const clearAllBtn = document.getElementById('clear-filters');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => {
        const ids = ['flt-start','flt-end','flt-type','flt-member','flt-query'];
        ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        const chips = document.getElementById('flt-cat-chips');
        if (chips) chips.innerHTML = '';
        document.getElementById('flt-category').value = '';
        const sortEl = document.getElementById('flt-sort');
        if (sortEl) sortEl.value = 'date_desc';
        applyAndSaveFilters();
      });
    }

    // Autoaplicar cambios de filtros
    const autoIds = ['flt-start','flt-end','flt-type','flt-member'];
    autoIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', applyAndSaveFilters);
    });
    const queryEl = document.getElementById('flt-query');
    if (queryEl) queryEl.addEventListener('input', applyAndSaveFilters);

    // Autoaplicar cambio de orden
    const sortEl = document.getElementById('flt-sort');
    if (sortEl) sortEl.addEventListener('change', applyAndSaveFilters);

    // Toggle de filtros avanzados
    const toggleAdv = document.getElementById('toggle-advanced');
    const advBox = document.getElementById('filters-advanced');
    if (toggleAdv && advBox) {
      toggleAdv.addEventListener('click', () => {
        advBox.classList.toggle('collapsed');
        // Guardar estado del panel avanzado
        try {
          const data = JSON.parse(localStorage.getItem('txFilters') || '{}');
          data.advOpen = !advBox.classList.contains('collapsed');
          localStorage.setItem('txFilters', JSON.stringify(data));
        } catch (e) {}
      });
    }

  // Inicializar selección múltiple
  setupSelectionButtons();
  // Pintar listado inicialmente
  loadFilters();
  renderTransactionsList();
  renderTransactionsSummary();
  }

  // ===== Selección múltiple =====
  let selectionMode = false;
  const selectedIds = new Set();

  function setupSelectionButtons() {
    const toggleBtn = document.getElementById('tx-select-toggle');
    const selAllBtn = document.getElementById('tx-select-all');
    const editSelBtn = document.getElementById('tx-edit-selected');
    const delSelBtn = document.getElementById('tx-delete-selected');
    if (toggleBtn) toggleBtn.addEventListener('click', () => { selectionMode = !selectionMode; renderTransactionsList(); UIManager?.showToast && UIManager.showToast(selectionMode ? 'Modo selección activado' : 'Modo selección desactivado', 'info'); });
    if (selAllBtn) selAllBtn.addEventListener('click', async () => {
      if (!selectionMode) { UIManager?.showToast && UIManager.showToast('Activa la selección primero', 'warning'); return; }
      const list = await getAllTransactions();
      const filtered = getFilteredTransactions(list);
      filtered.forEach(t => selectedIds.add(t.id));
      renderTransactionsList();
    });
    if (editSelBtn) editSelBtn.addEventListener('click', () => { if (!selectionMode) { UIManager?.showToast && UIManager.showToast('Activa la selección primero', 'warning'); return; } openBulkEditModal(); });
    if (delSelBtn) delSelBtn.addEventListener('click', () => { if (!selectionMode) { UIManager?.showToast && UIManager.showToast('Activa la selección primero', 'warning'); return; } confirmDeleteSelected(); });
  }

  function clearSelection() { selectedIds.clear(); }

  async function openBulkEditModal() {
    const ids = Array.from(selectedIds);
    if (!ids.length) { UIManager?.showToast && UIManager.showToast('No hay elementos seleccionados', 'info'); return; }
    const memberOptions = (typeof FamilyManager !== 'undefined') ? FamilyManager.generateMemberOptions('') : '<option value="">(sin cambio)</option><option value="Todos">Sujeto</option>';
    const subOptions = await buildBulkSubcategoryOptions('');
    const content = `
      <form id="bulk-edit-form" class="form-grid">
        <label>Tipo</label>
        <select id="bulk-type" class="form-control">
          <option value="">(sin cambio)</option>
          <option value="expense">Gasto</option>
          <option value="income">Ingreso</option>
          <option value="transferencia">Transferencia</option>
          <option value="traspaso">Traspaso</option>
        </select>
        <label>Categoría</label>
        <select id="bulk-category" class="form-control"></select>
        <input type="text" id="bulk-category-other" class="form-control" placeholder="Otra categoría" style="display:none;" />
        <label>Subcategoría</label>
        <select id="bulk-subcategory" class="form-control">${subOptions}</select>
        <input type="text" id="bulk-subcategory-other" class="form-control" placeholder="Otra subcategoría" style="display:none;" />
        <label>Miembro</label>
        <select id="bulk-member" class="form-control">${memberOptions}</select>
      </form>
      <p class="help">Se aplicarán los cambios a ${ids.length} transacciones seleccionadas. Los campos en blanco no se modifican.</p>
    `;
    if (typeof showModal === 'function') {
      showModal({
        title: 'Editar seleccionados',
        content,
        size: 'medium',
        buttons: [
          { text: 'Cancelar', type: 'secondary', onClick: () => closeModal() },
          { text: 'Guardar', type: 'primary', onClick: async () => {
              const type = document.getElementById('bulk-type').value;
              const catSel = document.getElementById('bulk-category').value;
              const category = catSel === '__other__' ? (document.getElementById('bulk-category-other').value || '').trim() : (catSel || '').trim();
              const subSel = document.getElementById('bulk-subcategory').value;
              const subOther = (document.getElementById('bulk-subcategory-other').value || '').trim();
              const subcategory = (subSel === '__other_sub__' ? subOther : (subSel || '')).trim();
              const member = document.getElementById('bulk-member').value;
              await applyBulkEdit({ type: type || null, category: category || null, subcategory: subcategory || null, member: member || null });
              closeModal();
            } }
        ]
      });
      // Poblar categorías y manejar "Otra…" + subcategorías vinculadas
      const catSelEl = document.getElementById('bulk-category');
      const catOtherEl = document.getElementById('bulk-category-other');
      if (catSelEl) {
        try {
          await populateCategorySelect(catSelEl);
          // Usar vacío como "(sin cambio)"
          catSelEl.value = '';
          if (catOtherEl) { catOtherEl.style.display = 'none'; catOtherEl.value = ''; }
        } catch (_) {}
        const refreshBulkSubs = async () => {
          const val = catSelEl.value === '__other__' ? (catOtherEl?.value || '').trim() : (catSelEl.value || '').trim();
          const opts = await buildBulkSubcategoryOptions(val);
          const subSelEl = document.getElementById('bulk-subcategory');
          if (subSelEl) {
            subSelEl.innerHTML = opts;
            const subOtherEl = document.getElementById('bulk-subcategory-other');
            if (subOtherEl) { subOtherEl.style.display = 'none'; subOtherEl.value = ''; }
            subSelEl.value = '';
          }
        };
        // Inicial
        await refreshBulkSubs();
        // Cambios
        catSelEl.addEventListener('change', async () => {
          if (catSelEl.value === '__other__') {
            if (catOtherEl) { catOtherEl.style.display = ''; catOtherEl.focus(); }
          } else {
            if (catOtherEl) { catOtherEl.style.display = 'none'; catOtherEl.value = ''; }
          }
          await refreshBulkSubs();
        });
        if (catOtherEl) catOtherEl.addEventListener('input', refreshBulkSubs);
        // Mostrar input "Otra subcategoría" al seleccionar la opción
        const bulkSubSel = document.getElementById('bulk-subcategory');
        const bulkSubOther = document.getElementById('bulk-subcategory-other');
        if (bulkSubSel && bulkSubOther) {
          bulkSubSel.addEventListener('change', () => {
            if (bulkSubSel.value === '__other_sub__') {
              bulkSubOther.style.display = '';
              bulkSubOther.focus();
            } else {
              bulkSubOther.style.display = 'none';
              bulkSubOther.value = '';
            }
          });
        }
      }
    } else {
      const ok = confirm(`Aplicar cambios a ${ids.length} transacciones?`);
      if (ok) await applyBulkEdit({ type: null, category: null, subcategory: null, member: null });
    }
  }

  async function applyBulkEdit(changes) {
    const ids = Array.from(selectedIds);
    let updated = 0;
    for (const id of ids) {
      try {
        const tx = await DB.get('transactions', id);
        if (!tx) continue;
        const next = { ...tx };
        if (changes.type) next.type = changes.type;
        if (changes.category) next.category = changes.category;
        if (changes.subcategory) next.subcategory = changes.subcategory;
        if (changes.member !== null && changes.member !== undefined && changes.member !== '') next.member = changes.member;
        next.updated_at = new Date().toISOString();
        await DB.add('transactions', next);
        updated++;
      } catch (e) { console.error('Error editando selección', e); }
    }
    UIManager?.showToast && UIManager.showToast(`Se actualizaron ${updated} transacciones`, 'success');
    clearSelection();
    renderTransactionsList();
    renderTransactionsSummary();
    // Notificar a vistas de análisis que hubo cambios en transacciones
    try {
      window.dispatchEvent(new CustomEvent('transactions-changed', { detail: { reason: 'bulk-edit', ids } }));
    } catch (_) {}
  }

  async function buildBulkSubcategoryOptions(categoryInput) {
    // Construye opciones de subcategoría combinando las presentes en seleccionados y las por defecto
    const ids = Array.from(selectedIds);
    const all = await getAllTransactions();
    const selectedTxs = all.filter(t => ids.includes(t.id));
    const catNorm = (categoryInput||'').toString().trim().toLowerCase();
    const defaults = (typeof DEFAULT_SUBCATEGORIES !== 'undefined' && DEFAULT_SUBCATEGORIES[catNorm]) ? DEFAULT_SUBCATEGORIES[catNorm] : [];
    const fromData = new Set();
    selectedTxs.forEach(t => {
      const cat = (t.category||'').toString().trim().toLowerCase();
      if (!categoryInput || !catNorm || cat === catNorm) {
        fromData.add(t.subcategory || 'Sin subcategoría');
      }
    });
    const union = Array.from(new Set([].concat(Array.from(fromData), defaults))).sort((a,b)=> a.localeCompare(b, 'es', { sensitivity:'base' }));
    const opts = ['<option value="">(sin cambio)</option>']
      .concat(union.map(s => `<option value="${s}">${s}</option>`))
      .concat(['<option value="__other_sub__">Otra…</option>']);
    return opts.join('');
  }

  async function confirmDeleteSelected() {
    const ids = Array.from(selectedIds);
    if (!ids.length) { UIManager?.showToast && UIManager.showToast('No hay elementos seleccionados', 'info'); return; }
    const proceed = async () => {
      let removed = 0;
      for (const id of ids) {
        try { await DB.delete('transactions', id); removed++; } catch (_) {}
      }
      UIManager?.showToast && UIManager.showToast(`Eliminadas ${removed} transacciones`, 'success');
      clearSelection();
      renderTransactionsList();
      renderTransactionsSummary();
      try {
        window.dispatchEvent(new CustomEvent('transactions-changed', { detail: { reason: 'bulk-delete', ids } }));
      } catch (_) {}
    };
    if (typeof showModal === 'function') {
      showModal({
        title: 'Eliminar seleccionados',
        content: `<p>¿Seguro que deseas eliminar ${ids.length} transacciones seleccionadas?</p>`,
        size: 'small',
        buttons: [
          { text: 'Cancelar', type: 'secondary', onClick: () => closeModal() },
          { text: 'Eliminar', type: 'danger', onClick: async () => { await proceed(); closeModal(); } }
        ]
      });
    } else {
      if (confirm(`Eliminar ${ids.length} transacciones seleccionadas?`)) await proceed();
    }
  }

  async function renderTransactionsList() {
    const list = await getAllTransactions();
    const wrap = document.getElementById('tx-list');
    if (!wrap) return;
    const filtered = getFilteredTransactions(list);
    if (!filtered.length) {
      wrap.innerHTML = `<p class="empty-state">No hay transacciones registradas.</p>`;
      return;
    }
    const sortOpt = (document.getElementById('flt-sort')?.value) || 'date_desc';
    const sorted = filtered.slice().sort((a, b) => {
      switch (sortOpt) {
        case 'date_asc':
          return new Date(a.date) - new Date(b.date);
        case 'amount_desc':
          return (Number(b.amount) || 0) - (Number(a.amount) || 0);
        case 'amount_asc':
          return (Number(a.amount) || 0) - (Number(b.amount) || 0);
        case 'date_desc':
        default:
          return new Date(b.date) - new Date(a.date);
      }
    });
    wrap.innerHTML = sorted
      .map((t) => {
        const date = t.date ? new Date(t.date).toLocaleDateString('es-ES') : '-';
        const cat = t.category || 'Sin categoría';
        const desc = t.description || t.concept || '';
        const amt = formatAmount(t.amount);
        const rawType = (t.type || t.kind);
        const sign = rawType === 'expense' ? '-' : (rawType === 'income' ? '+' : '');
        const chk = selectionMode ? `<input type="checkbox" class="tx-select" ${selectedIds.has(t.id)?'checked':''} data-id="${t.id}" title="Seleccionar" />` : '';
        return `
          <div class="tx-item" data-id="${t.id}">
            <div>
              <div class="tx-head">
                <span class="tx-date"><i class="fas fa-calendar-day"></i> ${date}</span>
                <span class="tx-amount ${sign === '-' ? 'neg' : 'pos'}">${sign}${amt}</span>
              </div>
              <div class="tx-body">
                ${chk}
                <span class="chip category"><i class="fas fa-tag"></i> ${cat}</span>
                ${t.subcategory ? `<span class="chip subcategory"><i class="fas fa-tags"></i> ${t.subcategory}</span>` : ''}
                ${t.member ? `<span class="chip member ${getMemberClass(t.member)}"><i class="fas fa-user"></i> ${t.member}</span>` : ''}
                <span class="tx-desc">${desc}</span>
              </div>
            </div>
            <div class="tx-actions">
              <button class="btn" data-action="edit"><i class="fas fa-pen"></i> Editar</button>
              <button class="btn" data-action="delete"><i class="fas fa-trash"></i> Eliminar</button>
            </div>
          </div>
        `;
      })
      .join('');

    // Acciones de editar/eliminar
    wrap.querySelectorAll('.tx-item .tx-actions button').forEach((btn) => {
      const parent = btn.closest('.tx-item');
      const id = parent?.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      if (!id) return;
      btn.addEventListener('click', () => {
        if (action === 'edit') {
          showEditTransactionModal(id);
        } else if (action === 'delete') {
          confirmDeleteTransaction(id);
        }
      });
    });

    // Selección de checkboxes
    wrap.querySelectorAll('input.tx-select').forEach((chk) => {
      chk.addEventListener('change', () => {
        const id = chk.getAttribute('data-id');
        if (!id) return;
        if (chk.checked) selectedIds.add(id);
        else selectedIds.delete(id);
      });
    });
  }

  function getFilteredTransactions(list) {
    const startVal = document.getElementById('flt-start')?.value || '';
    const endVal = document.getElementById('flt-end')?.value || '';
    const typeVal = document.getElementById('flt-type')?.value || '';
    const memberVal = document.getElementById('flt-member')?.value || '';
    const categoriesVal = (document.getElementById('flt-category')?.value || '').toLowerCase();
    const queryVal = (document.getElementById('flt-query')?.value || '').toLowerCase();

    const start = startVal ? new Date(startVal) : null;
    const end = endVal ? new Date(endVal) : null;
    let wantedCats = getSelectedCategories();
    if (!wantedCats.length) {
      wantedCats = categoriesVal
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    }

    return list.filter(t => {
      const d = new Date(t.date);
      // Excluir financiaciones SIEMPRE en pestaña Transacciones
      const catLower = (t.category || '').toLowerCase();
      const isLoanCategory = catLower.includes('préstamo') || catLower.includes('prestamo') || catLower.includes('préstamos') || catLower.includes('prestamos');
      if (t.loanId || isLoanCategory) return false;
      if (start && d < start) return false;
      if (end && d > end) return false;
      if (typeVal && (t.type || t.kind) !== typeVal) return false;
      // Si el filtro de miembro está en "Todos", no filtrar
      if (memberVal && memberVal !== 'Todos' && t.member !== memberVal) return false;
      if (wantedCats.length) {
        const cat = (t.category || '').toLowerCase();
        if (!wantedCats.includes(cat)) return false;
      }
      if (queryVal) {
        const text = `${t.description || ''} ${t.category || ''} ${t.subcategory || ''}`.toLowerCase();
        if (!text.includes(queryVal)) return false;
      }
      return true;
    });
  }

  async function renderTransactionsSummary() {
    const list = await getAllTransactions();
    const filtered = getFilteredTransactions(list);
    const income = filtered.filter(t => (t.type || t.kind) === 'income').reduce((s,t) => s + (Number(t.amount)||0), 0);
    const expense = filtered.filter(t => (t.type || t.kind) === 'expense').reduce((s,t) => s + (Number(t.amount)||0), 0);
    const balance = income - expense;

    const elIncome = document.getElementById('sum-income');
    const elExpense = document.getElementById('sum-expense');
    const elBalance = document.getElementById('sum-balance');
    const elCount = document.getElementById('sum-count');
    if (elIncome) elIncome.textContent = formatAmount(income);
    if (elExpense) elExpense.textContent = formatAmount(expense);
    if (elBalance) elBalance.textContent = formatAmount(balance);
    if (elCount) elCount.textContent = String(filtered.length);
  }

  const DEFAULT_CATEGORIES = [
    // Gastos principales
    'Vivienda','Alimentación','Transporte','Salud','Educación','Ocio','Tecnología','Ropa','Mascotas','Regalos',
    'Impuestos','Seguros','Banco','Suscripciones','Otros',
    // Detalles frecuentes
    'Supermercado','Frutas y verduras','Lácteos','Carnes','Pescados','Panadería','Bebidas','Congelados',
    'Suministros','Luz','Agua','Gas','Internet','Telefonía','Mantenimiento','Reparaciones','Electrodomésticos',
    'Gasolina','Parking','Peajes','Taxis','Vehículo','Seguro coche',
    'Farmacia','Médico','Dental','Óptica',
    'Colegio','Universidad','Libros','Material escolar',
    'Restauración','Cine','Música','Deporte','Gimnasio','Viajes','Hotel','Vuelos',
    'Electrónica','Informática',
    'Calzado',
    'Comisiones','Streaming',
    // Ingresos comunes
    'Sueldo','Freelance','Venta','Intereses','Dividendos','Reembolso','Devolución','Alquiler recibido','Regalos recibidos'
  ];

  // Subcategorías por defecto: claves en minúsculas para coincidencia robusta
  const DEFAULT_SUBCATEGORIES = {
    'vivienda': ['Alquiler','Hipoteca','Comunidad','IBI','Basura','Reformas','Muebles'],
    'alimentación': ['Supermercado','Frutería','Carnicería','Panadería','Bebidas','Takeaway'],
    'supermercado': ['Despensa','Limpieza','Higiene','Bebidas','Frescos'],
    'frutas y verduras': ['Frutería','Mercado','Orgánico'],
    'lácteos': ['Leche','Yogur','Queso','Mantequilla'],
    'carnes': ['Vacuno','Pollo','Cerdo','Pavo'],
    'pescados': ['Blanco','Azul','Marisco'],
    'panadería': ['Pan','Bollería','Pasteles'],
    'bebidas': ['Agua','Refrescos','Zumos','Cerveza','Vino'],
    'congelados': ['Verduras','Carne','Pescado','Preparados'],
    'suministros': ['Luz','Agua','Gas','Internet','Telefonía'],
    'luz': ['Electricidad','Tarifa','Potencia'],
    'agua': ['Consumo','Alcantarillado'],
    'gas': ['Consumo','Revisión'],
    'internet': ['Fibra','Router','Operador'],
    'telefonía': ['Móvil','Fijo','Datos'],
    'mantenimiento': ['Hogar','Electrodomésticos','Fontanería','Electricidad'],
    'reparaciones': ['Hogar','Electrodomésticos','Vehículo'],
    'electrodomésticos': ['Cocina','Limpieza','Climatización'],
    'transporte': ['Gasolina','Parking','Peajes','Taxis','Transporte público'],
    'gasolina': ['95','98','Diésel'],
    'vehículo': ['Mantenimiento','ITV','Impuestos','Seguro coche'],
    'seguro coche': ['Terceros','Todo riesgo','Franquicia'],
    'salud': ['Farmacia','Médico','Dental','Óptica','Seguro salud'],
    'farmacia': ['Medicamentos','Parafarmacia'],
    'médico': ['General','Especialista','Pruebas'],
    'dental': ['Revisión','Ortodoncia','Empastes'],
    'óptica': ['Gafas','Lentillas'],
    'educación': ['Colegio','Universidad','Cursos','Libros','Material escolar'],
    'ocio': ['Restauración','Cine','Música','Deporte','Gimnasio','Viajes'],
    'restauración': ['Restaurantes','Bares','Cafeterías','Comida rápida'],
    'cine': ['Entradas','Streaming'],
    'música': ['Conciertos','Suscripciones'],
    'deporte': ['Gimnasio','Material deportivo','Clases'],
    'gimnasio': ['Cuota','Clases'],
    'viajes': ['Hotel','Vuelos','Tren','Alquiler coche'],
    'tecnología': ['Electrónica','Informática','Accesorios'],
    'electrónica': ['Móviles','TV','Audio'],
    'informática': ['Ordenadores','Periféricos','Software'],
    'ropa': ['Hombre','Mujer','Niños'],
    'calzado': ['Hombre','Mujer','Niños'],
    'mascotas': ['Comida','Veterinario','Accesorios'],
    'regalos': ['Cumpleaños','Navidad','Eventos'],
    'impuestos': ['IRPF','IVA','IAE','Tasas'],
    'seguros': ['Hogar','Vida','Salud','Coche'],
    'banco': ['Comisiones','Gastos financieros'],
    'comisiones': ['Mantenimiento','Transferencias','Tarjetas'],
    'suscripciones': ['Streaming','Software','Servicios'],
    'streaming': ['Netflix','Amazon','Spotify','Disney+'],
    'otros': ['Varios','Imprevistos'],
    // Ingresos
    'sueldo': ['Nómina','Bonus','Horas extra'],
    'freelance': ['Proyectos','Adelantos'],
    'venta': ['Objetos','Segunda mano','Marketplace'],
    'intereses': ['Cuentas','Depósitos','Bonos'],
    'dividendos': ['Acciones','Fondos'],
    'reembolso': ['Gastos devueltos','Reintegros'],
    'devolución': ['Compras devueltas'],
    'alquiler recibido': ['Mensualidad','Fianza'],
    'regalos recibidos': ['Familia','Amigos']
  };

  async function getCategoriesMasterList() {
    const list = await getAllTransactions();
    const fromData = Array.from(new Set(
      list
        .map(t => (t.category || '').trim())
        .filter(Boolean)
        .filter(c => {
          const lc = c.toLowerCase();
          return !(lc.includes('préstamo') || lc.includes('prestamo'));
        })
    ));
    const union = Array.from(new Set([].concat(DEFAULT_CATEGORIES, fromData)));
    return union.sort((a,b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }

  // Subcategorías: utilidades
  async function getSubcategoriesForCategory(category) {
    try {
      const list = await getAllTransactions();
      const norm = (category || '').trim().toLowerCase();
      const subs = Array.from(new Set(
        list
          .filter(t => ((t.category || '').trim().toLowerCase() === norm))
          .map(t => (t.subcategory || '').trim())
          .filter(Boolean)
      ));
      const defaults = DEFAULT_SUBCATEGORIES[norm] || [];
      const union = Array.from(new Set([].concat(subs, defaults)));
      return union.sort((a,b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    } catch (_) {
      const norm = (category || '').trim().toLowerCase();
      return (DEFAULT_SUBCATEGORIES[norm] || []);
    }
  }

  async function populateSubcategoriesDatalist(category) {
    const dl = document.getElementById('subcategories-list');
    if (!dl) return;
    const subs = await getSubcategoriesForCategory(category);
    dl.innerHTML = subs.map(s => `<option value="${s}"></option>`).join('');
  }

  // Rellena un <select> de subcategorías para una categoría dada y añade "Otra…"
  async function populateSubcategorySelect(selectEl, category) {
    if (!selectEl) return;
    try {
      const subs = await getSubcategoriesForCategory(category);
      const html = ['<option value="">(sin subcategoría)</option>']
        .concat(subs.map(s => `<option value="${s}">${s}</option>`))
        .concat(['<option value="__other_sub__">Otra…</option>'])
        .join('');
      selectEl.innerHTML = html;
    } catch (e) {
      selectEl.innerHTML = '<option value="">(sin subcategoría)</option><option value="__other_sub__">Otra…</option>';
    }
  }

  // Rellena un <select> con la lista de categorías y añade opción "Otra…"
  async function populateCategorySelect(selectEl) {
    if (!selectEl) return;
    try {
      const cats = await getCategoriesMasterList();
      const html = ['<option value="">Selecciona categoría</option>']
        .concat(cats.map(c => `<option value="${c}">${c}</option>`))
        .concat(['<option value="__other__">Otra…</option>'])
        .join('');
      selectEl.innerHTML = html;
    } catch (e) {
      selectEl.innerHTML = '<option value="">Selecciona categoría</option><option value="__other__">Otra…</option>';
    }
  }

  async function initCategoryFilter() {
    const dataList = document.getElementById('categories-list');
    if (!dataList) return;
    const cats = await getCategoriesMasterList();
    dataList.innerHTML = cats.map(c => `<option value="${c}"></option>`).join('');
  }

  function initCategoryChips() {
    const input = document.getElementById('flt-category');
    const chipsWrap = document.getElementById('flt-cat-chips');
    if (!input || !chipsWrap) return;
    // Añadir chip al pulsar Enter o coma
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = (input.value || '').trim();
        if (val) addCategoryChip(val);
        input.value = '';
      }
    });
    // Añadir chip al salir si hay texto
    input.addEventListener('blur', () => {
      const val = (input.value || '').trim();
      if (val) addCategoryChip(val);
      input.value = '';
    });
  }

  function addCategoryChip(name) {
    const chipsWrap = document.getElementById('flt-cat-chips');
    if (!chipsWrap) return;
    const norm = name.trim();
    if (!norm) return;
    const exists = Array.from(chipsWrap.querySelectorAll('.chip')).some(ch => (ch.dataset.value || ch.textContent).toLowerCase() === norm.toLowerCase());
    if (exists) return;
    const chip = document.createElement('span');
    chip.className = 'chip selectable selected';
    chip.textContent = norm;
    chip.dataset.value = norm;
    chip.title = 'Click para quitar';
    chip.addEventListener('click', () => {
      chip.remove();
      applyAndSaveFilters();
    });
    chipsWrap.appendChild(chip);
    applyAndSaveFilters();
  }

  function getSelectedCategories() {
    const chipsWrap = document.getElementById('flt-cat-chips');
    if (!chipsWrap) return [];
    return Array.from(chipsWrap.querySelectorAll('.chip')).map(ch => (ch.dataset.value || ch.textContent).toLowerCase()).filter(Boolean);
  }

  async function exportFilteredTransactionsToCSV() {
    const list = await getAllTransactions();
    const filtered = getFilteredTransactions(list);
    const header = ['date','type','category','member','description','amount'];
    const rows = filtered.map(t => [
      formatDateForCSV(t.date),
      t.type || t.kind || '',
      t.category || '',
      t.member || '',
      t.description || t.concept || '',
      String(t.amount ?? '')
    ]);
    const csv = [header].concat(rows).map(r => r.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transacciones_filtradas.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  }

  function csvEscape(val) {
    const s = String(val ?? '');
    const escaped = s.replace(/"/g, '""');
    return '"' + escaped + '"';
  }

  function formatDateForCSV(date) {
    try {
      const d = new Date(date);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    } catch (e) {
      return '';
    }
  }

  function applyAndSaveFilters() {
    saveFilters();
    renderTransactionsList();
    renderTransactionsSummary();
  }

  function saveFilters() {
    const data = {
      start: document.getElementById('flt-start')?.value || '',
      end: document.getElementById('flt-end')?.value || '',
      type: document.getElementById('flt-type')?.value || '',
      member: document.getElementById('flt-member')?.value || '',
      query: document.getElementById('flt-query')?.value || '',
      categories: getSelectedCategories(),
      sort: document.getElementById('flt-sort')?.value || 'date_desc',
      advOpen: !document.getElementById('filters-advanced')?.classList.contains('collapsed')
    };
    try {
      localStorage.setItem('txFilters', JSON.stringify(data));
    } catch (e) {}
  }

  function loadFilters() {
    let data = null;
    try {
      data = JSON.parse(localStorage.getItem('txFilters') || 'null');
    } catch (e) {}
    if (!data) return;
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
    setVal('flt-start', data.start);
    setVal('flt-end', data.end);
    setVal('flt-type', data.type);
    setVal('flt-member', data.member);
    setVal('flt-query', data.query);
    setVal('flt-sort', data.sort || 'date_desc');
    const advBox = document.getElementById('filters-advanced');
    if (advBox) {
      const open = !!data.advOpen;
      advBox.classList.toggle('collapsed', !open);
    }
    const cats = Array.isArray(data.categories) ? data.categories : [];
    cats.forEach(c => addCategoryChip(c));
  }

  // Modal para editar transacción
  async function showEditTransactionModal(id) {
    try {
      const tx = await DB.get('transactions', id);
      if (!tx) return;
      const currentDate = tx.date ? String(tx.date).slice(0, 10) : new Date().toISOString().slice(0, 10);
          const content = `
        <form id="tx-edit-form" class="tx-edit-form">
          <div class="row">
            <input type="date" id="edit-date" value="${currentDate}" required />
            <input type="number" step="0.01" id="edit-amount" value="${Number(tx.amount) || 0}" required />
            <select id="edit-type" required>
              <option value="expense" ${ (tx.type||tx.kind) === 'expense' ? 'selected' : '' }>Gasto</option>
              <option value="income" ${ (tx.type||tx.kind) === 'income' ? 'selected' : '' }>Ingreso</option>
              <option value="transferencia" ${ (tx.type||tx.kind) === 'transferencia' ? 'selected' : '' }>Transferencia</option>
              <option value="traspaso" ${ (tx.type||tx.kind) === 'traspaso' ? 'selected' : '' }>Traspaso</option>
            </select>
          </div>
          <div class="row">
            <select id="edit-category" class="form-control" required></select>
            <input type="text" id="edit-category-other" placeholder="Otra categoría" style="display:none;" />
            <select id="edit-subcategory" class="form-control"></select>
            <input type="text" id="edit-subcategory-other" placeholder="Otra subcategoría" style="display:none;" />
            <select id="edit-member" class="form-control">
              ${typeof FamilyManager !== 'undefined' ? FamilyManager.generateMemberOptions(tx.member || 'Todos') : '<option value="Todos">Todos</option>'}
            </select>
            <input type="text" id="edit-desc" value="${tx.description || tx.concept || ''}" placeholder="Descripción" />
          </div>
          <hr />
          <div class="row">
            <label for="edit-split" class="form-label">Dividir en 2</label>
            <input type="checkbox" id="edit-split" />
          </div>
          <div id="edit-split-section" style="display:none;">
            <div class="row">
              <input type="number" step="0.01" id="edit-amount2" value="" placeholder="Cantidad parte 2" />
              <select id="edit-member2" class="form-control">
                ${typeof FamilyManager !== 'undefined' ? FamilyManager.generateMemberOptions(tx.member || 'Todos') : '<option value="Todos">Todos</option>'}
              </select>
            </div>
            <div class="row">
              <select id="edit-category2" class="form-control"></select>
              <input type="text" id="edit-category2-other" placeholder="Otra categoría (parte 2)" style="display:none;" />
              <select id="edit-subcategory2" class="form-control"></select>
              <input type="text" id="edit-subcategory2-other" placeholder="Otra subcategoría (parte 2)" style="display:none;" />
            </div>
          </div>
        </form>
      `;
      if (typeof showModal === 'function') {
        showModal({
          title: 'Editar transacción',
          content,
          size: 'medium',
          buttons: [
            { text: 'Cancelar', type: 'secondary', onClick: () => closeModal() },
            { text: 'Guardar', type: 'primary', onClick: async () => {
                const totalAmount = Number(document.getElementById('edit-amount').value) || 0;
                const type = document.getElementById('edit-type').value;
                const member1 = document.getElementById('edit-member').value;
                const catSel1 = document.getElementById('edit-category').value;
                const category1 = catSel1 === '__other__' ? (document.getElementById('edit-category-other').value || '').trim() : (catSel1 || '').trim();
                const desc = document.getElementById('edit-desc').value.trim();
                const dateVal = document.getElementById('edit-date').value;
                const doSplit = !!document.getElementById('edit-split').checked;
                if (!doSplit) {
                  const subSel1 = document.getElementById('edit-subcategory').value;
                  const subOther1 = (document.getElementById('edit-subcategory-other').value || '').trim();
                  const subVal1 = (subSel1 === '__other_sub__' ? subOther1 : (subSel1 || '')).trim();
                  const updated = {
                    ...tx,
                    id: tx.id,
                    date: dateVal,
                    amount: totalAmount,
                    type,
                    category: category1,
                    subcategory: subVal1 || undefined,
                    member: member1,
                    description: desc,
                    updated_at: new Date().toISOString()
                  };
                  try {
                    await DB.add('transactions', updated);
                    if (typeof showNotification === 'function') showNotification('Transacción actualizada', 'success');
                  } catch (err) {
                    console.error('Error actualizando transacción', err);
                    if (typeof showNotification === 'function') showNotification('Error al actualizar', 'error');
                  }
                  closeModal();
                  renderTransactionsList();
                  try { window.dispatchEvent(new CustomEvent('transactions-changed', { detail: { reason: 'edit', ids: [tx.id] } })); } catch (_) {}
                  return;
                }
                // División en dos
                const amount2 = Number(document.getElementById('edit-amount2').value) || 0;
                if (!(amount2 > 0 && amount2 < totalAmount)) {
                  if (typeof showNotification === 'function') showNotification('Indica una cantidad válida para la parte 2', 'warning');
                  return;
                }
                const amount1 = totalAmount - amount2;
                const member2 = document.getElementById('edit-member2').value || member1;
                const catSel2 = document.getElementById('edit-category2').value;
                const category2 = catSel2 === '__other__' ? (document.getElementById('edit-category2-other').value || '').trim() : (catSel2 || '').trim();
                const subSel1 = document.getElementById('edit-subcategory').value;
                const subOther1 = (document.getElementById('edit-subcategory-other').value || '').trim();
                const subcategory1 = (subSel1 === '__other_sub__' ? subOther1 : (subSel1 || '')).trim();
                const subSel2 = document.getElementById('edit-subcategory2').value;
                const subOther2 = (document.getElementById('edit-subcategory2-other').value || '').trim();
                const subVal2 = (subSel2 === '__other_sub__' ? subOther2 : (subSel2 || '')).trim();
                const subcategory2 = subVal2 || subcategory1;
                const base = {
                  date: dateVal,
                  type,
                  description: desc,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                };
                const new1 = { ...base, id: 'trans_' + Date.now() + '_' + Math.random().toString(16).slice(2), amount: amount1, category: category1, subcategory: subcategory1 || undefined, member: member1 };
                const new2 = { ...base, id: 'trans_' + Date.now() + '_' + Math.random().toString(16).slice(2), amount: amount2, category: category2 || category1, subcategory: subcategory2 || undefined, member: member2 };
                try {
                  await DB.delete('transactions', tx.id);
                } catch (_) {}
                try {
                  await DB.add('transactions', new1);
                  await DB.add('transactions', new2);
                  if (typeof showNotification === 'function') showNotification('Transacción dividida en dos', 'success');
                  // Aviso si los filtros activos pueden ocultar las nuevas transacciones
                  try {
                    const visible = getFilteredTransactions([new1, new2]).length;
                    const filtersActive = (
                      (document.getElementById('flt-start')?.value || '') ||
                      (document.getElementById('flt-end')?.value || '') ||
                      (document.getElementById('flt-type')?.value || '') ||
                      (document.getElementById('flt-member')?.value || '') ||
                      (document.getElementById('flt-query')?.value || '') ||
                      (getSelectedCategories() || []).length
                    );
                    if (!visible && filtersActive && typeof UIManager !== 'undefined' && UIManager.showToast) {
                      try { UIManager.showToast('Hay filtros activos; puede que no veas las transacciones creadas al dividir.', 'warning'); } catch (_) {}
                    }
                  } catch (_) {}
                } catch (err) {
                  console.error('Error al dividir transacción', err);
                  if (typeof showNotification === 'function') showNotification('Error al guardar división', 'error');
                }
                closeModal();
                renderTransactionsList();
                try { window.dispatchEvent(new CustomEvent('transactions-changed', { detail: { reason: 'split', ids: [tx.id, new1.id, new2.id] } })); } catch (_) {}
              }
            }
          ]
        });
        // Rellenar desplegable y estado de "Otra..." en el modal ya renderizado
        try {
          const sel = document.getElementById('edit-category');
          const other = document.getElementById('edit-category-other');
          const splitChk = document.getElementById('edit-split');
          const splitSection = document.getElementById('edit-split-section');
          if (sel) {
            await populateCategorySelect(sel);
            const catsList = await getCategoriesMasterList();
            const currentCat = (tx.category || '').trim();
            if (currentCat && catsList.includes(currentCat)) {
              sel.value = currentCat;
              if (other) { other.style.display = 'none'; other.value = ''; }
            } else {
              sel.value = '__other__';
              if (other) { other.style.display = ''; other.value = currentCat; }
            }
            // Subcategorías: poblar select y manejar "Otra…"
            try {
              const subSel = document.getElementById('edit-subcategory');
              const subOther = document.getElementById('edit-subcategory-other');
              const refreshSubcats = async () => {
                const catVal = sel.value === '__other__' ? (other.value || '').trim() : (sel.value || '').trim();
                await populateSubcategorySelect(subSel, catVal);
                const currentSub = (tx.subcategory || '').trim();
                const subs = await getSubcategoriesForCategory(catVal);
                if (currentSub && subs.includes(currentSub)) {
                  subSel.value = currentSub;
                  if (subOther) { subOther.style.display = 'none'; subOther.value = ''; }
                } else if (currentSub) {
                  subSel.value = '__other_sub__';
                  if (subOther) { subOther.style.display = ''; subOther.value = currentSub; }
                } else {
                  subSel.value = '';
                  if (subOther) { subOther.style.display = 'none'; subOther.value = ''; }
                }
              };
              await refreshSubcats();
              if (sel && other) {
                sel.addEventListener('change', refreshSubcats);
                other.addEventListener('input', refreshSubcats);
              }
              if (subSel && subOther) {
                subSel.addEventListener('change', () => {
                  if (subSel.value === '__other_sub__') {
                    subOther.style.display = '';
                    subOther.focus();
                  } else {
                    subOther.style.display = 'none';
                    subOther.value = '';
                  }
                });
              }
            } catch (_) {}
            if (sel && other) {
              sel.addEventListener('change', () => {
                if (sel.value === '__other__') {
                  other.style.display = '';
                  other.focus();
                } else {
                  other.style.display = 'none';
                  other.value = '';
                }
              });
            }
            // Inicializar sección de división
            if (splitChk && splitSection) {
              splitChk.addEventListener('change', () => {
                splitSection.style.display = splitChk.checked ? '' : 'none';
              });
            }
            // Rellenar categoría 2 y su comportamiento "Otra…"
            const sel2 = document.getElementById('edit-category2');
            const other2 = document.getElementById('edit-category2-other');
            if (sel2) {
              await populateCategorySelect(sel2);
              sel2.value = '';
              if (sel2 && other2) {
                sel2.addEventListener('change', () => {
                  if (sel2.value === '__other__') {
                    other2.style.display = '';
                    other2.focus();
                  } else {
                    other2.style.display = 'none';
                    other2.value = '';
                  }
                });
              }
              // Subcategorías parte 2: poblar select y manejar "Otra…"
              try {
                const subSel2 = document.getElementById('edit-subcategory2');
                const subOther2 = document.getElementById('edit-subcategory2-other');
                const refreshSubcats2 = async () => {
                  const catVal2 = sel2.value === '__other__' ? (other2.value || '').trim() : (sel2.value || '').trim();
                  await populateSubcategorySelect(subSel2, catVal2);
                  subSel2.value = '';
                  if (subOther2) { subOther2.style.display = 'none'; subOther2.value = ''; }
                };
                await refreshSubcats2();
                sel2.addEventListener('change', refreshSubcats2);
                if (other2) other2.addEventListener('input', refreshSubcats2);
                if (subSel2 && subOther2) {
                  subSel2.addEventListener('change', () => {
                    if (subSel2.value === '__other_sub__') {
                      subOther2.style.display = '';
                      subOther2.focus();
                    } else {
                      subOther2.style.display = 'none';
                      subOther2.value = '';
                    }
                  });
                }
              } catch (_) {}
            }
          }
        } catch (_) {}
      } else {
        // Fallback simple
        const ok = confirm('Guardar cambios en la transacción?');
        if (ok) {
          const updated = { ...tx, updated_at: new Date().toISOString() };
          await DB.add('transactions', updated);
          renderTransactionsList();
        }
      }
    } catch (e) {
      console.error('No se pudo cargar la transacción para editar', e);
    }
  }

  // Confirmación para eliminar transacción
  async function confirmDeleteTransaction(id) {
    const proceedDelete = async () => {
      try {
        await DB.delete('transactions', id);
        if (typeof showNotification === 'function') showNotification('Transacción eliminada', 'success');
      } catch (err) {
        console.error('Error eliminando transacción', err);
        if (typeof showNotification === 'function') showNotification('Error al eliminar', 'error');
      }
      renderTransactionsList();
      try {
        window.dispatchEvent(new CustomEvent('transactions-changed', { detail: { reason: 'delete', ids: [id] } }));
      } catch (_) {}
    };
    if (typeof showModal === 'function') {
      showModal({
        title: 'Eliminar transacción',
        content: '<p>¿Seguro que quieres eliminar esta transacción?</p>',
        size: 'small',
        buttons: [
          { text: 'Cancelar', type: 'secondary', onClick: () => closeModal() },
          { text: 'Eliminar', type: 'danger', onClick: async () => { await proceedDelete(); closeModal(); } }
        ]
      });
    } else {
      if (confirm('¿Eliminar esta transacción?')) {
        await proceedDelete();
      }
    }
  }

  function loadScanner() {
    const main = ensureMain();
    if (!main) return;
    main.innerHTML = `
      <section class="scanner-view">
        <h2>Escáner de recibos</h2>
        <div id="scanner-status" class="scanner-status"></div>
        <hr />
        <div class="statement-actions">
          <h3>Importar extracto bancario</h3>
          <p class="hint">Formatos admitidos: PDF, Excel (.xlsx/.xls) y CSV</p>
          <label class="btn">
            <i class="fas fa-file-import"></i> Subir extracto (PDF/Excel/CSV)
            <input type="file" id="statement-input" accept=".pdf,.xlsx,.xls,.csv" style="display:none" />
          </label>
          <div id="statement-status" class="scanner-status"></div>
        </div>
      </section>
    `;
    // Quitada opción de subir imagen y OCR; se mantiene texto pegado y archivos

    // Pegar texto de extracto (procesado inmediato)
    const pasteBtn = document.getElementById('paste-extract-btn');
    if (pasteBtn) {
      pasteBtn.addEventListener('click', () => {
        const content = `
          <div class="paste-extract-modal">
            <div class="form-group">
              <label>Banco</label>
              <input type="text" id="paste-bank" placeholder="BBVA / Santander / Genérico" />
            </div>
            <div class="form-group">
              <label>Fecha del extracto</label>
              <input type="date" id="paste-date" value="${new Date().toISOString().slice(0,10)}" />
            </div>
            <div class="form-group">
              <label>Texto del extracto</label>
              <textarea id="paste-text" rows="10" placeholder="Pega aquí el texto del extracto..."></textarea>
            </div>
          </div>`;
        showModal({
          title: 'Pegar texto de extracto',
          content,
          size: 'large',
          buttons: [
            { text: 'Cancelar', type: 'secondary', onClick: () => closeModal() },
            { text: 'Procesar', type: 'primary', onClick: async () => {
                try {
                  const bank = document.getElementById('paste-bank').value || 'Genérico';
                  const date = document.getElementById('paste-date').value || new Date().toISOString().slice(0,10);
                  const text = document.getElementById('paste-text').value || '';
                  if (!text.trim()) { if (typeof showNotification === 'function') showNotification('Pega el texto del extracto', 'warning'); return; }
                  let rows = [];
                  if (window.BankExtractManager && typeof window.BankExtractManager.extractTransactionsFromText === 'function') {
                    rows = window.BankExtractManager.extractTransactionsFromText(text, bank, date) || [];
                  } else if (typeof extractTransactionsFromText === 'function') {
                    // Fallback del OCR
                    rows = extractTransactionsFromText(text) || [];
                  } else {
                    rows = [];
                  }
                  closeModal();
                  if (rows.length) {
                    const headers = Object.keys(rows[0]);
                    showStatementPreviewModal(rows, headers, async (map, filters) => {
                      let txs = rows.map(r => toTransactionFromRow(r, map)).filter(Boolean);
                      if (filters && (filters.start || filters.end)) {
                        const start = filters.start ? new Date(filters.start) : null;
                        const end = filters.end ? new Date(filters.end) : null;
                        txs = txs.filter(t => {
                          const d = new Date(t.date);
                          return (!start || d >= start) && (!end || d <= end);
                        });
                      }
                      let saved = 0;
                      for (const t of txs) {
                        try { if (window.DB && typeof DB.add === 'function') { await DB.add('transactions', t); saved++; } }
                        catch(e){ console.error('Error guardando transacción pegada', e); }
                      }
                      const summary = summarizeByCategory(txs);
                      const details = txs.reduce((acc, t) => {
                        const c = t.category || 'otros';
                        acc[c] = acc[c] || [];
                        acc[c].push({ description: t.description, amount: t.amount, type: t.type });
                        return acc;
                      }, {});
                      const summaryHtml = renderCategorySummary(summary);
                      const detailsHtml = renderCategoryDetails(details);
                      const main = ensureMain();
                      if (main) main.innerHTML = `<section class="scanner-view"><h2>Resultado de importación</h2><p class="hint">Añadidos ${saved}/${txs.length} movimientos</p>${summaryHtml}${detailsHtml}</section>`;
                      if (typeof showNotification === 'function') showNotification(`Añadidos ${saved}/${txs.length} movimientos`, 'success');
                    });
                  } else {
                    if (typeof showNotification === 'function') showNotification('No se detectaron movimientos en el texto pegado', 'warning');
                  }
                } catch (err) {
                  console.error('Error procesando extracto pegado:', err);
                  if (typeof showNotification === 'function') showNotification('Error al procesar el texto pegado', 'error');
                }
              }}
          ]
        });
      });
    }

    // Importación de extractos
    const statementInput = document.getElementById('statement-input');
    const statementStatus = document.getElementById('statement-status');
    if (statementInput) {
      statementInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
          statementStatus.textContent = 'Procesando extracto...';
          const res = await importBankStatement(file, (saved, total) => {
            statementStatus.textContent = `Guardando ${saved}/${total} movimientos...`;
          });
          const summaryHtml = renderCategorySummary(res.summary);
          const detailsHtml = renderCategoryDetails(res.details);
          statementStatus.innerHTML = `Importados ${res.count} movimientos` + (summaryHtml ? `<br/>${summaryHtml}` : '') + (detailsHtml ? `<br/><button id="toggle-details" class="btn">Ver detalles</button>${detailsHtml}` : '');
          const toggle = document.getElementById('toggle-details');
          if (toggle) {
            toggle.addEventListener('click', () => {
              const panel = statementStatus.querySelector('.import-details');
              if (panel) {
                const open = panel.style.display !== 'none';
                panel.style.display = open ? 'none' : 'block';
                toggle.textContent = open ? 'Ver detalles' : 'Ocultar detalles';
              }
            });
          }
          if (typeof showNotification === 'function') {
            showNotification(`Importados ${res.count} movimientos`, 'success');
          }
        } catch (err) {
          console.error('Error importando extracto:', err);
          statementStatus.textContent = 'No se pudo importar el extracto';
          if (typeof showNotification === 'function') {
            showNotification('No se pudo importar el extracto', 'error');
          }
        } finally {
          e.target.value = '';
        }
      });
    }
  }

  // Shim de TransactionsManager.add si no existe (para compatibilidad con OCRManager)
  if (typeof window.TransactionsManager === 'undefined') {
    window.TransactionsManager = {
      async add(tx) {
        try {
          await DB.add('transactions', tx);
          try {
            window.dispatchEvent(new CustomEvent('transactions-changed', { detail: { reason: 'shim-add', ids: [tx.id] } }));
          } catch (_) {}
          return tx.id || true;
        } catch (e) {
          console.error('Shim: Error añadiendo transacción', e);
          throw e;
        }
      }
    };
  }

  // Definir addTransaction global si no existe (para BankExtractUI)
  if (typeof window.addTransaction !== 'function') {
    window.addTransaction = async function(appTx) {
      const tx = {
        id: appTx.id || ('tx_' + Date.now() + '_' + Math.random().toString(36).slice(2)),
        date: appTx.date || new Date().toISOString().slice(0,10),
        amount: Number(appTx.amount) || 0,
        type: appTx.type === 'income' ? 'income' : 'expense',
        category: (appTx.category || '').trim() || 'Otros gastos',
        member: (appTx.member || 'Familia'),
        description: (appTx.description || appTx.notes || '').trim()
      };
      try {
        await DB.add('transactions', tx);
        renderTransactionsList();
        renderTransactionsSummary();
        try {
          window.dispatchEvent(new CustomEvent('transactions-changed', { detail: { reason: 'import-add', ids: [tx.id] } }));
        } catch (_) {}
        if (typeof showNotification === 'function') showNotification('Transacción añadida desde extracto', 'success');
        return true;
      } catch (e) {
        console.error('Error en addTransaction global', e);
        if (typeof showNotification === 'function') showNotification('Error añadiendo transacción de extracto', 'error');
        return false;
      }
    };
  }

  // Compatibilidad con TransactionManager.addTransaction usado por bank-extract-ui-mini
  if (typeof window.TransactionManager === 'undefined') {
    window.TransactionManager = {
      async addTransaction(appTx) {
        if (typeof window.addTransaction === 'function') {
          return window.addTransaction(appTx);
        }
        // fallback a TransactionsManager.add si existe
        if (window.TransactionsManager && typeof window.TransactionsManager.add === 'function') {
          try { await window.TransactionsManager.add(appTx); return true; } catch (_) { return false; }
        }
        console.error('No hay método para añadir transacciones (TransactionManager/addTransaction)');
        return false;
      }
    };
  }

  function loadForecast() {
    const main = ensureMain();
    if (!main) return;
    main.innerHTML = `
      <section class="forecast-view">
        <h2>Previsión financiera</h2>
        <div class="card chart-card">
          <h3>Proyección avanzada de ingresos y gastos (6 meses)</h3>
          <div class="filters-basic">
            <label>Miembro:</label>
            <select id="forecast-member" class="form-control"></select>
            <button id="applyForecastFilters" class="btn"><i class="fas fa-filter"></i> Aplicar</button>
          </div>
          <div class="chart-wrapper">
            <canvas id="forecastChart"></canvas>
          </div>
        </div>
        <div class="card">
          <h3>Calendario anual de gastos por categorías</h3>
          <div id="forecastCalendar" class="calendar-grid"></div>
        </div>
        <div class="card">
          <h3>Presupuesto de gastos</h3>
          <div id="expenseBudget"></div>
          <div class="actions">
            <button id="saveExpenseBudget" class="btn"><i class="fas fa-save"></i> Guardar presupuesto</button>
            <button id="applyBudgetToForecast" class="btn"><i class="fas fa-arrow-down"></i> Aplicar al forecast</button>
          </div>
        </div>
        <div class="card">
          <h3>Plan editable del próximo año</h3>
          <div id="editableForecast"></div>
          <div class="actions">
            <button id="saveForecastPlan" class="btn btn-primary"><i class="fas fa-save"></i> Guardar plan</button>
            <label><input type="checkbox" id="autoForecastEmerging" /> Relleno automático con gastos emergentes</label>
            <button id="autoFillForecast" class="btn"><i class="fas fa-magic"></i> Rellenar automáticamente</button>
            <span>Umbral emergente (%)</span>
            <input id="emergingThreshold" type="number" min="0" max="500" step="10" value="150" />
            <span>Ajuste máximo (%)</span>
            <input id="maxUpliftPercent" type="number" min="0" max="100" step="5" value="20" />
          </div>
        </div>
      </section>
    `;
    renderForecastChartSimple('forecastChart', 6);
    renderForecastCalendar(new Date().getFullYear(), 'forecastCalendar');
    renderExpenseBudgetSimple();
    renderEditableForecastNextYear();
    setupForecastMemberFilter();
    setupAutoForecastControls();
    setupApplyBudgetToForecast();
  }

  async function loadFinancing() {
    // Asegurar BD antes de operar
    try { if (!window.DB?.db && typeof DB.init === 'function') { await DB.init(); } } catch (_) {}
    const main = ensureMain();
    if (!main) return;
    main.innerHTML = `
      <section class="placeholder">
        <h2>Financiación</h2>
        <div class="fin-actions"><button id="add-loan-btn" class="btn primary"><i class="fas fa-plus"></i> Añadir financiación</button></div>
        <div id="fin-summary">Cargando resumen...</div>
        <div id="fin-list" class="fin-list">Cargando financiaciones...</div>
      </section>
    `;
    // Si existe LoansManager, mostramos un resumen simple
    if (typeof LoansManager !== 'undefined' && LoansManager.getSummary) {
      try {
        const s = await LoansManager.getSummary();
        const el = document.getElementById('fin-summary');
        if (el) {
          if (s) {
            el.innerHTML = `
              <p>Activos: ${s.active} · Completados: ${s.completed}</p>
              <p>Total activo: ${formatAmount(s.totalActive ?? 0)}</p>
              <p>Total pagado: ${formatAmount(s.totalPaid ?? 0)}</p>
              <p>Pendiente total: ${formatAmount(s.totalRemaining ?? 0)}</p>
            `;
          } else {
            el.innerHTML = `<p>Resumen de financiación no disponible.</p>`;
          }
        }
      } catch (e) {
        console.warn('No se pudo cargar el resumen de préstamos:', e);
        const el = document.getElementById('fin-summary');
        if (el) {
          el.innerHTML = `<p>Resumen de financiación no disponible.</p>`;
        }
      }
    } else {
      const el = document.getElementById('fin-summary');
      if (el) {
        el.innerHTML = `<p>Resumen de financiación no disponible.</p>`;
      }
    }
    const addBtn = document.getElementById('add-loan-btn');
    if (addBtn) addBtn.addEventListener('click', showAddLoanModal);
    renderLoansList();
    // Intento automático de recuperación si está vacío y hay copia local
    try {
      if (typeof LoansManager !== 'undefined' && LoansManager.getAll) {
        const loansNow = await LoansManager.getAll();
        const hasLocalBackup = !!(typeof window.BackupManager !== 'undefined' && window.BackupManager.getLocalBackupInfo());
        if (Array.isArray(loansNow) && loansNow.length === 0 && hasLocalBackup) {
          const raw = localStorage.getItem('fincontrol_backup_latest');
          if (raw) {
            const payload = JSON.parse(raw);
            if (payload && payload.data && Array.isArray(payload.data.loans)) {
              for (const loan of payload.data.loans) {
                try { await DB.add('loans', loan); } catch (_) {}
              }
              if (typeof showNotification === 'function') {
                showNotification('Financiaciones recuperadas desde copia local', 'success');
              }
              renderLoansList();
            }
          }
        }
      }
    } catch (e) {
      console.warn('Recuperación automática de financiaciones no disponible:', e);
    }
  }

  function loadSettings() {
    const main = ensureMain();
    if (!main) return;
    main.innerHTML = `
      <section class="settings-view">
        <h2>Ajustes</h2>
        <div class="card">
          <h3>Tema</h3>
          <div class="actions">
            <button id="settings-theme-toggle" class="btn"><i class="fas fa-adjust"></i> Alternar tema</button>
          </div>
        </div>
        <div class="card">
          <h3>Exportar datos</h3>
          <p class="hint">Exporta transacciones, financiaciones y ajustes.</p>
          <div class="actions">
            <button id="export-excel-btn" class="btn primary"><i class="fas fa-file-excel"></i> Exportar a Excel (.xls)</button>
            <button id="export-pdf-btn" class="btn"><i class="fas fa-file-pdf"></i> Exportar a PDF</button>
            <button id="export-json-btn" class="btn"><i class="fas fa-file-export"></i> Exportar JSON</button>
          </div>
        </div>
        <div class="card">
          <h3>Copias de seguridad</h3>
          <p class="hint">Crea una copia local y restaura cuando lo necesites.</p>
          <div class="actions">
            <button id="backup-create-btn" class="btn"><i class="fas fa-save"></i> Crear copia local</button>
            <button id="backup-download-btn" class="btn"><i class="fas fa-download"></i> Descargar copia</button>
            <button id="backup-restore-btn" class="btn"><i class="fas fa-upload"></i> Restaurar copia local</button>
            <label class="btn"><i class="fas fa-file-upload"></i> Subir copia (.json)
              <input type="file" id="backup-upload-input" accept="application/json" style="display:none" />
            </label>
          </div>
          <div id="backup-info" class="hint"></div>
        </div>
        <div class="card">
          <h3>Importar datos</h3>
          <p class="hint">Importa JSON exportado o extractos bancarios en PDF/Excel/CSV.</p>
          <div class="actions">
            <label class="btn"><i class="fas fa-file-import"></i> Importar JSON
              <input type="file" id="import-json-input" accept="application/json" style="display:none" />
            </label>
            <label class="btn"><i class="fas fa-file-import"></i> Importar extracto (PDF/Excel/CSV)
              <input type="file" id="import-statement-input" accept=".pdf,.xlsx,.xls,.csv" style="display:none" />
            </label>
          </div>
        </div>
        <div class="card">
          <h3>Instalar aplicación</h3>
          <p class="hint">Instala la app como PWA para usarla en ventana independiente y offline.</p>
          <div class="actions">
            <button id="settings-install-app-btn" class="btn primary"><i class="fas fa-download"></i> Instalar app</button>
          </div>
          <div id="install-help" class="hint">Si el botón no está disponible, usa el menú del navegador: "Instalar aplicación".</div>
        </div>
        <div class="card">
          <h3>Sujetos</h3>
          <p class="hint">Gestiona los miembros/sujetos para asignación y análisis.</p>
          <div class="subjects-manage">
            <div class="subjects-actions" style="display:flex;gap:8px;align-items:center;">
              <input id="subject-new-input" class="form-control" type="text" placeholder="Nuevo sujeto" style="flex:1;" />
              <button id="subject-add-btn" class="btn"><i class="fas fa-plus"></i> Añadir</button>
            </div>
            <ul id="subjects-list" class="list" style="margin-top:12px;"></ul>
          </div>
        </div>
      </section>
    `;
    const themeBtn = document.getElementById('settings-theme-toggle');
    if (themeBtn && typeof window.toggleTheme === 'function') {
      themeBtn.addEventListener('click', () => window.toggleTheme());
    }
    const excelBtn = document.getElementById('export-excel-btn');
    if (excelBtn) excelBtn.addEventListener('click', exportAllToExcel);
    const pdfBtn = document.getElementById('export-pdf-btn');
    if (pdfBtn) pdfBtn.addEventListener('click', exportAllToPDF);
    const jsonBtn = document.getElementById('export-json-btn');
    if (jsonBtn) jsonBtn.addEventListener('click', exportAllToJSON);
    const importInput = document.getElementById('import-json-input');
    if (importInput) importInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        await importFromJSON(file);
        if (typeof showNotification === 'function') showNotification('Datos importados correctamente', 'success');
      } catch (err) {
        console.error('Error al importar JSON:', err);
        if (typeof showNotification === 'function') showNotification('Error al importar datos', 'error');
      }
    });
    const settingsInstallBtn = document.getElementById('settings-install-app-btn');
    if (settingsInstallBtn) {
      const updateBtnState = () => {
        if (window.PWAInstall && window.PWAInstall.available) {
          settingsInstallBtn.disabled = false;
          settingsInstallBtn.classList.add('primary');
        } else {
          settingsInstallBtn.disabled = false; // permitimos clic para mostrar ayuda
          settingsInstallBtn.classList.remove('primary');
        }
      };
      updateBtnState();
      settingsInstallBtn.addEventListener('click', async () => {
        if (window.PWAInstall && window.PWAInstall.available) {
          try { await window.PWAInstall.prompt(); } catch (_) {}
        } else {
          if (typeof showNotification === 'function') {
            showNotification('Usa el menú del navegador: "Instalar aplicación"', 'info');
          }
        }
      });
    }
    const importStatementInput = document.getElementById('import-statement-input');
    if (importStatementInput) importStatementInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const infoEl = document.getElementById('backup-info');
      try {
        const res = await importBankStatement(file, (done, total) => { if (infoEl) infoEl.textContent = `Importando ${done}/${total}...`; });
        if (infoEl) infoEl.textContent = `Importados ${res.count} movimientos.`;
        if (typeof showNotification === 'function') showNotification(`Importados ${res.count} movimientos`, 'success');
      } catch (err) {
        console.error('Error al importar extracto:', err);
        if (infoEl) infoEl.textContent = 'No se pudo importar el extracto';
        if (typeof showNotification === 'function') showNotification('Error al importar extracto', 'error');
      } finally {
        e.target.value = '';
      }
    });

    // ===== Gestión de Sujetos =====
    const subjectsListEl = document.getElementById('subjects-list');
    const subjectAddBtn = document.getElementById('subject-add-btn');
    const subjectNewInput = document.getElementById('subject-new-input');

    function renderSubjectsList() {
      if (!subjectsListEl || typeof FamilyManager === 'undefined') return;
      const members = FamilyManager.getMembers();
      subjectsListEl.innerHTML = members.map(m => {
        const isFixed = (m === 'Todos' || m === 'Otros');
        const controls = isFixed ? '' : `
          <button class="btn small edit-btn" title="Renombrar"><i class="fas fa-edit"></i></button>
          <button class="btn small danger delete-btn" title="Eliminar"><i class="fas fa-trash"></i></button>
        `;
        return `<li class="subject-item" data-name="${m}" style="display:flex;align-items:center;gap:8px;justify-content:space-between;">
                  <span class="name">${m}</span>
                  <span class="item-actions">${controls}</span>
                </li>`;
      }).join('');

      subjectsListEl.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const li = e.target.closest('.subject-item');
          const oldName = li?.getAttribute('data-name') || '';
          const newName = prompt('Nuevo nombre para el sujeto:', oldName);
          if (!newName || newName.trim() === '' || newName === oldName) return;
          const ok = FamilyManager.renameMember(oldName, newName.trim());
          if (!ok) { if (typeof showNotification === 'function') showNotification('No se pudo renombrar (nombre inválido o duplicado)', 'warning'); return; }
          await FamilyManager.saveToSettings();
          renderSubjectsList();
          if (typeof showNotification === 'function') showNotification('Sujeto renombrado', 'success');
        });
      });

      subjectsListEl.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const li = e.target.closest('.subject-item');
          const name = li?.getAttribute('data-name') || '';
          const confirmed = confirm(`¿Eliminar sujeto "${name}"?`);
          if (!confirmed) return;
          const ok = FamilyManager.removeMember(name);
          if (!ok) { if (typeof showNotification === 'function') showNotification('No se puede eliminar este sujeto', 'warning'); return; }
          await FamilyManager.saveToSettings();
          renderSubjectsList();
          if (typeof showNotification === 'function') showNotification('Sujeto eliminado', 'success');
        });
      });
    }

    if (subjectAddBtn) subjectAddBtn.addEventListener('click', async () => {
      const name = (subjectNewInput?.value || '').trim();
      if (!name) { if (typeof showNotification === 'function') showNotification('Escribe un nombre para el sujeto', 'info'); return; }
      const ok = FamilyManager.addMember(name);
      if (!ok) { if (typeof showNotification === 'function') showNotification('El sujeto ya existe o es inválido', 'warning'); return; }
      await FamilyManager.saveToSettings();
      subjectNewInput.value = '';
      renderSubjectsList();
      if (typeof showNotification === 'function') showNotification('Sujeto añadido', 'success');
    });

    // Render inicial
    renderSubjectsList();

    // Copias de seguridad
    const backupInfo = document.getElementById('backup-info');
    const showBackupInfo = () => {
      if (!backupInfo || !window.BackupManager) return;
      const info = BackupManager.getLocalBackupInfo();
      backupInfo.textContent = info ? `Copia local: ${new Date(info.createdAt).toLocaleString('es-ES')} (${(info.size/1024).toFixed(1)} KB)` : 'No hay copia local.';
    };
    showBackupInfo();
    const backupCreateBtn = document.getElementById('backup-create-btn');
    if (backupCreateBtn) backupCreateBtn.addEventListener('click', async () => {
      try { await BackupManager.createBackup(); showBackupInfo(); if (typeof showNotification === 'function') showNotification('Copia local creada', 'success'); } catch(e){ console.error(e); if (typeof showNotification === 'function') showNotification('Error creando copia', 'error'); }
    });
    const backupDownloadBtn = document.getElementById('backup-download-btn');
    if (backupDownloadBtn) backupDownloadBtn.addEventListener('click', async () => {
      try { await BackupManager.downloadBackup(); } catch(e){ console.error(e); if (typeof showNotification === 'function') showNotification('Error descargando copia', 'error'); }
    });
    const backupRestoreBtn = document.getElementById('backup-restore-btn');
    if (backupRestoreBtn) backupRestoreBtn.addEventListener('click', async () => {
      try { await BackupManager.restoreBackup(); if (typeof showNotification === 'function') showNotification('Copia local restaurada', 'success'); } catch(e){ console.error(e); if (typeof showNotification === 'function') showNotification('No hay copia local', 'error'); }
    });
    const backupUploadInput = document.getElementById('backup-upload-input');
    if (backupUploadInput) backupUploadInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try { await BackupManager.uploadBackupFile(file); if (typeof showNotification === 'function') showNotification('Copia restaurada desde archivo', 'success'); showBackupInfo(); } catch(e){ console.error(e); if (typeof showNotification === 'function') showNotification('Error restaurando archivo', 'error'); }
    });
  }

  // ===== Exportaciones =====
  async function buildExportHTML() {
    const data = await DB.exportData();
    const fmt = (n) => (Number(n || 0)).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const txRows = (data.transactions || []).map(t => `
      <tr><td>${new Date(t.date).toLocaleDateString('es-ES')}</td><td>${t.description || ''}</td><td>${t.category || ''}</td><td>${t.type || ''}</td><td>${fmt(t.amount)}</td></tr>
    `).join('');
    const loanRows = (data.loans || []).map(l => `
      <tr><td>${l.name || ''}</td><td>${(l.typeOfFinancing || l.type) || ''}</td><td>${fmt(l.amount)}</td><td>${l.installments || ''}</td><td>${l.interestRate || ''}%</td><td>${l.status || ''}</td></tr>
    `).join('');
    const setRows = (data.settings || []).map(s => `
      <tr><td>${s.id}</td><td>${String(s.value)}</td></tr>
    `).join('');
    return `
      <html><head><meta charset="utf-8"><title>Export FinControl</title>
      <style>table{border-collapse:collapse;width:100%;}th,td{border:1px solid #ccc;padding:6px;text-align:left;}h2{margin-top:24px;}</style>
      </head><body>
      <h1>Exportación FinControl</h1>
      <h2>Transacciones</h2>
      <table><thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Tipo</th><th>Importe</th></tr></thead><tbody>${txRows}</tbody></table>
      <h2>Financiaciones</h2>
      <table><thead><tr><th>Nombre</th><th>Tipo</th><th>Importe</th><th>Cuotas</th><th>Interés</th><th>Estado</th></tr></thead><tbody>${loanRows}</tbody></table>
      <h2>Ajustes</h2>
      <table><thead><tr><th>Clave</th><th>Valor</th></tr></thead><tbody>${setRows}</tbody></table>
      </body></html>
    `;
  }

  async function exportAllToExcel() {
    try {
      const html = await buildExportHTML();
      const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fincontrol_export.xls';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      if (typeof showNotification === 'function') showNotification('Exportación Excel generada', 'success');
    } catch (e) {
      console.error('Error exportando a Excel:', e);
      if (typeof showNotification === 'function') showNotification('Error al exportar a Excel', 'error');
    }
  }

  async function exportAllToPDF() {
    try {
      const html = await buildExportHTML();
      const w = window.open('', '_blank');
      if (!w) throw new Error('No se pudo abrir ventana');
      w.document.write(html);
      w.document.close();
      w.focus();
      // Dar un pequeño margen para que cargue antes de imprimir
      setTimeout(() => { try { w.print(); } catch(e){} }, 300);
      if (typeof showNotification === 'function') showNotification('Abriendo exportación para imprimir/guardar PDF', 'info');
    } catch (e) {
      console.error('Error exportando a PDF:', e);
      if (typeof showNotification === 'function') showNotification('Error al exportar a PDF', 'error');
    }
  }

  async function exportAllToJSON() {
    try {
      const data = await DB.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fincontrol_export.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      if (typeof showNotification === 'function') showNotification('Archivo JSON exportado', 'success');
    } catch (e) {
      console.error('Error exportando JSON:', e);
      if (typeof showNotification === 'function') showNotification('Error al exportar JSON', 'error');
    }
  }

  async function importFromJSON(file) {
    const text = await file.text();
    const data = JSON.parse(text);
    await DB.importData(data);
  }

  // ===== Previsión simple (sin ChartsManager) =====
  async function renderForecastChartSimple(canvasId, months = 6) {
    try {
      const el = document.getElementById(canvasId);
      if (!el) return;
      const all = await getAllTransactions();
      const memberSel = getSelectedForecastMember();
      // Agrupar últimos 12 meses
      const now = new Date();
      const labels = [];
      const incomeSeries = [];
      const expenseSeries = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now);
        d.setMonth(d.getMonth() - i);
        const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
        const within = all.filter(t => {
          const td = new Date(t.date);
          const matchDate = td >= monthStart && td <= monthEnd;
          const matchMember = !memberSel || !t.member || t.member === memberSel;
          return matchDate && matchMember;
        });
        const inc = within.filter(t => (t.type || t.kind) === 'income').reduce((s,t)=> s + (Number(t.amount)||0), 0);
        const exp = within
          .filter(t => (t.type || t.kind) === 'expense' && !isLoanCapitalTransaction(t))
          .reduce((s,t)=> s + (Number(t.amount)||0), 0);
        labels.push(d.toLocaleString('es-ES', { month: 'short' }));
        incomeSeries.push(inc);
        expenseSeries.push(exp);
      }
      // Proyección con regresión lineal simple
      function projectLinear(series, futureCount) {
        const n = series.length;
        const xs = Array.from({length: n}, (_, i) => i);
        const sumX = xs.reduce((s,x)=>s+x,0);
        const sumY = series.reduce((s,y)=>s+y,0);
        const sumXY = xs.reduce((s,x,i)=> s + x*series[i], 0);
        const sumXX = xs.reduce((s,x)=> s + x*x, 0);
        const denom = (n*sumXX - sumX*sumX) || 1;
        const slope = (n*sumXY - sumX*sumY) / denom;
        const intercept = (sumY - slope*sumX) / n;
        const projections = [];
        for (let k = 1; k <= futureCount; k++) {
          const x = n - 1 + k;
          const y = intercept + slope * x;
          projections.push(Math.max(0, y));
        }
        return projections;
      }
      const incProj = projectLinear(incomeSeries, months);
      const expProj = projectLinear(expenseSeries, months);
      for (let j = 0; j < months; j++) {
        const fd = new Date(now);
        fd.setMonth(now.getMonth() + j + 1);
        labels.push(fd.toLocaleString('es-ES', { month: 'short' }) + '*');
        incomeSeries.push(incProj[j]);
        expenseSeries.push(expProj[j]);
      }
      if (typeof Chart !== 'undefined') {
        new Chart(el.getContext('2d'), {
          type: 'line',
          data: {
            labels,
            datasets: [
              { 
                label: 'Ingresos', 
                data: incomeSeries, 
                borderColor: '#22c55e', 
                backgroundColor: 'transparent',
                borderDash: (ctx) => ctx.dataIndex >= 12 ? [6,4] : []
              },
              { 
                label: 'Gastos', 
                data: expenseSeries, 
                borderColor: '#ef4444', 
                backgroundColor: 'transparent',
                borderDash: (ctx) => ctx.dataIndex >= 12 ? [6,4] : []
              }
            ]
          },
          options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
              legend: { position: 'bottom' }, 
              title: { display: true, text: 'Previsión avanzada de ingresos y gastos' } 
            }, 
            scales: { y: { beginAtZero: true } } 
          }
        });
      } else {
        // Fallback simple dibujando líneas en Canvas
        const ctx = el.getContext('2d');
        const w = el.width = el.clientWidth;
        const h = el.height = el.clientHeight;
        ctx.clearRect(0,0,w,h);
        const padding = 30;
        const maxVal = Math.max(...incomeSeries, ...expenseSeries, 1);
        const pointsX = labels.map((_, i) => padding + (i * (w - 2*padding) / (labels.length - 1 || 1)));
        function toY(val) { return h - padding - (val / maxVal) * (h - 2*padding); }
        // Ejes
        ctx.strokeStyle = '#888';
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, h - padding);
        ctx.lineTo(w - padding, h - padding);
        ctx.stroke();
        // Serie ingresos
        ctx.strokeStyle = '#4CAF50';
        ctx.beginPath();
        incomeSeries.forEach((v, i) => { const x = pointsX[i]; const y = toY(v); i?ctx.lineTo(x,y):ctx.moveTo(x,y); });
        ctx.stroke();
        // Serie gastos
        ctx.strokeStyle = '#F44336';
        ctx.beginPath();
        expenseSeries.forEach((v, i) => { const x = pointsX[i]; const y = toY(v); i?ctx.lineTo(x,y):ctx.moveTo(x,y); });
        ctx.stroke();
        // Leyenda simple
        ctx.fillStyle = '#333';
        ctx.fillText('Ingresos', padding, padding - 10);
        ctx.fillStyle = '#4CAF50'; ctx.fillRect(padding + 70, padding - 20, 10, 10);
        ctx.fillStyle = '#333'; ctx.fillText('Gastos', padding + 100, padding - 10);
        ctx.fillStyle = '#F44336'; ctx.fillRect(padding + 160, padding - 20, 10, 10);
      }
    } catch (e) {
      console.error('Error renderizando previsión:', e);
    }
  }

  // ===== Calendario anual de gastos =====
  async function renderForecastCalendar(year, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const all = await getAllTransactions();
    const memberSel = getSelectedForecastMember();
    const months = Array.from({ length: 12 }, (_, m) => m);
    const monthly = months.map((m) => {
      const start = new Date(year, m, 1);
      const end = new Date(year, m + 1, 0, 23, 59, 59, 999);
      const within = all.filter(t => { 
        const d = new Date(t.date);
        const matchDate = d >= start && d <= end;
        const matchMember = !memberSel || !t.member || t.member === memberSel;
        return matchDate && matchMember;
      });
      const expensesOnly = within.filter(t => (t.type || t.kind) === 'expense' && !isLoanCapitalTransaction(t));
      const byCat = expensesOnly.reduce((acc, t) => {
        const cat = t.category || 'Sin categoría';
        const amt = Number(t.amount) || 0;
        acc[cat] = (acc[cat] || 0) + amt;
        return acc;
      }, {});
      const totalExp = Object.values(byCat).reduce((s,v)=> s+v, 0);
      const sortedCats = Object.entries(byCat).sort((a,b)=> b[1]-a[1]).slice(0,5);
      return { month: m, categories: sortedCats, totalExpense: totalExp, count: within.length };
    });
    function colorForCategory(name) {
      let hash = 0;
      for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash) + name.charCodeAt(i);
      const hue = Math.abs(hash) % 360;
      return `hsl(${hue}, 60%, 70%)`;
    }
    container.innerHTML = months.map((m) => {
      const item = monthly[m];
      const name = new Date(year, m, 1).toLocaleString('es-ES', { month: 'long' });
      const total = item.totalExpense || 0;
      const bar = total > 0
        ? `<div class="stacked-bar">${item.categories.map(([cat, val]) => {
            const pct = Math.round((val/total)*100);
            const color = colorForCategory(cat);
            return `<span class="stacked-segment" title="${cat}: ${formatAmount(val)}" style="width:${pct}%;background:${color}"></span>`;
          }).join('')}</div>`
        : `<div class="stacked-bar empty"></div>`;
      const chips = item.categories.map(([cat, val]) => `<span class="cat-chip"><i class="fas fa-tag"></i> ${cat}: ${formatAmount(val)}</span>`).join('');
      return `
        <div class="calendar-cell" data-month="${m}">
          <div class="cell-header">${name}</div>
          <div class="cell-body">
            <div class="cell-total"><strong>Gastos:</strong> ${formatAmount(total)}</div>
            ${bar}
            <div class="cat-chips">${chips}</div>
            <div class="cell-meta"><small>${item.count} movimientos</small></div>
          </div>
        </div>
      `;
    }).join('');
    // Click para ver detalle mensual
    container.querySelectorAll('.calendar-cell').forEach((el) => {
      el.addEventListener('click', () => showMonthDetail(year, Number(el.getAttribute('data-month'))));
    });
  }

  async function showMonthDetail(year, month) {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const all = await getAllTransactions();
    const within = all.filter(t => { const d = new Date(t.date); return d >= start && d <= end; });
    const rows = within.slice().sort((a,b)=> new Date(b.date) - new Date(a.date)).map(t => `
      <tr><td>${new Date(t.date).toLocaleDateString('es-ES')}</td><td>${t.description || ''}</td><td>${t.category || ''}</td><td>${(t.type||t.kind)||''}</td><td>${formatAmount(t.amount)}</td></tr>
    `).join('');
    const content = `
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Tipo</th><th>Importe</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5">Sin datos</td></tr>'}</tbody>
        </table>
      </div>
    `;
    if (typeof showModal === 'function') {
      showModal({ title: `Detalle ${new Date(year, month, 1).toLocaleString('es-ES', { month: 'long', year: 'numeric' })}`, content, size: 'large', buttons: [{ text: 'Cerrar', type: 'primary', onClick: () => closeModal() }] });
    } else {
      alert(`Mes ${month+1} / ${year}`);
    }
  }

  // ===== Forecast editable del próximo año =====
  async function renderEditableForecastNextYear() {
    const nextYear = new Date().getFullYear() + 1;
    const el = document.getElementById('editableForecast');
    if (!el) return;
    // Cargar plan guardado si existe
    let plan = null;
    try { plan = await DB.get('settings', `forecast_${nextYear}`); } catch(e) { plan = null; }
    const base = plan && plan.value ? plan.value : {};
    const months = Array.from({ length: 12 }, (_, m) => m);
    const inputs = months.map((m) => {
      const label = new Date(nextYear, m, 1).toLocaleString('es-ES', { month: 'short' });
      const val = Number(base[m] || 0);
      return `<div class="forecast-input"><label>${label}</label><input type="number" step="0.01" min="0" data-month="${m}" value="${val}" /></div>`;
    }).join('');
    const summaryHtml = `
      <div class="forecast-summary">
        <div><strong>Total anual:</strong> <span id="forecastTotal">${window.formatAmount ? window.formatAmount(0) : '0,00€'}</span></div>
        <div><strong>Promedio mensual:</strong> <span id="forecastAvg">${window.formatAmount ? window.formatAmount(0) : '0,00€'}</span></div>
        <div class="quarter-summary" id="quarterSummary">
          <span><strong>Q1:</strong> ${window.formatAmount ? window.formatAmount(0) : '0,00€'}</span>
          <span><strong>Q2:</strong> ${window.formatAmount ? window.formatAmount(0) : '0,00€'}</span>
          <span><strong>Q3:</strong> ${window.formatAmount ? window.formatAmount(0) : '0,00€'}</span>
          <span><strong>Q4:</strong> ${window.formatAmount ? window.formatAmount(0) : '0,00€'}</span>
        </div>
      </div>
      <div class="inline-actions">
        <button id="dec5" class="btn"><i class="fas fa-minus"></i> -5%</button>
        <button id="inc5" class="btn"><i class="fas fa-plus"></i> +5%</button>
       <button id="resetZero" class="btn"><i class="fas fa-undo"></i> Reset</button>
       <button id="copyCurrentYear" class="btn"><i class="fas fa-copy"></i> Copiar del año actual</button>
        <button id="copyBudget" class="btn"><i class="fas fa-copy"></i> Copiar desde presupuesto</button>
        <input id="annualTotalToDistribute" type="number" step="0.01" min="0" placeholder="Total anual (€)" />
        <button id="distUniform" class="btn"><i class="fas fa-equals"></i> Distribuir uniforme</button>
        <label for="patternWindow" style="margin-left:8px;">Ventana:</label>
        <select id="patternWindow">
          <option value="current">Año actual</option>
          <option value="prev">Año anterior</option>
          <option value="last12">Últimos 12 meses</option>
        </select>
        <label for="patternSource" style="margin-left:8px;">Fuente:</label>
        <select id="patternSource">
          <option value="expense">Gastos</option>
          <option value="income">Ingresos</option>
        </select>
        <button id="distPattern" class="btn"><i class="fas fa-chart-line"></i> Distribuir patrón histórico</button>
      </div>`;
    el.innerHTML = `<div class="forecast-plan">${summaryHtml}<div class="forecast-inputs">${inputs}</div></div>`;
    function updateForecastSummary() {
      const values = Array.from(el.querySelectorAll('input[data-month]')).map(inp => Number(inp.value) || 0);
      const total = values.reduce((s,v)=> s+v, 0);
      const avg = total / (values.length || 12);
      const fmt = (n) => window.formatAmount(Math.round((Number(n)||0) * 100) / 100);
      const totEl = document.getElementById('forecastTotal');
      const avgEl = document.getElementById('forecastAvg');
      if (totEl) totEl.textContent = fmt(total);
      if (avgEl) avgEl.textContent = fmt(avg);
      updateQuarterSummary(values, fmt);
    }
    function updateQuarterSummary(values, fmt) {
      const q = [
        values.slice(0,3).reduce((s,v)=>s+v,0),
        values.slice(3,6).reduce((s,v)=>s+v,0),
        values.slice(6,9).reduce((s,v)=>s+v,0),
        values.slice(9,12).reduce((s,v)=>s+v,0),
      ];
      const qs = document.getElementById('quarterSummary');
      if (qs) {
        const spans = qs.querySelectorAll('span');
        ['Q1','Q2','Q3','Q4'].forEach((label, i) => {
          const s = spans[i]; if (s) s.innerHTML = `<strong>${label}:</strong> ${fmt(q[i])}`;
        });
      }
    }
    function adjustAll(percent) {
      el.querySelectorAll('input[data-month]').forEach(inp => {
        const cur = Number(inp.value) || 0;
        const nxt = Math.max(0, cur * (1 + percent));
        inp.value = String(Math.round(nxt * 100) / 100);
      });
      updateForecastSummary();
    }
    el.querySelectorAll('input[data-month]').forEach(inp => {
      inp.addEventListener('input', updateForecastSummary);
      inp.addEventListener('change', updateForecastSummary);
    });
    document.getElementById('dec5')?.addEventListener('click', () => adjustAll(-0.05));
    document.getElementById('inc5')?.addEventListener('click', () => adjustAll(0.05));
    document.getElementById('resetZero')?.addEventListener('click', () => {
      el.querySelectorAll('input[data-month]').forEach(inp => { inp.value = '0'; });
      updateForecastSummary();
    });
    document.getElementById('copyCurrentYear')?.addEventListener('click', async () => {
      try {
        const all = await getAllTransactions();
        const memberSel = getSelectedForecastMember();
        const year = new Date().getFullYear();
        const monthlyTotals = Array.from({length:12},()=>0);
        all.forEach(t => {
          const d = new Date(t.date);
          const sameYear = d.getFullYear() === year;
          const isExp = (t.type || t.kind) === 'expense' && !isLoanCapitalTransaction(t);
          const matchMember = !memberSel || !t.member || t.member === memberSel;
          if (sameYear && isExp && matchMember) {
            monthlyTotals[d.getMonth()] += Number(t.amount) || 0;
          }
        });
        el.querySelectorAll('input[data-month]').forEach(inp => {
          const m = Number(inp.getAttribute('data-month')) || 0;
          const val = Math.round((monthlyTotals[m] || 0) * 100) / 100;
          inp.value = String(val);
        });
        updateForecastSummary();
        if (typeof showNotification === 'function') showNotification('Copiado desde el año actual', 'success');
      } catch (e) {
        console.error('Error copiando año actual:', e);
        if (typeof showNotification === 'function') showNotification('Error al copiar datos del año actual', 'error');
      }
    });
    updateForecastSummary();

    // Copiar desde presupuesto (sumatorio mensual de límites por categoría)
    const copyBudgetBtn = document.getElementById('copyBudget');
    if (copyBudgetBtn) copyBudgetBtn.addEventListener('click', async () => {
      try {
        let saved = null;
        try { saved = await DB.get('settings','expense_budget'); } catch(_) { saved = null; }
        const budget = (saved && saved.value) ? saved.value : {};
        const totalMonthly = Object.values(budget).reduce((s,v)=> s + (Number(v)||0), 0);
        el.querySelectorAll('input[data-month]').forEach(inp => { inp.value = String(Math.round(totalMonthly * 100) / 100); });
        updateForecastSummary();
        if (typeof showNotification === 'function') showNotification('Copiado desde presupuesto', 'success');
      } catch(e) {
        console.error('Error copiando desde presupuesto:', e);
        if (typeof showNotification === 'function') showNotification('Error al copiar presupuesto', 'error');
      }
    });

    // Utilidad: patrón histórico mensual configurable (año, último 12, ingresos/gastos)
    async function computeHistoricalMonthlyPattern(options = {}) {
      const { window = 'current', source = 'expense', refYear = new Date().getFullYear() } = options;
      const all = await getAllTransactions();
      const memberSel = getSelectedForecastMember();
      const monthlyTotals = Array.from({length:12},()=>0);
      if (window === 'last12') {
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const start = new Date(d.getFullYear(), d.getMonth(), 1);
          const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
          const within = all.filter(t => {
            const td = new Date(t.date);
            const matchDate = td >= start && td <= end;
            const matchMember = !memberSel || !t.member || t.member === memberSel;
            return matchDate && matchMember;
          });
          const sum = within.filter(t => {
            const kind = (t.type || t.kind);
            if (source === 'income') return kind === 'income';
            return kind === 'expense' && !isLoanCapitalTransaction(t);
          }).reduce((s,t)=> s + (Number(t.amount)||0), 0);
          monthlyTotals[11 - i] = sum;
        }
      } else {
        const year = window === 'prev' ? (refYear - 1) : refYear;
        for (let m = 0; m < 12; m++) {
          const start = new Date(year, m, 1);
          const end = new Date(year, m + 1, 0, 23, 59, 59, 999);
          const within = all.filter(t => {
            const td = new Date(t.date);
            const matchDate = td >= start && td <= end;
            const matchMember = !memberSel || !t.member || t.member === memberSel;
            return matchDate && matchMember;
          });
          const sum = within.filter(t => {
            const kind = (t.type || t.kind);
            if (source === 'income') return kind === 'income';
            return kind === 'expense' && !isLoanCapitalTransaction(t);
          }).reduce((s,t)=> s + (Number(t.amount)||0), 0);
          monthlyTotals[m] = sum;
        }
      }
      const grand = monthlyTotals.reduce((s,v)=> s+v, 0);
      const safeGrand = grand > 0 ? grand : 1;
      const shares = monthlyTotals.map(v => v / safeGrand);
      return { totals: monthlyTotals, shares };
    }

    // Distribuir total anual uniformemente
    const distUniformBtn = document.getElementById('distUniform');
    if (distUniformBtn) distUniformBtn.addEventListener('click', () => {
      const totalAnnual = Number(document.getElementById('annualTotalToDistribute')?.value || 0);
      if (!isFinite(totalAnnual) || totalAnnual <= 0) {
        if (typeof showNotification === 'function') showNotification('Indica un total anual válido', 'warning');
        return;
      }
      const perMonth = Math.round((totalAnnual / 12) * 100) / 100;
      el.querySelectorAll('input[data-month]').forEach(inp => { inp.value = String(perMonth); });
      updateForecastSummary();
      if (typeof showNotification === 'function') showNotification('Distribución uniforme aplicada', 'success');
    });

    // Distribuir total anual según patrón histórico configurable
    const distPatternBtn = document.getElementById('distPattern');
    if (distPatternBtn) distPatternBtn.addEventListener('click', async () => {
      const totalAnnual = Number(document.getElementById('annualTotalToDistribute')?.value || 0);
      if (!isFinite(totalAnnual) || totalAnnual <= 0) {
        if (typeof showNotification === 'function') showNotification('Indica un total anual válido', 'warning');
        return;
      }
      try {
        const windowSel = document.getElementById('patternWindow')?.value || 'current';
        const sourceSel = document.getElementById('patternSource')?.value || 'expense';
        const { shares } = await computeHistoricalMonthlyPattern({ window: windowSel, source: sourceSel, refYear: new Date().getFullYear() });
        // Si el patrón está vacío (todo cero), aplicar uniforme
        const sumShares = shares.reduce((s,v)=> s+v, 0);
        const appliedShares = (sumShares > 0.0001) ? shares : Array.from({length:12},()=>1/12);
        const vals = appliedShares.map(sh => Math.round((totalAnnual * sh) * 100) / 100);
        el.querySelectorAll('input[data-month]').forEach((inp, idx) => { inp.value = String(vals[idx] || 0); });
        updateForecastSummary();
        if (typeof showNotification === 'function') showNotification('Distribución por patrón histórico aplicada', 'success');
      } catch(e) {
        console.error('Error distribuyendo por patrón histórico:', e);
        if (typeof showNotification === 'function') showNotification('Error al calcular patrón histórico', 'error');
      }
    });
    const btn = document.getElementById('saveForecastPlan');
    if (btn) btn.onclick = async () => {
      const values = {};
      el.querySelectorAll('input[data-month]').forEach((inp) => { values[inp.getAttribute('data-month')] = Number(inp.value) || 0; });
      await DB.saveSetting(`forecast_${nextYear}`, values);
      if (typeof showNotification === 'function') showNotification('Plan de forecast guardado', 'success');
      updateForecastSummary();
    };
  }

  // ===== Presupuesto de gastos simple =====
  async function renderExpenseBudgetSimple() {
    const wrap = document.getElementById('expenseBudget');
    if (!wrap) return;
    const all = await getAllTransactions();
    const memberSel = getSelectedForecastMember();
    // Media mensual del año 2025 por categoría (solo gastos, excluye capital préstamo)
    const start = new Date(2025, 0, 1);
    const end = new Date(2026, 0, 1);
    const catMap = {};
    const catMonthSet = {};
    all.forEach(t => {
      const d = new Date(t.date);
      const matchMember = !memberSel || !t.member || t.member === memberSel;
      if (d >= start && d < end && matchMember && (t.type || t.kind) === 'expense' && !isLoanCapitalTransaction(t)) {
        const cat = t.category || 'Otros';
        catMap[cat] = (catMap[cat] || 0) + (Number(t.amount) || 0);
        const m = d.getMonth();
        if (!catMonthSet[cat]) catMonthSet[cat] = new Set();
        catMonthSet[cat].add(m);
      }
    });
    const cats = Object.entries(catMap).sort((a,b)=> b[1]-a[1]).slice(0,12);
    const avgMap = Object.fromEntries(cats.map(([c,total]) => {
      const monthsWithData = catMonthSet[c] ? catMonthSet[c].size : 0;
      const denom = monthsWithData > 0 ? monthsWithData : 12;
      return [c, total/denom];
    }));
    // Cargar presupuesto guardado
    let saved = null;
    try { saved = await DB.get('settings','expense_budget'); } catch(_) { saved = null; }
    const budget = (saved && saved.value) ? saved.value : {};
    const rows = cats.map(([c]) => {
      const avg = avgMap[c] || 0;
      const limit = Number(budget[c] || 0);
      const monthsWithData = catMonthSet[c] ? catMonthSet[c].size : 0;
      const monthsBadge = ` <span class="months-badge">(${monthsWithData} meses)</span>`;
      return `<tr><td>${c}</td><td>${formatAmount(avg)}${monthsBadge}</td><td><input type="number" step="0.01" data-cat="${c}" value="${limit}" /></td></tr>`;
    }).join('');
    wrap.innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Categoría</th><th>Media mensual</th><th>Presupuesto</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="3">Sin datos</td></tr>'}</tbody>
        </table>
      </div>
      <p class="hint">Se calcula la media mensual de 2025 ajustada por meses con datos.</p>
    `;
    const saveBtn = document.getElementById('saveExpenseBudget');
    if (saveBtn) saveBtn.onclick = async () => {
      const limits = {};
      wrap.querySelectorAll('input[data-cat]').forEach(inp => {
        limits[inp.getAttribute('data-cat')] = Number(inp.value) || 0;
      });
      await DB.saveSetting('expense_budget', limits);
      if (typeof showNotification === 'function') showNotification('Presupuesto guardado', 'success');
    };
  }

  // ===== Auto-forecast basado en gastos emergentes =====
  function setupAutoForecastControls() {
    const btn = document.getElementById('autoFillForecast');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const el = document.getElementById('editableForecast');
      if (!el) return;
      const auto = !!document.getElementById('autoForecastEmerging')?.checked;
      const thresholdPct = Number(document.getElementById('emergingThreshold')?.value || 150);
      const maxUpliftPct = Number(document.getElementById('maxUpliftPercent')?.value || 20);
      const { avgExpense, upliftFactor } = await computeAutoForecastBaselines(3, thresholdPct, maxUpliftPct);
      const base = auto ? avgExpense * (1 + upliftFactor) : avgExpense;
      el.querySelectorAll('input[data-month]').forEach(inp => { inp.value = String(Math.round(base * 100) / 100); });
      if (typeof showNotification === 'function') showNotification('Forecast rellenado automáticamente', 'success');
    });
  }

  async function computeAutoForecastBaselines(months = 3, thresholdPct = 150, maxUpliftPct = 20) {
    const all = await getAllTransactions();
    const memberSel = getSelectedForecastMember();
    // Totales mensuales de gastos (excluye capital préstamo)
    const now = new Date();
    const monthlyTotals = [];
    for (let i = months-1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const within = all.filter(t => { 
        const td = new Date(t.date); 
        const matchDate = td >= start && td <= end; 
        const matchMember = !memberSel || !t.member || t.member === memberSel; 
        return matchDate && matchMember; 
      });
      const exp = within.filter(t => (t.type || t.kind) === 'expense' && !isLoanCapitalTransaction(t)).reduce((s,t)=> s + (Number(t.amount)||0), 0);
      monthlyTotals.push(exp);
    }
    const avgExpense = (monthlyTotals.reduce((a,b)=>a+b,0) / (monthlyTotals.length || 1)) || 0;
    // Detección simple de gastos emergentes por categoría: incremento mes a mes
    const catMonthly = {};
    for (let i = months-1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const within = all.filter(t => { 
        const td = new Date(t.date); 
        const matchDate = td >= start && td <= end; 
        const matchMember = !memberSel || !t.member || t.member === memberSel; 
        return matchDate && matchMember; 
      });
      within.forEach(t => {
        if ((t.type || t.kind) === 'expense' && !isLoanCapitalTransaction(t)) {
          const c = t.category || 'Otros';
          catMonthly[c] = catMonthly[c] || [];
          catMonthly[c][months-1 - i] = (catMonthly[c][months-1 - i] || 0) + (Number(t.amount)||0);
        }
      });
    }
    let emergingCount = 0;
    Object.values(catMonthly).forEach(arr => {
      if (arr.length >= 3) {
        const [m1,m2,m3] = arr.slice(-3);
        const thr = Math.max(1, thresholdPct / 100);
        if (m1 && m2 && m3 && m3 > m2 && m2 > m1 && m3 >= thr * m2) emergingCount++;
      }
    });
    const maxUplift = Math.max(0, Math.min(1, (maxUpliftPct || 20) / 100));
    const upliftFactor = Math.min(maxUplift, emergingCount * 0.05); // +5% por categoría emergente, máx configurable
    return { avgExpense, upliftFactor };
  }

  // ===== Filtro de miembro en Previsión =====
  function setupForecastMemberFilter() {
    const sel = document.getElementById('forecast-member');
    if (!sel) return;
    const optionsHtml = (typeof FamilyManager !== 'undefined')
      ? FamilyManager.generateMemberOptions('Todos')
      : '<option value="">Sujeto</option>';
    sel.innerHTML = optionsHtml;
    const applyBtn = document.getElementById('applyForecastFilters');
    if (applyBtn) applyBtn.addEventListener('click', () => {
      renderForecastChartSimple('forecastChart', 6);
      renderForecastCalendar(new Date().getFullYear(), 'forecastCalendar');
      renderExpenseBudgetSimple();
    });
  }

  function getSelectedForecastMember() {
    const v = document.getElementById('forecast-member')?.value || '';
    return v === 'Todos' ? '' : v;
  }

  // ===== Aplicar presupuesto al forecast =====
  function setupApplyBudgetToForecast() {
    const btn = document.getElementById('applyBudgetToForecast');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      let saved = null;
      try { saved = await DB.get('settings','expense_budget'); } catch(_) { saved = null; }
      const budget = (saved && saved.value) ? saved.value : {};
      const totalMonthly = Object.values(budget).reduce((s,v)=> s + (Number(v)||0), 0);
      const el = document.getElementById('editableForecast');
      if (!el) return;
      el.querySelectorAll('input[data-month]').forEach(inp => { inp.value = String(Math.round(totalMonthly * 100) / 100); });
      if (typeof showNotification === 'function') showNotification('Aplicado presupuesto al forecast', 'success');
    });
  }

  // ===== Importación de extractos bancarios =====
  async function importBankStatement(file, onProgress) {
    const ext = (file.name.toLowerCase().split('.').pop() || '').trim();
    let rows = [];
    if (ext === 'csv') {
      rows = await parseCSVStatement(file);
    } else if (ext === 'xlsx' || ext === 'xls') {
      rows = await parseExcelStatement(file);
    } else if (ext === 'pdf') {
      // Parser robusto con fallback al parser simple
      try {
        rows = await robustParsePDFStatement(file);
      } catch (e) {
        console.warn('Fallo en parser robusto de PDF, usando parser simple:', e);
        rows = await parsePDFStatement(file);
      }
    } else {
      throw new Error('Formato no soportado');
    }
    if (!rows || rows.length === 0) return { count: 0, summary: {} };

    const headers = Array.isArray(rows) && rows[0] ? Object.keys(rows[0]) : ['date', 'description', 'amount', 'category'];

    return await new Promise((resolve) => {
      showStatementPreviewModal(rows, headers, async (map, filters) => {
        let txs = rows.map(r => toTransactionFromRow(r, map)).filter(Boolean);
        // Filtrado por rango de fechas si está definido
        if (filters && (filters.start || filters.end)) {
          const start = filters.start ? new Date(filters.start) : null;
          const end = filters.end ? new Date(filters.end) : null;
          txs = txs.filter(t => {
            const d = new Date(t.date);
            return (!start || d >= start) && (!end || d <= end);
          });
        }
        let saved = 0;
        const detailsMap = {};
        for (const tx of txs) {
          try {
            if (typeof window.addTransaction === 'function') {
              await window.addTransaction(tx);
            } else if (window.TransactionsManager && typeof window.TransactionsManager.add === 'function') {
              await window.TransactionsManager.add(tx);
            } else if (window.DB && typeof window.DB.add === 'function') {
              await window.DB.add('transactions', tx);
            } else {
              throw new Error('No hay método disponible para guardar transacciones');
            }
            saved++;
            if (typeof onProgress === 'function') onProgress(saved, txs.length);
            const cat = tx.category || 'otros';
            if (!detailsMap[cat]) detailsMap[cat] = [];
            if (detailsMap[cat].length < 5) {
              detailsMap[cat].push({ description: tx.description, amount: tx.amount, type: tx.type });
            }
          } catch (e) {
            console.warn('Movimiento no guardado:', e);
          }
        }
        if (typeof window.loadTransactions === 'function') {
          window.loadTransactions();
        }
        resolve({ count: saved, summary: summarizeByCategory(txs), details: detailsMap });
      });
    });
  }

  function toTransactionFromRow(r, map) {
    const getVal = (keyGuess, fallbackKeys = []) => {
      if (map && map[keyGuess] && r[map[keyGuess]] != null) return r[map[keyGuess]];
      if (r[keyGuess] != null) return r[keyGuess];
      for (const k of fallbackKeys) {
        if (r[k] != null) return r[k];
      }
      return null;
    };

    const rawDate = getVal('date', ['fecha']);
    const rawDesc = getVal('description', ['concept','concepto','detalle','merchant','desc']);
    const rawAmount = getVal('amount', ['importe','valor','monto','debe','haber']);
    let rawType = getVal('type', ['tipo']);

    const amount = parseLocaleNumber(rawAmount);
    if (!isFinite(amount)) return null;
    const type = (function(){
      if (rawType) {
        const v = String(rawType).toLowerCase();
        if (v.includes('ingreso') || v.includes('credito') || v.includes('haber')) return 'income';
        if (v.includes('gasto') || v.includes('debito') || v.includes('debe')) return 'expense';
      }
      return amount >= 0 ? 'income' : 'expense';
    })();

    const tx = {
      id: 'trans_' + Date.now() + '_' + Math.random().toString(16).slice(2),
      type,
      amount: Math.abs(amount) || 0,
      date: normalizeDate(rawDate) || new Date().toISOString().slice(0, 10),
      description: (rawDesc || 'Movimiento'),
      category: r.category || guessCategory(rawDesc) || 'otros',
      notes: r.notes || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    return tx;
  }

  function guessCategory(text) {
    if (!text) return null;
    const t = text.toLowerCase();
    if (t.includes('super') || t.includes('mercado')) return 'alimentación';
    if (t.includes('gas') || t.includes('luz') || t.includes('agua')) return 'suministros';
    if (t.includes('amazon') || t.includes('compra')) return 'compras';
    if (t.includes('nómina') || t.includes('nomina')) return 'ingresos';
    return null;
  }

  function normalizeDate(d) {
    if (!d) return null;
    const s = String(d).trim();
    const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m1) {
      const dd = m1[1].padStart(2, '0');
      const mm = m1[2].padStart(2, '0');
      const yyyy = m1[3].length === 2 ? ('20' + m1[3]) : m1[3];
      return `${yyyy}-${mm}-${dd}`;
    }
    const m2 = s.match(/^(\d{4})[\-](\d{1,2})[\-](\d{1,2})$/);
    if (m2) {
      const yyyy = m2[1];
      const mm = m2[2].padStart(2, '0');
      const dd = m2[3].padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return null;
  }

  async function parseCSVStatement(file) {
    const text = await readFileText(file);
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];
    const header = lines[0];
    const delimiter = header.includes(';') ? ';' : ',';
    const cols = header.split(delimiter).map(c => c.trim().toLowerCase());
    const idx = {
      date: cols.findIndex(c => /date|fecha/.test(c)),
      desc: cols.findIndex(c => /desc|concept|concepto|merchant/.test(c)),
      amount: cols.findIndex(c => /amount|importe|valor|monto/.test(c)),
      category: cols.findIndex(c => /category|categor[ií]a/.test(c))
    };
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(delimiter);
      const rawAmount = parts[idx.amount]?.trim() || '0';
      const num = parseLocaleNumber(rawAmount);
      rows.push({
        date: parts[idx.date]?.trim(),
        description: parts[idx.desc]?.trim(),
        amount: num,
        category: parts[idx.category]?.trim()
      });
    }
    return rows;
  }

  function parseLocaleNumber(s) {
    if (typeof s === 'number') return s;
    const str = String(s || '').trim();
    const neg = /\(.*\)/.test(str) || /^-/.test(str);
    let cleaned = str.replace(/[()\s]/g, '').replace(/^\+/, '').replace(/^-/, '');
    // Detectar separador decimal por [.,] + 1-2 dígitos al final
    const m = cleaned.match(/([.,])(\d{1,2})$/);
    if (m) {
      const dec = m[1];
      const thou = dec === '.' ? ',' : '.';
      cleaned = cleaned.replace(new RegExp('\\' + thou, 'g'), '');
      cleaned = cleaned.replace(new RegExp('\\' + dec, 'g'), '.');
    } else {
      // Si no hay patrón claro de decimales, eliminar ambos como miles
      cleaned = cleaned.replace(/[.,]/g, '');
    }
    const n = parseFloat(cleaned);
    return neg ? -Math.abs(n) : n;
  }

  async function parseExcelStatement(file) {
    await ensureSheetJs();
    const buf = await readFileArrayBuffer(file);
    const wb = XLSX.read(buf, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(ws, { raw: false });
    return json.map(row => {
      const keys = Object.keys(row);
      const get = (re) => keys.find(k => re.test(k.toLowerCase()));
      const kDate = get(/date|fecha/);
      const kDesc = get(/desc|concept|concepto|merchant/);
      const kAmount = get(/amount|importe|valor|monto/);
      const kCategory = get(/category|categor[ií]a/);
      return {
        date: row[kDate] || '',
        description: row[kDesc] || '',
        amount: parseLocaleNumber(row[kAmount] || '0'),
        category: row[kCategory] || ''
      };
    });
  }

  async function parsePDFStatement(file) {
    await ensurePdfJs();
    const buf = await readFileArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let text = '';
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const strings = content.items.map(it => it.str);
      text += '\n' + strings.join(' ');
    }
    const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
    const rows = [];
    const re = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}).*?([A-Za-zÁÉÍÓÚÑ0-9 ,\.\-\/]+?)\s+([\-\+]?\d+[\.,]\d{2})/;
    for (const l of lines) {
      const m = l.match(re);
      if (m) {
        rows.push({
          date: m[1],
          description: m[2],
          amount: parseLocaleNumber(m[3])
        });
      }
    }
    return rows;
  }

  function readFileText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  function readFileArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  // Carga bajo demanda de librerías externas
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve(true);
      s.onerror = () => reject(new Error('No se pudo cargar ' + src));
      document.head.appendChild(s);
    });
  }

  async function ensurePdfJs() {
    if (window.pdfjsLib) return;
    await loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js');
    if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    }
  }

  async function ensureSheetJs() {
    if (window.XLSX) return;
    await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
  }

  // ===== UI de financiación: listado y acciones =====
  async function renderLoansList() {
    const container = document.getElementById('fin-list');
    if (!container) return;
    if (typeof LoansManager === 'undefined' || !LoansManager.getAll) {
      container.innerHTML = `<p>No hay gestor de préstamos cargado.</p>`;
      return;
    }
    try {
      const loans = await LoansManager.getAll();
      if (!loans.length) {
        // Si no hay préstamos, ofrecer recuperación desde copia local si existe
        const hasLocalBackup = typeof window.BackupManager !== 'undefined' && !!window.BackupManager.getLocalBackupInfo();
        const restoreCTA = hasLocalBackup
          ? `<div class="actions" style="margin-top:8px"><button id="restore-loans-from-backup" class="btn"><i class="fas fa-upload"></i> Recuperar desde copia local</button></div>`
          : '';
        container.innerHTML = `<p class="empty-state">No hay financiaciones registradas.</p>${restoreCTA}`;
        // Configurar botón de recuperación si hay copia local
        const restoreBtn = document.getElementById('restore-loans-from-backup');
        if (restoreBtn) {
          restoreBtn.addEventListener('click', async () => {
            try {
              // Recuperar SOLO préstamos desde la copia local
              const raw = localStorage.getItem('fincontrol_backup_latest');
              if (!raw) throw new Error('No hay copia local guardada');
              const payload = JSON.parse(raw);
              if (!payload || !payload.data || !Array.isArray(payload.data.loans)) {
                throw new Error('Copia local inválida');
              }
              const loansFromBackup = payload.data.loans;
              for (const loan of loansFromBackup) {
                try { await DB.add('loans', loan); } catch (_) {}
              }
              if (typeof showNotification === 'function') {
                showNotification('Financiaciones recuperadas desde copia local', 'success');
              }
              // Re-renderizar lista tras restaurar
              renderLoansList();
            } catch (e) {
              console.error('Error restaurando copia local:', e);
              if (typeof showNotification === 'function') {
                showNotification('No se pudo restaurar la copia local', 'error');
              }
            }
          });
        }
        return;
      }
      container.innerHTML = loans.map(l => {
        const paid = Number(l.paidAmount || 0);
        const total = Number(l.amount || 0);
        const remainingAmount = Math.max(0, total - paid);
        const totalInst = Number(l.installments || 0);
        const doneInst = Array.isArray(l.payments) ? l.payments.length : 0;
        const remainingInst = Math.max(0, totalInst - doneInst);
        return `
        <div class="loan-item" data-id="${l.id}">
          <div class="loan-main">
            <strong>${l.name || 'Financiación'}</strong>
            <span class="loan-amount">${formatAmount(l.amount || 0)}</span>
          </div>
          <div class="loan-meta">
            <span>Inicio: ${l.startDate ? new Date(l.startDate).toLocaleDateString('es-ES') : '-'}</span>
            <span>Estado: ${l.status || 'active'}</span>
            <span>Cuotas totales: ${l.installments || '-'}</span>
            <span class="payment-counter">Pagos realizados: <strong>${doneInst}</strong></span>
            <span>Restante: ${formatAmount(remainingAmount)}</span>
            <span>Cuotas restantes: ${remainingInst || '-'}</span>
          </div>
          <div class="loan-actions">
            <button class="btn" data-action="schedule">Plan de pagos</button>
            <button class="btn" data-action="edit">Editar</button>
            <button class="btn danger" data-action="delete">Eliminar</button>
          </div>
        </div>
      `}).join('');

      container.querySelectorAll('.loan-item .loan-actions button').forEach(btn => {
        const parent = btn.closest('.loan-item');
        const id = parent?.getAttribute('data-id');
        btn.addEventListener('click', async () => {
          const loan = await LoansManager.getById(id);
          const action = btn.getAttribute('data-action');
          if (action === 'schedule') {
            showLoanScheduleModal(loan);
          } else if (action === 'edit') {
            showEditLoanModal(loan);
          } else if (action === 'delete') {
            confirmDeleteLoan(id);
          }
        });
      });
    } catch (e) {
      console.error('Error cargando financiaciones:', e);
      container.innerHTML = `<p>Error al cargar financiaciones.</p>`;
    }
  }

  // Confirmación para eliminar financiación
  async function confirmDeleteLoan(id) {
    const proceedDelete = async () => {
      try {
        await LoansManager.delete(id);
        if (typeof showNotification === 'function') showNotification('Financiación eliminada', 'success');
      } catch (err) {
        console.error('Error eliminando financiación', err);
        if (typeof showNotification === 'function') showNotification('Error al eliminar financiación', 'error');
      }
      try { loadFinancing(); } catch (e) { console.warn('No se pudo refrescar financiación:', e); }
    };
    if (typeof showModal === 'function') {
      showModal({
        title: 'Eliminar financiación',
        content: '<p>¿Seguro que quieres eliminar esta financiación y sus transacciones asociadas?</p>',
        size: 'small',
        buttons: [
          { text: 'Cancelar', type: 'secondary', onClick: () => closeModal() },
          { text: 'Eliminar', type: 'danger', onClick: async () => { await proceedDelete(); closeModal(); } }
        ]
      });
    } else {
      if (confirm('¿Eliminar esta financiación y sus transacciones asociadas?')) {
        await proceedDelete();
      }
    }
  }

  // Confirmación para deshacer último pago
  async function confirmUndoLastPayment(loan) {
    const payments = Array.isArray(loan.payments) ? loan.payments : [];
    if (payments.length === 0) {
      if (typeof showNotification === 'function') showNotification('No hay pagos para deshacer', 'warning');
      return;
    }
    
    const lastPayment = payments[payments.length - 1];
    const proceedUndo = async () => {
      try {
        await LoansManager.undoLastPayment(loan.id);
        if (typeof showNotification === 'function') showNotification('Último pago deshecho correctamente', 'success');
      } catch (err) {
        console.error('Error deshaciendo último pago', err);
        if (typeof showNotification === 'function') showNotification('Error al deshacer el pago', 'error');
      }
      try { loadFinancing(); } catch (e) { console.warn('No se pudo refrescar financiación:', e); }
    };
    
    if (typeof showModal === 'function') {
      showModal({
        title: 'Deshacer último pago',
        content: `<p>¿Seguro que quieres deshacer el último pago de <strong>${formatAmount(lastPayment.amount)}</strong> del ${new Date(lastPayment.date).toLocaleDateString('es-ES')}?</p><p class="text-warning">Esta acción eliminará también la transacción asociada.</p>`,
        size: 'small',
        buttons: [
          { text: 'Cancelar', type: 'secondary', onClick: () => closeModal() },
          { text: 'Deshacer', type: 'warning', onClick: async () => { await proceedUndo(); closeModal(); } }
        ]
      });
    } else {
      if (confirm(`¿Deshacer el último pago de ${formatAmount(lastPayment.amount)} del ${new Date(lastPayment.date).toLocaleDateString('es-ES')}?`)) {
        await proceedUndo();
      }
    }
  }

  function showAddLoanModal() {
    const html = `
      <form id="loan-add-form" class="loan-form">
        <div class="row">
          <input type="text" id="loan-name" placeholder="Nombre (ej. Coche)" required />
          <select id="loan-type-fin" required>
            <option value="Prestamo coche">Préstamo coche</option>
            <option value="Prestamo hipotecario">Préstamo hipotecario</option>
            <option value="Prestamo personal">Préstamo personal</option>
            <option value="Prestamo de familiares">Préstamo de familiares</option>
            <option value="Tarjeta Visa">Tarjeta Visa</option>
            <option value="Tarjeta revolving">Tarjeta revolving</option>
            <option value="Financiacion comercial">Financiación comercial</option>
          </select>
        </div>
        <div class="row">
          <div class="field">
            <label for="loan-start">Fecha de concesión</label>
            <input type="date" id="loan-start" required aria-label="Fecha de concesión" />
          </div>
          <div class="field">
            <label for="loan-first-installment">Fecha 1ª cuota</label>
            <input type="date" id="loan-first-installment" aria-label="Fecha 1ª cuota" />
          </div>
        </div>
        <div class="row">
          <input type="number" step="0.01" id="loan-amount" placeholder="Importe" required />
          <input type="number" step="0.01" id="loan-interest" placeholder="Interés (%)" />
          <input type="number" id="loan-installments" placeholder="Cuotas (meses)" />
        </div>
        <div class="row">
          <input type="number" step="0.01" id="loan-installment-amount" placeholder="Cuota mensual (auto)" />
          <input type="number" step="0.01" id="loan-first-amount" placeholder="Importe 1ª cuota" />
          <input type="number" step="0.01" id="loan-last-amount" placeholder="Importe última cuota" />
        </div>
        <div class="row">
          <input type="text" id="loan-institution" placeholder="Banco/Financiera/Familiar" />
          <input type="text" id="loan-concept" placeholder="Concepto" />
        </div>
        <div class="row">
          <label><input type="checkbox" id="loan-initial-tx" checked /> Crear transacción inicial</label>
        </div>
        <p class="hint">La cuota mensual se calcula automáticamente al introducir importe, interés y cuotas. Puedes modificarla manualmente.</p>
      </form>
    `;
    if (typeof showModal === 'function') {
      showModal({
        title: 'Añadir financiación',
        content: html,
        size: 'medium',
        buttons: [
          { text: 'Cancelar', type: 'secondary', onClick: () => closeModal() },
          { text: 'Guardar', type: 'primary', onClick: async () => {
              // Primero intentamos añadir la financiación; si falla, no continuamos
              try {
                const loan = {
                  name: document.getElementById('loan-name').value.trim(),
                  typeOfFinancing: document.getElementById('loan-type-fin').value,
                  amount: Number(document.getElementById('loan-amount').value),
                  startDate: document.getElementById('loan-start').value,
                  firstInstallmentDate: document.getElementById('loan-first-installment').value || undefined,
                  installments: Number(document.getElementById('loan-installments').value) || undefined,
                  interestRate: Number(document.getElementById('loan-interest').value) || undefined,
                  installmentAmount: Number(document.getElementById('loan-installment-amount').value) || undefined,
                  firstInstallmentAmount: Number(document.getElementById('loan-first-amount').value) || undefined,
                  lastInstallmentAmount: Number(document.getElementById('loan-last-amount').value) || undefined,
                  institution: document.getElementById('loan-institution').value.trim() || undefined,
                  concept: document.getElementById('loan-concept').value.trim() || undefined,
                  initialTransaction: document.getElementById('loan-initial-tx').checked,
                  type: 'expense'
                };
                await LoansManager.add(loan);
              } catch (err) {
                console.error('No se pudo añadir la financiación:', err);
                if (typeof showNotification === 'function') {
                  showNotification('Error al añadir financiación', 'error');
                }
                return; // Evitamos mostrar mensajes adicionales si falló el alta
              }
              // Cerrar modal y refrescar lista; si falla el refresco, no mostrar error de "añadir"
              try { closeModal(); } catch (_) {}
              try { loadFinancing(); } catch (e) { console.warn('No se pudo refrescar financiación:', e); }
            }
          }
        ]
      });
      // Auto-cálculo de cuota mensual
      const amt = document.getElementById('loan-amount');
      const rate = document.getElementById('loan-interest');
      const inst = document.getElementById('loan-installments');
      const cuota = document.getElementById('loan-installment-amount');
      const recalc = () => {
        const P = Number(amt.value) || 0;
        const r = (Number(rate.value) || 0) / 100 / 12;
        const n = Number(inst.value) || 0;
        if (P > 0 && n > 0) {
          let c = 0;
          if (r > 0) c = P * r / (1 - Math.pow(1 + r, -n)); else c = P / n;
          cuota.value = (Math.round(c * 100) / 100).toString();
        }
      };
      [amt, rate, inst].forEach(el => el && el.addEventListener('input', recalc));
    }
  }

  function showEditLoanModal(loan) {
    if (!loan) return;
    const html = `
      <form id="loan-edit-form" class="loan-form">
        <div class="row">
          <input type="text" id="loan-name" placeholder="Nombre" value="${loan.name || ''}" required />
          <select id="loan-type-fin" required>
            <option value="Prestamo coche" ${loan.typeOfFinancing==='Prestamo coche'?'selected':''}>Préstamo coche</option>
            <option value="Prestamo hipotecario" ${loan.typeOfFinancing==='Prestamo hipotecario'?'selected':''}>Préstamo hipotecario</option>
            <option value="Prestamo personal" ${loan.typeOfFinancing==='Prestamo personal'?'selected':''}>Préstamo personal</option>
            <option value="Prestamo de familiares" ${loan.typeOfFinancing==='Prestamo de familiares'?'selected':''}>Préstamo de familiares</option>
            <option value="Tarjeta Visa" ${loan.typeOfFinancing==='Tarjeta Visa'?'selected':''}>Tarjeta Visa</option>
            <option value="Tarjeta revolving" ${loan.typeOfFinancing==='Tarjeta revolving'?'selected':''}>Tarjeta revolving</option>
            <option value="Financiacion comercial" ${loan.typeOfFinancing==='Financiacion comercial'?'selected':''}>Financiación comercial</option>
          </select>
        </div>
        <div class="row">
          <div class="field">
            <label for="loan-start">Fecha de concesión</label>
            <input type="date" id="loan-start" value="${loan.startDate ? String(loan.startDate).slice(0,10) : ''}" required />
          </div>
          <div class="field">
            <label for="loan-first-installment">Fecha 1ª cuota</label>
            <input type="date" id="loan-first-installment" value="${loan.firstInstallmentDate ? String(loan.firstInstallmentDate).slice(0,10) : ''}" />
          </div>
        </div>
        <div class="row">
          <input type="number" step="0.01" id="loan-amount" placeholder="Importe" value="${Number(loan.amount)||0}" required />
          <input type="number" step="0.01" id="loan-interest" placeholder="Interés (%)" value="${Number(loan.interestRate)||0}" />
          <input type="number" id="loan-installments" placeholder="Cuotas" value="${Number(loan.installments)||0}" />
        </div>
        <div class="row">
          <input type="number" step="0.01" id="loan-installment-amount" placeholder="Cuota mensual" value="${Number(loan.installmentAmount)||''}" />
          <input type="number" step="0.01" id="loan-first-amount" placeholder="1ª cuota" value="${Number(loan.firstInstallmentAmount)||''}" />
          <input type="number" step="0.01" id="loan-last-amount" placeholder="Última cuota" value="${Number(loan.lastInstallmentAmount)||''}" />
        </div>
        <div class="row">
          <input type="text" id="loan-institution" placeholder="Entidad" value="${loan.institution || ''}" />
          <input type="text" id="loan-concept" placeholder="Concepto" value="${loan.concept || ''}" />
        </div>
      </form>
    `;
    if (typeof showModal === 'function') {
      showModal({
        title: 'Editar financiación',
        content: html,
        size: 'medium',
        buttons: [
          { text: 'Cancelar', type: 'secondary', onClick: () => closeModal() },
          { text: 'Guardar', type: 'primary', onClick: async () => {
              try {
                loan.name = document.getElementById('loan-name').value.trim();
                loan.typeOfFinancing = document.getElementById('loan-type-fin').value;
                loan.amount = Number(document.getElementById('loan-amount').value) || 0;
                loan.startDate = document.getElementById('loan-start').value || loan.startDate;
                loan.firstInstallmentDate = document.getElementById('loan-first-installment').value || loan.firstInstallmentDate;
                loan.installments = Number(document.getElementById('loan-installments').value) || loan.installments;
                loan.interestRate = Number(document.getElementById('loan-interest').value) || loan.interestRate;
                loan.installmentAmount = Number(document.getElementById('loan-installment-amount').value) || loan.installmentAmount;
                loan.firstInstallmentAmount = Number(document.getElementById('loan-first-amount').value) || loan.firstInstallmentAmount;
                loan.lastInstallmentAmount = Number(document.getElementById('loan-last-amount').value) || loan.lastInstallmentAmount;
                loan.institution = document.getElementById('loan-institution').value.trim() || undefined;
                loan.concept = document.getElementById('loan-concept').value.trim() || undefined;
                await LoansManager.update(loan);
                closeModal();
                loadFinancing();
              } catch (err) {
                console.error('No se pudo actualizar la financiación:', err);
                if (typeof showNotification === 'function') {
                  showNotification('Error al actualizar financiación', 'error');
                }
              }
            }
          }
        ]
      });
      // Auto-cálculo de cuota mensual
      const amt = document.getElementById('loan-amount');
      const rate = document.getElementById('loan-interest');
      const inst = document.getElementById('loan-installments');
      const cuota = document.getElementById('loan-installment-amount');
      const recalc = () => {
        const A = Number(amt.value) || 0;
        const N = Number(inst.value) || 0;
        const Rm = (Number(rate.value) || 0) / 100 / 12;
        let c = 0;
        if (A > 0 && N > 0) {
          c = Rm > 0 ? (A * Rm) / (1 - Math.pow(1 + Rm, -N)) : (A / N);
        }
        cuota.value = c ? (Math.round(c * 100) / 100) : '';
      };
      ['input','change'].forEach(ev => { amt.addEventListener(ev, recalc); rate.addEventListener(ev, recalc); inst.addEventListener(ev, recalc); });
    }
  }

  function showLoanScheduleModal(loan) {
    if (!loan) return;
    
    // Generar o usar el cuadro de amortización existente
    let schedule = Array.isArray(loan.schedule) && loan.schedule.length
      ? loan.schedule
      : null;
    
    // Si no hay cuadro o no tiene las nuevas columnas, regenerarlo
    if (!schedule || !schedule[0] || typeof schedule[0].interest === 'undefined') {
      if (typeof LoansManager !== 'undefined' && LoansManager.computeSchedule) {
        schedule = LoansManager.computeSchedule(loan);
      } else {
        // Fallback simple si no está disponible LoansManager
        const start = loan.firstInstallmentDate ? new Date(loan.firstInstallmentDate) : (loan.startDate ? new Date(loan.startDate) : new Date());
        const n = Number(loan.installments) || 0;
        const per = (loan.installmentAmount || (loan.amount && n ? loan.amount / n : 0));
        schedule = [];
        for (let i = 0; i < n; i++) {
          const d = new Date(start);
          d.setMonth(d.getMonth() + i);
          schedule.push({ idx: i + 1, date: d.toISOString().slice(0,10), amount: per, interest: 0, principal: per, pendingAmount: 0 });
        }
      }
    }
    
    const payments = Array.isArray(loan.payments) ? loan.payments : [];
    const paidIdxSet = new Set(payments.map(p => Number(p.idx)).filter(n => Number.isFinite(n)));
    const table = schedule.length ? schedule.map((r) => {
      const isPaid = paidIdxSet.has(Number(r.idx));
      let actionCell = '';
      actionCell = isPaid
        ? `<div class="action-inline"><span class="badge success">Pagada</span><button class="btn btn-small warning" data-action="mark-pending" data-idx="${r.idx}">Marcar pendiente</button></div>`
        : `<div class="action-inline"><span class="badge warning">Pendiente</span><button class="btn btn-small" data-action="pay-installment" data-idx="${r.idx}" data-amount="${Number(r.amount)||0}" data-date="${r.date}">Pagar</button></div>`;
      return `
      <tr>
        <td>#${r.idx}</td>
        <td><input type="date" class="sched-date" value="${r.date}" data-idx="${r.idx}" /></td>
        <td><input type="number" step="0.01" class="sched-amount" value="${Number(r.amount || 0)}" data-idx="${r.idx}" /></td>
        <td class="sched-interest">${formatAmount(r.interest || 0)}</td>
        <td class="sched-principal">${formatAmount(r.principal || 0)}</td>
        <td class="sched-pending">${formatAmount(r.pendingAmount || 0)}</td>
        <td>${actionCell}</td>
      </tr>
      `;
    }).join('') : '<tr><td colspan="7">Sin cuotas definidas.</td></tr>';
    
    const html = `
      <div class="loan-schedule">
        <h3>${loan.name || 'Financiación'}</h3>
        <p class="hint">Modifica fechas e importes de cada cuota. Los intereses, capital y pendiente se calculan automáticamente.</p>
        <div class="table-container">
          <table class="preview-table amortization-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Fecha</th>
                <th>Cuota</th>
                <th>Intereses</th>
                <th>Capital</th>
                <th>Pendiente</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>${table}</tbody>
          </table>
        </div>
      </div>
    `;
    if (typeof showModal === 'function') {
      showModal({
        title: 'Plan de pagos',
        content: html,
        size: 'large',
        buttons: [
          { text: 'Cerrar', type: 'secondary', onClick: () => closeModal() },
          { text: 'Guardar', type: 'primary', onClick: async () => {
              try {
                const dates = Array.from(document.querySelectorAll('.sched-date'));
                const amounts = Array.from(document.querySelectorAll('.sched-amount'));
                const rows = dates.map((dEl, i) => ({
                  idx: Number(dEl.getAttribute('data-idx')),
                  date: dEl.value,
                  amount: Number(amounts[i].value) || 0
                }));
                loan.schedule = rows;
                loan.installments = rows.length;
                loan.installmentAmount = rows[0] ? rows[0].amount : loan.installmentAmount;
                loan.firstInstallmentAmount = rows[0] ? rows[0].amount : loan.firstInstallmentAmount;
                loan.lastInstallmentAmount = rows[rows.length - 1] ? rows[rows.length - 1].amount : loan.lastInstallmentAmount;
                await LoansManager.update(loan);
                closeModal();
                loadFinancing();
              } catch (err) {
                console.error('No se pudo guardar el plan:', err);
                if (typeof showNotification === 'function') {
                  showNotification('Error al guardar plan de pagos', 'error');
                }
              }
            }
          }
        ],
        onOpen: () => {
          const payButtons = Array.from(document.querySelectorAll('button[data-action="pay-installment"]'));
          payButtons.forEach(btn => {
            btn.addEventListener('click', async () => {
              const amount = Number(btn.getAttribute('data-amount')) || 0;
              const date = btn.getAttribute('data-date') || new Date().toISOString().slice(0,10);
              const idx = Number(btn.getAttribute('data-idx')) || null;
              if (amount <= 0) { if (typeof showNotification === 'function') showNotification('Importe de cuota inválido', 'error'); return; }
              try {
                await LoansManager.registerPayment(loan.id, amount, date, null, idx);
                if (typeof showNotification === 'function') showNotification('Cuota pagada', 'success');
                // Actualizar UI sin cerrar el modal
                if (!Array.isArray(loan.payments)) loan.payments = [];
                loan.payments.push({ date, amount, idx });
                const cell = btn.closest('td');
                if (cell) {
                  cell.innerHTML = `<div class="action-inline"><span class="badge success">Pagada</span><button class="btn btn-small warning" data-action="mark-pending" data-idx="${idx}">Marcar pendiente</button></div>`;
                  const newBtn = cell.querySelector('button[data-action="mark-pending"]');
                  if (newBtn) {
                    newBtn.addEventListener('click', async () => {
                      try {
                        await LoansManager.markInstallmentPending(loan.id, idx);
                        loan.payments = loan.payments.filter(p => Number(p.idx) !== Number(idx));
                        // Obtener valores actuales de la fila
                        const tr = newBtn.closest('tr');
                        const amountEl = tr ? tr.querySelector('.sched-amount') : null;
                        const dateEl = tr ? tr.querySelector('.sched-date') : null;
                        const curAmount = amountEl ? Number(amountEl.value) || amount : amount;
                        const curDate = dateEl ? dateEl.value || date : date;
                        cell.innerHTML = `<div class="action-inline"><span class="badge warning">Pendiente</span><button class="btn btn-small" data-action="pay-installment" data-idx="${idx}" data-amount="${curAmount}" data-date="${curDate}">Pagar</button></div>`;
                        const payBtnAgain = cell.querySelector('button[data-action="pay-installment"]');
                        if (payBtnAgain) {
                          payBtnAgain.addEventListener('click', async () => {
                            try {
                              const a = Number(payBtnAgain.getAttribute('data-amount')) || curAmount;
                              const d = payBtnAgain.getAttribute('data-date') || curDate;
                              await LoansManager.registerPayment(loan.id, a, d, null, idx);
                              loan.payments.push({ date: d, amount: a, idx });
                              cell.innerHTML = `<div class="action-inline"><span class="badge success">Pagada</span><button class="btn btn-small warning" data-action="mark-pending" data-idx="${idx}">Marcar pendiente</button></div>`;
                            } catch (err) {
                              console.error('Error al pagar cuota:', err);
                              if (typeof showNotification === 'function') showNotification('Error al pagar cuota', 'error');
                            }
                          });
                        }
                      } catch (err) {
                        console.error('Error al marcar como pendiente:', err);
                        if (typeof showNotification === 'function') showNotification('Error al marcar pendiente', 'error');
                      }
                    });
                  }
                }
              } catch (err) {
                console.error('Error al pagar cuota:', err);
                if (typeof showNotification === 'function') showNotification('Error al pagar cuota', 'error');
              }
            });
          });
          const unpayButtons = Array.from(document.querySelectorAll('button[data-action="mark-pending"]'));
          unpayButtons.forEach(btn => {
            btn.addEventListener('click', async () => {
              try {
                const idx = Number(btn.getAttribute('data-idx')) || null;
                await LoansManager.markInstallmentPending(loan.id, idx);
                // Actualizar estado local y UI sin cerrar el modal
                loan.payments = (loan.payments || []).filter(p => Number(p.idx) !== Number(idx));
                const cell = btn.closest('td');
                const tr = btn.closest('tr');
                const amountEl = tr ? tr.querySelector('.sched-amount') : null;
                const dateEl = tr ? tr.querySelector('.sched-date') : null;
                const amount = amountEl ? Number(amountEl.value) || 0 : 0;
                const date = dateEl ? dateEl.value || new Date().toISOString().slice(0,10) : new Date().toISOString().slice(0,10);
                if (cell) {
                  cell.innerHTML = `<div class="action-inline"><span class="badge warning">Pendiente</span><button class="btn btn-small" data-action="pay-installment" data-idx="${idx}" data-amount="${amount}" data-date="${date}">Pagar</button></div>`;
                  const payBtn = cell.querySelector('button[data-action="pay-installment"]');
                  if (payBtn) {
                    payBtn.addEventListener('click', async () => {
                      try {
                        const a = Number(payBtn.getAttribute('data-amount')) || amount;
                        const d = payBtn.getAttribute('data-date') || date;
                        await LoansManager.registerPayment(loan.id, a, d, null, idx);
                        loan.payments.push({ date: d, amount: a, idx });
                        cell.innerHTML = `<div class="action-inline"><span class="badge success">Pagada</span><button class="btn btn-small warning" data-action="mark-pending" data-idx="${idx}">Marcar pendiente</button></div>`;
                      } catch (err) {
                        console.error('Error al pagar cuota:', err);
                        if (typeof showNotification === 'function') showNotification('Error al pagar cuota', 'error');
                      }
                    });
                  }
                }
              } catch (err) {
                console.error('Error al marcar como pendiente:', err);
                if (typeof showNotification === 'function') showNotification('Error al marcar pendiente', 'error');
              }
            });
          });
        }
      });
    }
  }

  function showRegisterPaymentModal(loan) {
    if (!loan) return;
    const html = `
      <form id="loan-pay-form" class="loan-form">
        <div class="row">
          <input type="date" id="pay-date" value="${new Date().toISOString().slice(0,10)}" />
          <input type="number" step="0.01" id="pay-amount" placeholder="Importe de cuota" value="${loan.installmentAmount || ''}" />
          <select id="pay-member" class="form-control">
            ${typeof FamilyManager !== 'undefined' ? FamilyManager.generateMemberOptions('Todos') : '<option value="Todos">Todos</option>'}
          </select>
        </div>
      </form>
    `;
    if (typeof showModal === 'function') {
      showModal({
        title: 'Registrar pago',
        content: html,
        size: 'small',
        buttons: [
          { text: 'Cancelar', type: 'secondary', onClick: () => closeModal() },
          { text: 'Registrar', type: 'primary', onClick: async () => {
              try {
                const d = document.getElementById('pay-date').value;
                const a = Number(document.getElementById('pay-amount').value) || 0;
                const m = document.getElementById('pay-member').value;
                await LoansManager.registerPayment(loan.id, a, d, m);
                closeModal();
                loadFinancing();
              } catch (err) {
                console.error('No se pudo registrar el pago:', err);
                if (typeof showNotification === 'function') {
                  showNotification('Error al registrar pago', 'error');
                }
              }
            }
          }
        ]
      });
    }
  }

  // ===== Vista previa de extractos y mapeo manual =====
  function showStatementPreviewModal(rows, headers, onConfirm) {
    const id = 'stmt-preview';
    const headerOptions = headers.map(h => `<option value="${h}">${h}</option>`).join('');
    const content = `
      <div class="stmt-preview">
        <div class="map-controls">
          <label>Fecha: <select id="${id}-date">${headerOptions}</select></label>
          <label>Concepto: <select id="${id}-desc">${headerOptions}</select></label>
          <label>Importe: <select id="${id}-amount">${headerOptions}</select></label>
          <label>Tipo: <select id="${id}-type"><option value="">(auto)</option>${headerOptions}</select></label>
        </div>
        <div class="filter-controls">
          <label>Fecha inicio: <input type="date" id="${id}-start" /></label>
          <label>Fecha fin: <input type="date" id="${id}-end" /></label>
        </div>
        <div class="table-wrap">
          ${renderPreviewTable(rows, headers)}
        </div>
      </div>`;
    if (typeof showModal === 'function') {
      showModal({
        title: 'Vista previa y mapeo manual',
        content,
        size: 'large',
        buttons: [
          { text: 'Cancelar', type: 'secondary', onClick: () => closeModal() },
          { text: 'Guardar', type: 'primary', onClick: () => {
              const map = {
                date: document.getElementById(`${id}-date`).value,
                description: document.getElementById(`${id}-desc`).value,
                amount: document.getElementById(`${id}-amount`).value,
                type: document.getElementById(`${id}-type`).value || null
              };
              const filters = {
                start: document.getElementById(`${id}-start`).value || null,
                end: document.getElementById(`${id}-end`).value || null
              };
              closeModal();
              onConfirm(map, filters);
            }
          }
        ]
      });
    } else {
      onConfirm({ date: 'date', description: 'description', amount: 'amount', type: null }, null);
    }
  }

  function renderPreviewTable(rows, headers) {
    const headerHtml = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
    const bodyHtml = `<tbody>${rows.slice(0, 30).map(r =>
      `<tr>` + headers.map(h => `<td>${(r[h] ?? '').toString()}</td>`).join('') + `</tr>`
    ).join('')}</tbody>`;
    return `<table class="preview-table">${headerHtml}${bodyHtml}</table>`;
  }

  function summarizeByCategory(txs) {
    const map = {};
    for (const t of txs) {
      const cat = t.category || 'otros';
      if (!map[cat]) map[cat] = { income: 0, expense: 0 };
      const amt = Number(t.amount) || 0;
      if ((t.type || t.kind) === 'income') map[cat].income += amt;
      else map[cat].expense += amt;
    }
    return map;
  }

  function renderCategorySummary(summary) {
    const cats = Object.keys(summary);
    if (!cats.length) return '';
    const rows = cats.map(c => {
      const s = summary[c];
      const inc = formatAmount(s.income);
      const exp = formatAmount(s.expense);
      return `<div class="cat-row"><span class="cat">${c}</span><span class="inc">+${inc}</span><span class="exp">-${exp}</span></div>`;
    }).join('');
    return `<div class="import-summary"><h4>Resumen por categoría</h4>${rows}</div>`;
  }

  function renderCategoryDetails(details) {
    const cats = Object.keys(details || {});
    if (!cats.length) return '';
    const sections = cats.map(c => {
      const items = details[c].map(it => `<div class="detail-row"><span>${it.description}</span><span class="${it.type==='expense'?'neg':'pos'}">${(it.type==='expense'?'-':'+')}${formatAmount(it.amount)}</span></div>`).join('');
      return `<div class="cat-details"><h5>${c}</h5>${items}</div>`;
    }).join('');
    return `<div class="import-details" style="display:none">${sections}</div>`;
  }

  // Exponer globalmente para ui-dashboard.js y ui.js
  window.getRecentTransactions = getRecentTransactions;
  window.getTransactionsSummary = getTransactionsSummary;
  window.loadTransactions = loadTransactions;
  window.loadScanner = loadScanner;
  window.loadForecast = loadForecast;
  window.loadFinancing = loadFinancing;
  window.loadSettings = loadSettings;
  window.getAllTransactions = getAllTransactions;
})();