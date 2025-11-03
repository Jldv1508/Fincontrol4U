// Simple helpers y loaders para transacciones y pestañas
// Depende de `DB` global (definido en db.js) y del contenedor `mainContent`

(function () {
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
    const num = Number(v) || 0;
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(num);
  }

  function loadTransactions() {
    const main = ensureMain();
    if (!main) return;
    main.innerHTML = `
      <section class="transactions-view">
        <div class="tx-toolbar">
          <div class="tx-title"><i class="fas fa-exchange-alt"></i> <span>Transacciones</span></div>
          <div class="tx-actions">
            <button id="tx-add-btn" class="btn btn-primary"><i class="fas fa-plus"></i> Añadir</button>
          </div>
        </div>

        <div class="tx-summary" id="tx-summary">
          <div class="card income"><h4>Ingresos</h4><div class="amount" id="sum-income">€0.00</div></div>
          <div class="card expense"><h4>Gastos</h4><div class="amount" id="sum-expense">€0.00</div></div>
          <div class="card balance"><h4>Balance</h4><div class="amount" id="sum-balance">€0.00</div></div>
          <div class="card"><h4>Transacciones</h4><div class="amount" id="sum-count">0</div></div>
        </div>

        <div class="tx-filters">
          <div class="filters-basic">
            <select id="flt-type" class="form-control">
              <option value="">Todos</option>
              <option value="expense">Gasto</option>
              <option value="income">Ingreso</option>
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
            </select>
            <input type="text" id="tx-category" placeholder="Categoría" required />
            <select id="tx-member" class="form-control">
              <option value="Todos">Todos</option>
            </select>
            <input type="text" id="tx-desc" placeholder="Descripción" />
            <button type="submit" class="btn btn-primary"><i class="fas fa-plus"></i> Añadir manualmente</button>
          </div>
        </form>

        <div id="tx-list" class="tx-list">
          <div class="loading">Cargando transacciones...</div>
        </div>
      </section>
    `;

    // Inicializar selector de miembros
    const memberSelect = document.getElementById('tx-member');
    if (memberSelect && typeof FamilyManager !== 'undefined') {
      memberSelect.innerHTML = FamilyManager.generateMemberOptions('Todos');
    }

    // Inicializar filtros de miembro
    const memberFilter = document.getElementById('flt-member');
    if (memberFilter && typeof FamilyManager !== 'undefined') {
      const members = FamilyManager.getMembers();
      memberFilter.innerHTML = '<option value="">Todos los miembros</option>' + members.filter(m => m !== 'Todos').map(m => `<option value="${m}">${m}</option>`).join('');
    }

    // Inicializar autocompletado de categorías
    initCategoryFilter();

    // Inicializar chips de categorías
    initCategoryChips();

    // Alta rápida de transacción
    const form = document.getElementById('tx-add-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const amount = Number(document.getElementById('tx-amount').value);
        const type = document.getElementById('tx-type').value;
        const category = document.getElementById('tx-category').value.trim() || 'other';
        const member = document.getElementById('tx-member').value;
        const description = document.getElementById('tx-desc').value.trim();
        const tx = {
          id: 'trans_' + Date.now(),
          amount,
          type,
          category,
          member,
          description,
          date: new Date().toISOString()
        };
        try {
          await DB.add('transactions', tx);
          if (typeof showNotification === 'function') {
            showNotification('Transacción añadida', 'success');
          }
          // Recargar listado y resumen
          renderTransactionsList();
          renderTransactionsSummary();
          initCategoryFilter();
          initCategoryChips();
        } catch (err) {
          console.error('No se pudo añadir la transacción', err);
          if (typeof showNotification === 'function') {
            showNotification('Error al añadir transacción', 'error');
          }
        }
        form.reset();
      });
    }

    // Botón añadir (focus al formulario)
    const addBtn = document.getElementById('tx-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        document.getElementById('tx-amount')?.focus();
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

  // Pintar listado inicialmente
  loadFilters();
  renderTransactionsList();
  renderTransactionsSummary();
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
        const sign = (t.type || t.kind) === 'expense' ? '-' : '+';
        return `
          <div class="tx-item" data-id="${t.id}">
            <div>
              <div class="tx-head">
                <span class="tx-date"><i class="fas fa-calendar-day"></i> ${date}</span>
                <span class="tx-amount ${sign === '-' ? 'neg' : 'pos'}">${sign}${amt}</span>
              </div>
              <div class="tx-body">
                <span class="chip category"><i class="fas fa-tag"></i> ${cat}</span>
                ${t.member ? `<span class="chip member"><i class="fas fa-user"></i> ${t.member}</span>` : ''}
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
      if (start && d < start) return false;
      if (end && d > end) return false;
      if (typeVal && (t.type || t.kind) !== typeVal) return false;
      if (memberVal && t.member && t.member !== memberVal) return false;
      if (wantedCats.length) {
        const cat = (t.category || '').toLowerCase();
        if (!wantedCats.includes(cat)) return false;
      }
      if (queryVal) {
        const text = `${t.description || ''} ${t.category || ''}`.toLowerCase();
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

  async function initCategoryFilter() {
    const dataList = document.getElementById('categories-list');
    if (!dataList) return;
    const list = await getAllTransactions();
    const cats = Array.from(new Set(list.map(t => (t.category || '').trim()).filter(Boolean))).sort();
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
            </select>
          </div>
          <div class="row">
            <input type="text" id="edit-category" value="${tx.category || ''}" placeholder="Categoría" required />
            <select id="edit-member" class="form-control">
              ${typeof FamilyManager !== 'undefined' ? FamilyManager.generateMemberOptions(tx.member || 'Todos') : '<option value="Todos">Todos</option>'}
            </select>
            <input type="text" id="edit-desc" value="${tx.description || tx.concept || ''}" placeholder="Descripción" />
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
                const updated = {
                  ...tx,
                  id: tx.id,
                  date: document.getElementById('edit-date').value,
                  amount: Number(document.getElementById('edit-amount').value) || 0,
                  type: document.getElementById('edit-type').value,
                  category: document.getElementById('edit-category').value.trim(),
                  member: document.getElementById('edit-member').value,
                  description: document.getElementById('edit-desc').value.trim(),
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
              }
            }
          ]
        });
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
        <div class="scanner-actions">
          <button id="scan-camera-btn" class="btn primary"><i class="fas fa-camera"></i> Escanear con cámara</button>
          <label class="btn">
            <i class="fas fa-file-image"></i> Subir imagen
            <input type="file" id="scan-image-input" accept="image/*" style="display:none" />
          </label>
        </div>
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

    const cameraBtn = document.getElementById('scan-camera-btn');
    const imageInput = document.getElementById('scan-image-input');

    if (cameraBtn) {
      cameraBtn.addEventListener('click', async () => {
        try {
          if (window.OCRManager && typeof window.OCRManager.init === 'function') {
            await window.OCRManager.init();
          }
        } catch (e) {
          console.warn('No se pudo inicializar OCR:', e);
        }
        if (window.OCRManager && typeof window.OCRManager.showScanInterface === 'function') {
          window.OCRManager.showScanInterface();
        } else {
          document.getElementById('scanner-status').textContent = 'OCR no disponible. Revisa que ocr.js esté cargado.';
          if (typeof showNotification === 'function') {
            showNotification('OCR no disponible', 'warning');
          }
        }
      });
    }

    if (imageInput) {
      imageInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
          if (window.OCRManager && typeof window.OCRManager.init === 'function' && !window.OCRManager.state?.isInitialized) {
            await window.OCRManager.init();
          }
          if (window.OCRManager && typeof window.OCRManager.processUploadedImage === 'function') {
            window.OCRManager.processUploadedImage(file);
          } else {
            document.getElementById('scanner-status').textContent = 'OCR no disponible para imágenes.';
          }
        } catch (err) {
          console.error('Error procesando imagen:', err);
          document.getElementById('scanner-status').textContent = 'Error al procesar la imagen. Intenta con otra imagen o revisa conexión.';
          if (typeof showNotification === 'function') {
            showNotification('Error OCR en imagen', 'error');
          }
        }
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
          return tx.id || true;
        } catch (e) {
          console.error('Shim: Error añadiendo transacción', e);
          throw e;
        }
      }
    };
  }

  function loadForecast() {
    const main = ensureMain();
    if (!main) return;
    main.innerHTML = `
      <section class="forecast-view">
        <h2>Previsión</h2>
        <p class="hint">Proyección basada en históricos y calendario de gastos.</p>
        <div class="card chart-card">
          <h3>Previsión de Ingresos y Gastos (3 meses)</h3>
          <div class="chart-wrapper">
            <canvas id="forecastChart"></canvas>
          </div>
        </div>
        <div class="card">
          <h3>Calendario de gastos del año actual</h3>
          <div id="forecastCalendar" class="calendar-grid"></div>
        </div>
        <div class="card">
          <h3>Forecast editable del próximo año</h3>
          <p class="hint">Edita los importes mensuales previstos y guarda tu plan.</p>
          <div id="editableForecast"></div>
          <div class="actions">
            <button id="saveForecastPlan" class="btn primary"><i class="fas fa-save"></i> Guardar plan</button>
          </div>
        </div>
      </section>
    `;
    renderForecastChartSimple('forecastChart', 3);
    renderForecastCalendar(new Date().getFullYear(), 'forecastCalendar');
    renderEditableForecastNextYear();
  }

  async function loadFinancing() {
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
  async function renderForecastChartSimple(canvasId, months = 3) {
    try {
      const el = document.getElementById(canvasId);
      if (!el) return;
      const all = await getAllTransactions();
      // Agrupar últimos 6 meses
      const now = new Date();
      const labels = [];
      const incomeSeries = [];
      const expenseSeries = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now);
        d.setMonth(d.getMonth() - i);
        const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const within = all.filter(t => {
          const td = new Date(t.date);
          return td >= monthStart && td <= monthEnd;
        });
        const inc = within.filter(t => (t.type || t.kind) === 'income').reduce((s,t)=> s + (Number(t.amount)||0), 0);
        const exp = within.filter(t => (t.type || t.kind) === 'expense').reduce((s,t)=> s + (Number(t.amount)||0), 0);
        labels.push(d.toLocaleString('es-ES', { month: 'short' }));
        incomeSeries.push(inc);
        expenseSeries.push(exp);
      }
      const incomeAvg = incomeSeries.reduce((a,b)=>a+b,0) / (incomeSeries.length || 1);
      const expenseAvg = expenseSeries.reduce((a,b)=>a+b,0) / (expenseSeries.length || 1);
      for (let j = 0; j < months; j++) {
        const fd = new Date(now);
        fd.setMonth(now.getMonth() + j + 1);
        labels.push(fd.toLocaleString('es-ES', { month: 'short' }) + '*');
        const incVar = (Math.random() * 0.2) - 0.1;
        const expVar = (Math.random() * 0.2) - 0.1;
        incomeSeries.push(incomeAvg * (1 + incVar));
        expenseSeries.push(expenseAvg * (1 + expVar));
      }
      if (typeof Chart !== 'undefined') {
        new Chart(el.getContext('2d'), {
          type: 'line',
          data: {
            labels,
            datasets: [
              { label: 'Ingresos', data: incomeSeries, borderColor: '#4CAF50', backgroundColor: 'rgba(76,175,80,0.1)' },
              { label: 'Gastos', data: expenseSeries, borderColor: '#F44336', backgroundColor: 'rgba(244,67,54,0.1)' }
            ]
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'Previsión de Ingresos y Gastos' } }, scales: { y: { beginAtZero: true } } }
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
    const months = Array.from({ length: 12 }, (_, m) => m);
    const monthly = months.map((m) => {
      const start = new Date(year, m, 1);
      const end = new Date(year, m + 1, 0);
      const within = all.filter(t => { const d = new Date(t.date); return d >= start && d <= end; });
      const exp = within.filter(t => (t.type || t.kind) === 'expense').reduce((s,t)=> s+(Number(t.amount)||0), 0);
      const inc = within.filter(t => (t.type || t.kind) === 'income').reduce((s,t)=> s+(Number(t.amount)||0), 0);
      return { month: m, expense: exp, income: inc, count: within.length };
    });
    container.innerHTML = months.map((m) => {
      const item = monthly[m];
      const name = new Date(year, m, 1).toLocaleString('es-ES', { month: 'long' });
      return `
        <div class="calendar-cell" data-month="${m}">
          <div class="cell-header">${name}</div>
          <div class="cell-body">
            <div><strong>Gastos:</strong> ${formatAmount(item.expense)}</div>
            <div><strong>Ingresos:</strong> ${formatAmount(item.income)}</div>
            <div><small>${item.count} movimientos</small></div>
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
    const end = new Date(year, month + 1, 0);
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
      return `<div class="forecast-input"><label>${label}</label><input type="number" step="0.01" data-month="${m}" value="${val}" /></div>`;
    }).join('');
    el.innerHTML = `<div class="forecast-inputs">${inputs}</div>`;
    const btn = document.getElementById('saveForecastPlan');
    if (btn) btn.onclick = async () => {
      const values = {};
      el.querySelectorAll('input[data-month]').forEach((inp) => { values[inp.getAttribute('data-month')] = Number(inp.value) || 0; });
      await DB.saveSetting(`forecast_${nextYear}`, values);
      if (typeof showNotification === 'function') showNotification('Plan de forecast guardado', 'success');
    };
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
            await window.TransactionsManager.add(tx);
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
    const str = String(s).trim();
    const neg = /\(.*\)/.test(str) || /^-/.test(str);
    const cleaned = str
      .replace(/[()\s]/g, '')
      .replace(/\./g, '')
      .replace(/,/g, '.')
      .replace(/^\+/, '')
      .replace(/^-/, '');
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
        container.innerHTML = `<p class="empty-state">No hay financiaciones registradas.</p>`;
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
            <button class="btn" data-action="pay-next">Pagar siguiente cuota</button>
            <button class="btn" data-action="payment">Registrar pago</button>
            ${doneInst > 0 ? '<button class="btn warning" data-action="undo-payment">Deshacer último pago</button>' : ''}
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
          } else if (action === 'pay-next') {
            try {
              const done = Array.isArray(loan.payments) ? loan.payments.length : 0;
              const nextRow = Array.isArray(loan.schedule) ? loan.schedule[done] : undefined;
              const amount = Number(nextRow?.amount ?? loan.installmentAmount ?? (loan.amount && loan.installments ? (loan.amount / loan.installments) : 0)) || 0;
              const date = nextRow?.date || new Date().toISOString().slice(0,10);
              if (amount <= 0) {
                if (typeof showNotification === 'function') showNotification('No hay importe de cuota definido', 'error');
                return;
              }
              await LoansManager.registerPayment(loan.id, amount, date);
              loadFinancing();
            } catch (err) {
              console.error('No se pudo registrar la siguiente cuota automáticamente:', err);
              if (typeof showNotification === 'function') {
                showNotification('Error al registrar cuota automática', 'error');
              }
            }
          } else if (action === 'payment') {
            showRegisterPaymentModal(loan);
          } else if (action === 'undo-payment') {
            confirmUndoLastPayment(loan);
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

  function showLoanScheduleModal(loan) {
    if (!loan) return;
    const schedule = Array.isArray(loan.schedule) && loan.schedule.length
      ? loan.schedule
      : (function(){
          const start = loan.firstInstallmentDate ? new Date(loan.firstInstallmentDate) : (loan.startDate ? new Date(loan.startDate) : new Date());
          const n = Number(loan.installments) || 0;
          const per = (loan.installmentAmount || (loan.amount && n ? loan.amount / n : 0));
          const rows = [];
          for (let i = 0; i < n; i++) {
            const d = new Date(start);
            d.setMonth(d.getMonth() + i);
            rows.push({ idx: i + 1, date: d.toISOString().slice(0,10), amount: per });
          }
          return rows;
        })();
    const table = schedule.length ? schedule.map(r => `
      <tr>
        <td>#${r.idx}</td>
        <td><input type="date" class="sched-date" value="${r.date}" data-idx="${r.idx}" /></td>
        <td><input type="number" step="0.01" class="sched-amount" value="${Number(r.amount || 0)}" data-idx="${r.idx}" /></td>
      </tr>
    `).join('') : '<tr><td colspan="3">Sin cuotas definidas.</td></tr>';
    const html = `
      <div class="loan-schedule">
        <h3>${loan.name || 'Financiación'}</h3>
        <p class="hint">Modifica fechas e importes de cada cuota. Guarda para aplicar cambios.</p>
        <table class="preview-table">
          <thead><tr><th>#</th><th>Fecha</th><th>Importe</th></tr></thead>
          <tbody>${table}</tbody>
        </table>
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
        ]
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
})();