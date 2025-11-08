// monthly-analysis.js - Vista de análisis mensual de ingresos y gastos
(function(){
  function getMemberClass(name){
    if(!name) return '';
    const slug = (name||'').toString().trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/\s+/g,'-');
    switch(slug){
      case 'jose-luis': return 'jose-luis';
      case 'gemma': return 'gemma';
      case 'hugo': return 'hugo';
      case 'alba': return 'alba';
      case 'familia': return 'familia';
      case 'otros': return 'otros';
      default: return 'otros';
    }
  }
  function ensureMain() {
    if (typeof window.ensureMain === 'function') return window.ensureMain();
    return document.getElementById('mainContent');
  }

  // Formateo de importes con separador de miles (globalizable)
  function formatAmount(v) {
    if (typeof window.formatAmount === 'function') {
      return window.formatAmount(v);
    }
    const num = Number(v) || 0;
    const s = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
    return s.replace(/\u00a0/g,'').replace(/\s*€/,'€');
  }
  if (typeof window.formatAmount !== 'function') {
    window.formatAmount = function(v){
      const num = Number(v) || 0;
      const s = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
      return s.replace(/\u00a0/g,'').replace(/\s*€/,'€');
    };
  }

  function monthKey(dStr) {
    if (!dStr) return 'Desconocido';
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return 'Desconocido';
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    return `${y}-${m}`;
  }

  function humanMonth(key) {
    const [y,m] = key.split('-');
    const date = new Date(Number(y), Number(m)-1, 1);
    return date.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
  }

  function groupByMonth(txs, memberFilter) {
    const data = {};
    for (const t of txs) {
      // Filtrado por miembro si aplica
      if (memberFilter && t.member && t.member !== memberFilter) continue;
      const key = monthKey(t.date);
      if (!data[key]) data[key] = { income: 0, expense: 0, categories: {}, members: {} };
      const amt = Number(t.amount)||0;
      const rawType = (t.type||t.kind);
      if (rawType === 'income') {
        data[key].income += amt;
      } else if (rawType === 'expense') {
        data[key].expense += amt;
      } // otros tipos (transferencia/traspaso) no se suman
      const cat = (t.category||'otros');
      if (!data[key].categories[cat]) data[key].categories[cat] = { income: 0, expense: 0, members: {} };
      if (rawType === 'income') data[key].categories[cat].income += amt;
      else if (rawType === 'expense') data[key].categories[cat].expense += amt;
      const member = t.member || 'Todos';
      data[key].members[member] = data[key].members[member] || { income: 0, expense: 0 };
      if (rawType === 'income') data[key].members[member].income += amt;
      else if (rawType === 'expense') data[key].members[member].expense += amt;
      // Desglose por miembro dentro de categoría
      data[key].categories[cat].members[member] = data[key].categories[cat].members[member] || { income: 0, expense: 0 };
      if (rawType === 'income') data[key].categories[cat].members[member].income += amt;
      else if (rawType === 'expense') data[key].categories[cat].members[member].expense += amt;
    }
    return data;
  }

  async function loadMonthlyAnalysis() {
    const main = ensureMain();
    if (!main) return;
    main.innerHTML = `
      <section class="monthly-analysis">
        <div class="analysis-toolbar">
          <h2><i class="fas fa-chart-bar"></i> Análisis Mensual</h2>
          <div class="filters">
            <select id="analysis-period" class="form-control">
              <option value="current-year">Año actual</option>
              <option value="last-year">Año anterior</option>
              <option value="all">Todo el período</option>
            </select>
            <div class="filter-group">
              <select id="analysis-months" class="form-control dropdown-hidden" multiple title="Meses"></select>
              <button id="select-some-months" class="btn btn-info btn-sm" title="Periodo">Periodo</button>
            </div>
            <div class="filter-group">
              <select id="analysis-categories" class="form-control dropdown-hidden" multiple title="Categorías"></select>
              <button id="select-some-categories" class="btn btn-info btn-sm" title="Categoría">Categoría</button>
            </div>
            <div class="filter-group">
              <select id="analysis-subjects" class="form-control dropdown-hidden" multiple title="Sujetos"></select>
              <button id="select-some-subjects" class="btn btn-info btn-sm" title="Sujeto">Sujeto</button>
            </div>
            <div class="actions-group">
              <button id="analysis-clear" class="btn btn-light btn-sm"><i class="fas fa-broom"></i> Borrar filtros</button>
            </div>
            <button id="analysis-apply" class="btn btn-primary"><i class="fas fa-filter"></i> Aplicar</button>
          </div>
        </div>
        <div class="analysis-intro" style="margin:10px 0;padding:10px;border:1px dashed #ccc;border-radius:6px;color:#444;">
          <p>
            Utiliza los filtros de período, categorías y sujetos para ajustar el análisis.
            Puedes exportar los datos y alternar entre resumen y detalles mensuales.
          </p>
        </div>
        <!-- Se ha eliminado el resumen de filtros activo para evitar el cuadro en blanco -->
        <div class="analysis-exports" id="analysis-exports">
          <button id="analysis-export-csv" class="btn btn-outline btn-sm"><i class="fas fa-file-csv"></i> Exportar CSV</button>
          <button id="analysis-export-excel" class="btn btn-outline btn-sm"><i class="fas fa-file-excel"></i> Exportar Excel</button>
          <button id="analysis-export-pdf" class="btn btn-outline btn-sm"><i class="fas fa-file-pdf"></i> Exportar PDF</button>
        </div>
        <div class="multi-panel hidden" id="multi-panel"></div>
        <div class="analysis-summary" id="analysis-summary"></div>
        <div class="member-comparison" id="member-comparison"></div>
        <div class="monthly-table-wrap">
          <table class="table" id="monthly-table">
            <thead><tr><th>Mes</th><th>Ingresos</th><th>Gastos</th><th>Balance</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="category-month-wrap" id="category-month"></div>
      </section>
    `;

    // Poblar miembros (multi-select)
    const membersSel = document.getElementById('analysis-members');
    if (membersSel) {
      const html = (typeof FamilyManager !== 'undefined')
        ? FamilyManager.generateMemberOptions('Todos')
        : '<option value="">Todos</option>';
      membersSel.innerHTML = html;
    }

    // Render al cambiar periodo para reconstruir meses/categorías
    document.getElementById('analysis-period')?.addEventListener('change', renderAnalysis);

    document.getElementById('analysis-apply')?.addEventListener('click', renderAnalysis);

    // (Eliminados) Botones "Todas" y "Ninguno" por filtro

    // (Eliminado) Presets de período rápido

    // Borrar filtros global
    document.getElementById('analysis-clear')?.addEventListener('click', () => {
      const monthsSel = document.getElementById('analysis-months');
      const catsSel = document.getElementById('analysis-categories');
      const subjectsSel = document.getElementById('analysis-subjects');
      if (monthsSel) for (const opt of monthsSel.options) opt.selected = false;
      if (catsSel) for (const opt of catsSel.options) opt.selected = false;
      if (subjectsSel) for (const opt of subjectsSel.options) opt.selected = false;
      renderAnalysis();
    });

    // Selección rápida "Varios"
    document.getElementById('select-some-months')?.addEventListener('click', () => openMultiPanel('months'));
    document.getElementById('select-some-categories')?.addEventListener('click', () => openMultiPanel('categories'));
    document.getElementById('select-some-subjects')?.addEventListener('click', () => openMultiPanel('subjects'));

    // Vista por defecto: mostrar Periodos; mantener resumen visible
    (() => {
      const show = (id, ok) => { const el = document.getElementById(id); if (el) el.style.display = ok ? '' : 'none'; };
      show('analysis-summary', true);
      const tableWrap = document.querySelector('.monthly-table-wrap');
      if (tableWrap) tableWrap.style.display = '';
      const catWrap = document.querySelector('.category-month-wrap');
      if (catWrap) catWrap.style.display = 'none';
      const memComp = document.querySelector('.member-comparison');
      if (memComp) memComp.style.display = 'none';
    })();

    // Exportar CSV
    document.getElementById('analysis-export-csv')?.addEventListener('click', async () => {
      try {
        const csv = await buildCurrentFilteredCSV();
        if (!csv) return;
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analisis-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (e) { console.error('Error exportando CSV', e); }
    });

    // Exportar Excel (XLS basado en tabla HTML)
    document.getElementById('analysis-export-excel')?.addEventListener('click', async () => {
      try {
        const ds = await buildCurrentFilteredRows();
        if (!ds || !ds.rows?.length) return;
        const html = buildExcelHTML(ds.headers, ds.rows);
        const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analisis-${Date.now()}.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (e) { console.error('Error exportando Excel', e); }
    });

    // Exportar PDF (vista imprimible simplificada)
    document.getElementById('analysis-export-pdf')?.addEventListener('click', () => {
      try {
        const summary = document.getElementById('analysis-summary')?.innerHTML || '';
        const memComp = document.getElementById('member-comparison')?.innerHTML || '';
        const tableWrap = document.querySelector('.monthly-table-wrap')?.innerHTML || '';
        const catWrap = document.getElementById('category-month')?.innerHTML || '';
        const af = document.getElementById('active-filters')?.innerHTML || '';
        const docHtml = `<!DOCTYPE html>
          <html lang="es">
          <head>
            <meta charset="utf-8" />
            <title>Export PDF - Análisis</title>
            <style>
              body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:24px;color:#222;}
              h1{font-size:20px;margin:0 0 12px;}
              .section{margin-bottom:20px;}
              table{width:100%;border-collapse:collapse;font-size:12px;}
              th,td{border:1px solid #ddd;padding:6px;text-align:left;}
              thead th{background:#f5f5f5;}
              .chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;}
              .chip{display:inline-block;border:1px solid #ddd;border-radius:20px;padding:4px 10px;font-size:11px;color:#333;}
            </style>
          </head>
          <body>
            <h1>Análisis financiero</h1>
            <div class="section">${af}</div>
            <div class="section">${summary}</div>
            <div class="section">${memComp}</div>
            <div class="section">${tableWrap}</div>
            <div class="section">${catWrap}</div>
            <script>window.print && window.print();</script>
          </body>
          </html>`;
        const w = window.open('', '_blank');
        if (!w) return;
        w.document.open();
        w.document.write(docHtml);
        w.document.close();
      } catch (e) { console.error('Error exportando PDF', e); }
    });

    await renderAnalysis();
  }

  async function renderAnalysis() {
    const period = document.getElementById('analysis-period')?.value || 'current-year';
    const monthsSel = document.getElementById('analysis-months');
    const catsSel = document.getElementById('analysis-categories');
    const subjectsSel = document.getElementById('analysis-subjects');
    const selectedMonths = Array.from(monthsSel?.selectedOptions || []).map(o => o.value);
    const selectedCats = Array.from(catsSel?.selectedOptions || []).map(o => o.value);
    const selectedSubjects = Array.from(subjectsSel?.selectedOptions || []).map(o => o.value).filter(v => v && v !== 'Todos');
    const all = (typeof window.getAllTransactions === 'function')
      ? await window.getAllTransactions()
      : (typeof DB !== 'undefined' ? await DB.getAll('transactions') : []);
    // Filtrado por periodo
    const now = new Date();
    let start = null, end = null;
    if (period === 'current-month') { start = new Date(now.getFullYear(), now.getMonth(), 1); end = new Date(now.getFullYear(), now.getMonth()+1, 0, 23, 59, 59, 999); }
    else if (period === 'last-month') { const lm = new Date(now.getFullYear(), now.getMonth()-1, 1); start = new Date(lm.getFullYear(), lm.getMonth(), 1); end = new Date(lm.getFullYear(), lm.getMonth()+1, 0, 23, 59, 59, 999); }
    else if (period === 'current-quarter') { const q = Math.floor(now.getMonth()/3); const sm = q*3; start = new Date(now.getFullYear(), sm, 1); end = new Date(now.getFullYear(), sm+3, 0, 23, 59, 59, 999); }
    else if (period === 'current-year') { start = new Date(now.getFullYear(),0,1); end = new Date(now.getFullYear(),11,31, 23, 59, 59, 999); }
    else if (period === 'last-year') { start = new Date(now.getFullYear()-1,0,1); end = new Date(now.getFullYear()-1,11,31, 23, 59, 59, 999); }
    const within = all.filter(t => {
      if (!t.date) return false;
      const d = new Date(t.date);
      const byDate = (!start || d >= start) && (!end || d <= end);
      return byDate;
    });

    // Construir opciones de meses y categorías según periodo
    const monthsAll = Object.keys(groupByMonth(within)).sort();
    if (monthsSel) {
      const prev = Array.from(monthsSel.selectedOptions || []).map(o => o.value);
      monthsSel.innerHTML = monthsAll.map(m => `<option value="${m}">${humanMonth(m)}</option>`).join('');
      // Por defecto: ninguna selección
      if (prev.length) { for (const opt of monthsSel.options) { if (prev.includes(opt.value)) opt.selected = true; } }
    }
    const catSet = new Set(within.map(t => t.category || 'otros'));
    const catsAll = Array.from(catSet).sort((a,b)=> a.localeCompare(b));
    if (catsSel) {
      const prev = Array.from(catsSel.selectedOptions || []).map(o => o.value);
      catsSel.innerHTML = catsAll.map(c => `<option value="${c}">${c}</option>`).join('');
      // Por defecto: ninguna selección
      if (prev.length) { for (const opt of catsSel.options) { if (prev.includes(opt.value)) opt.selected = true; } }
    }

    // Construir opciones de sujetos desde ajustes (FamilyManager)
    const fmList = (typeof FamilyManager !== 'undefined') ? FamilyManager.getMembers() : ['Todos','Otros'];
    const subjectsAll = fmList.filter(n => n && n !== 'Todos');
    if (subjectsSel) {
      const prev = Array.from(subjectsSel.selectedOptions || []).map(o => o.value).filter(v => v && v !== 'Todos');
      subjectsSel.innerHTML = subjectsAll.map(s => `<option value="${s}">${s}</option>`).join('');
      // Por defecto: ninguna selección
      if (prev.length) { for (const opt of subjectsSel.options) { if (prev.includes(opt.value)) opt.selected = true; } }
    }

    // (Eliminado) sincronización de menús desplegables

    // Aplicar filtros seleccionados (meses/categorías/sujetos)
    const filtered = within.filter(t => {
      const mk = monthKey(t.date);
      const cat = t.category || 'otros';
      const subj = t.member || '';
      const byMonth = !selectedMonths.length || selectedMonths.includes(mk);
      const byCat = !selectedCats.length || selectedCats.includes(cat);
      const bySubject = !selectedSubjects.length || selectedSubjects.includes(subj);
      return byMonth && byCat && bySubject;
    });

    const grouped = groupByMonth(filtered);
    const months = Object.keys(grouped).sort();

    // Resumen general
    const totIncome = filtered.filter(t => (t.type||t.kind)==='income').reduce((s,t)=> s+(Number(t.amount)||0), 0);
    const totExpense = filtered.filter(t => (t.type||t.kind)==='expense').reduce((s,t)=> s+(Number(t.amount)||0), 0);
    const summaryEl = document.getElementById('analysis-summary');
    if (summaryEl) {
      const monthsText = selectedMonths.length ? selectedMonths.map(humanMonth).join(', ') : 'Todos los meses';
      const catsText = selectedCats.length ? selectedCats.join(', ') : 'Todas las categorías';
      const subjectsText = selectedSubjects.length ? selectedSubjects.join(', ') : 'Todos los sujetos';
      summaryEl.innerHTML = `
        <div class="summary-cards">
          <div class="summary-card income"><h3>Ingresos</h3><p>${formatAmount(totIncome)}</p></div>
          <div class="summary-card expense"><h3>Gastos</h3><p>${formatAmount(totExpense)}</p></div>
          <div class="summary-card balance"><h3>Balance</h3><p>${formatAmount(totIncome - totExpense)}</p></div>
          <div class="summary-card"><h3>Transacciones</h3><p>${filtered.length}</p></div>
        </div>
      `;
    }

    // Comparativa entre sujetos (miembros)
    const compEl = document.getElementById('member-comparison');
    if (compEl) {
      const byMember = filtered.reduce((acc, t) => {
        const mem = t.member || 'Otros';
        const type = (t.type||t.kind) === 'income' ? 'income' : 'expense';
        const amt = Number(t.amount) || 0;
        acc[mem] = acc[mem] || { income: 0, expense: 0 };
        acc[mem][type] += amt;
        return acc;
      }, {});
      const sortBySel = document.getElementById('comp-sort-by');
      const sortDirBtn = document.getElementById('comp-sort-dir');
      const sortBy = sortBySel?.value || 'expense';
      const asc = sortDirBtn?.getAttribute('data-dir') === 'asc';
      const rows = Object.entries(byMember)
        .sort((a,b) => {
          const key = sortBy === 'name' ? 0 : sortBy;
          let va, vb;
          if (key===0) { return asc ? a[0].localeCompare(b[0]) : b[0].localeCompare(a[0]); }
          else if (key==='income') { va = a[1].income; vb = b[1].income; }
          else if (key==='balance') { va = (a[1].income - a[1].expense); vb = (b[1].income - b[1].expense); }
          else { va = a[1].expense; vb = b[1].expense; }
          return asc ? (va > vb ? 1 : va < vb ? -1 : 0) : (va < vb ? 1 : va > vb ? -1 : 0);
        })
        .map(([mem, agg]) => {
          const balance = agg.income - agg.expense;
          const pct = totExpense > 0 ? ((agg.expense / totExpense) * 100).toFixed(1) : '0.0';
          const cls = getMemberClass(mem);
          return `
            <tr>
              <td><span class="chip member ${cls}">${mem}</span></td>
              <td class="income">${formatAmount(agg.income)}</td>
              <td class="expense">-${formatAmount(agg.expense)}</td>
              <td class="balance">${formatAmount(balance)}</td>
              <td class="percent">${pct}%</td>
            </tr>
          `;
        }).join('');
      compEl.innerHTML = `
        <div class="comparison-wrap">
          <h3><i class="fas fa-users"></i> Comparativa por sujetos</h3>
          <div class="comparison-controls">
            <label>Ordenar por:
              <select id="comp-sort-by" class="form-control form-control-sm">
                <option value="expense">Gasto</option>
                <option value="income">Ingreso</option>
                <option value="balance">Balance</option>
                <option value="name">Nombre</option>
              </select>
            </label>
            <button id="comp-sort-dir" class="btn btn-sm" data-dir="desc" title="Dirección de orden">Desc</button>
          </div>
          <table class="table comparison-table">
            <thead>
              <tr><th>Sujeto</th><th>Ingresos</th><th>Gastos</th><th>Balance</th><th>% gasto</th></tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="5">Sin datos</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
      // Enlazar reordenación
      document.getElementById('comp-sort-by')?.addEventListener('change', renderAnalysis);
      const dirBtn = document.getElementById('comp-sort-dir');
      dirBtn?.addEventListener('click', () => { const cur = dirBtn.getAttribute('data-dir'); dirBtn.setAttribute('data-dir', cur==='asc' ? 'desc' : 'asc'); renderAnalysis(); });
    }

    // Guardar estado para exportación
    window.__analysisState = { period, selectedMonths, selectedCats, selectedSubjects };
    window.__analysisOptions = { monthsAll, catsAll, subjectsAll };

    // Resumen compacto de filtros activos
    const periodText = {
      'current-month':'Mes actual',
      'last-month':'Mes anterior',
      'current-quarter':'Trimestre actual',
      'current-year':'Año actual',
      'last-year':'Año anterior',
      'all':'Todo'
    }[period] || 'Período seleccionado';
    const af = document.getElementById('active-filters');
    if (af) {
      const mCount = selectedMonths.length ? `${selectedMonths.length} mes(es)` : 'todos los meses';
      const cCount = selectedCats.length ? `${selectedCats.length} categoría(s)` : 'todas las categorías';
      const sCount = selectedSubjects.length ? `${selectedSubjects.length} sujeto(s)` : 'todos los sujetos';
      const bal = totIncome - totExpense;
      af.innerHTML = `
        <div class="filter-summary">
          <span class="chip period"><i class="fas fa-calendar-alt"></i> ${periodText}</span>
          <span class="chip months"><i class="fas fa-calendar"></i> ${mCount}</span>
          <span class="chip categories"><i class="fas fa-tags"></i> ${cCount}</span>
          <span class="chip subjects"><i class="fas fa-user"></i> ${sCount}</span>
          <span class="chip txcount"><i class="fas fa-list"></i> ${filtered.length} transacciones</span>
          <span class="chip income"><i class="fas fa-arrow-up"></i> ${formatAmount(totIncome)}</span>
          <span class="chip expense"><i class="fas fa-arrow-down"></i> -${formatAmount(totExpense)}</span>
          <span class="chip balance"><i class="fas fa-equals"></i> ${formatAmount(bal)}</span>
          <button class="btn btn-link btn-sm" id="clear-all-inline"><i class="fas fa-undo"></i> Reiniciar</button>
        </div>`;
      document.getElementById('clear-all-inline')?.addEventListener('click', () => {
        const monthsSel = document.getElementById('analysis-months');
        const catsSel = document.getElementById('analysis-categories');
        const subjectsSel = document.getElementById('analysis-subjects');
        if (monthsSel) for (const opt of monthsSel.options) opt.selected = false;
        if (catsSel) for (const opt of catsSel.options) opt.selected = false;
        if (subjectsSel) for (const opt of subjectsSel.options) opt.selected = false;
        const periodSel = document.getElementById('analysis-period');
        if (periodSel) periodSel.value = 'current-year';
        renderAnalysis();
      });
    }

    // Tabla mensual
    const tbody = document.querySelector('#monthly-table tbody');
    if (tbody) {
      tbody.innerHTML = months.map(m => {
        const itm = grouped[m];
        const bal = itm.income - itm.expense;
        return `<tr data-month="${m}"><td>${humanMonth(m)}</td><td>${formatAmount(itm.income)}</td><td>${formatAmount(itm.expense)}</td><td>${formatAmount(bal)}</td></tr>`;
      }).join('') || '<tr><td colspan="4">Sin datos</td></tr>';
    }

    // Clasificación de gastos por categoría, mes y persona (respetando filtros)
    const catWrap = document.getElementById('category-month');
    if (catWrap) {
      catWrap.innerHTML = months.map(m => {
        const itm = grouped[m];
        let cats = Object.entries(itm.categories)
          .filter(([, val]) => (val.expense > 0 || val.income > 0))
          .sort((a,b)=> b[1].expense - a[1].expense);
        if (selectedCats.length) {
          cats = cats.filter(([catName]) => selectedCats.includes(catName));
        }
        const catHtml = cats.map(([cat, val]) => {
          let members = Object.entries(val.members)
            .filter(([, mv]) => mv.expense>0)
          // Filtrado por miembros eliminado del rediseño; se muestran todos los miembros por categoría/mes
          const membersHtml = members
            .map(([mem, mv]) => `<span class="chip member ${getMemberClass(mem)}">${mem}: ${formatAmount(mv.expense)}</span>`)
            .join('');
          return `
            <div class="cat-row">
              <div class="cat-name">${cat}</div>
              <div class="cat-expense">-${formatAmount(val.expense)}</div>
              <div class="cat-members">${membersHtml || ''}</div>
            </div>
          `;
        }).join('') || '<p class="empty-state">Sin gastos</p>';
        return `
          <div class="month-block">
            <h3>${humanMonth(m)}</h3>
            ${catHtml}
          </div>
        `;
      }).join('');
    }

    // Click en fila para expandir detalle por mes (opcional)
    document.querySelectorAll('#monthly-table tbody tr').forEach(tr => {
      tr.addEventListener('click', () => {
        const m = tr.getAttribute('data-month');
        const el = document.querySelector(`.month-block h3:nth-child(1)`);
        // No necesitamos toggle ahora; la sección está bajo la tabla.
      });
    });
  }

  // Helpers de desplegable
  function syncDropdown(type){
    const selId = type==='months' ? 'analysis-months' : (type==='categories' ? 'analysis-categories' : null);
    const btnId = type==='months' ? 'dd-months' : (type==='categories' ? 'dd-categories' : null);
    const menuId = type==='months' ? 'ddm-months' : (type==='categories' ? 'ddm-categories' : null);
    const sel = document.getElementById(selId);
    const btn = document.getElementById(btnId);
    const menu = document.getElementById(menuId);
    if (!sel || !btn || !menu) return;
    // Construir items desde el select
    const items = Array.from(sel.options).map(opt => {
      const label = opt.textContent || opt.value;
      const value = opt.value;
      const active = opt.selected;
      return `<button class="dropdown-item${active? ' active':''}" data-value="${value}">${label}</button>`;
    }).join('');
    menu.innerHTML = `<div class="dropdown-items">${items}</div>`;
    // Abrir/cerrar menú
    btn.onclick = (e) => {
      e.stopPropagation();
      closeAllDropdowns();
      menu.classList.toggle('open');
      btn.classList.toggle('open');
    };
    // Seleccionar con un clic
    menu.querySelectorAll('.dropdown-item').forEach(it => {
      it.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const val = it.getAttribute('data-value');
        const target = Array.from(sel.options).find(o => o.value === val);
        if (target) { target.selected = !target.selected; }
        renderAnalysis();
        // Cerrar tras seleccionar
        menu.classList.remove('open');
        btn.classList.remove('open');
      });
    });
    // Cerrar al hacer clic fuera
    document.addEventListener('click', closeAllDropdowns);
  }

  function closeAllDropdowns(){
    document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.dropdown-btn.open').forEach(b => b.classList.remove('open'));
  }

  // Panel de selección múltiple mediante chips
  function openMultiPanel(type){
    const panel = document.getElementById('multi-panel');
    if (!panel) return;
    const opts = window.__analysisOptions || {};
    const selMonths = Array.from(document.getElementById('analysis-months')?.selectedOptions || []).map(o=>o.value);
    const selCats = Array.from(document.getElementById('analysis-categories')?.selectedOptions || []).map(o=>o.value);
    const selSubjects = Array.from(document.getElementById('analysis-subjects')?.selectedOptions || []).map(o=>o.value);
    let list = [];
    let title = '';
    if (type==='months'){ list = (opts.monthsAll||[]).slice(); title = 'Selecciona meses'; }
    else if (type==='categories'){ list = (opts.catsAll||[]).slice(); title = 'Selecciona categorías'; }
    else if (type==='subjects') { list = (opts.subjectsAll||[]).slice(); title = 'Selecciona sujetos'; }

    // Por defecto al abrir: ninguna selección para el tipo elegido
    const targetSelId = type==='months' ? 'analysis-months' : (type==='categories' ? 'analysis-categories' : 'analysis-subjects');
    const targetSel = document.getElementById(targetSelId);
    if (targetSel) { for (const opt of targetSel.options) opt.selected = false; }
    
    const isSelected = (val) => {
      if (type==='months') return selMonths.includes(val);
      if (type==='categories') return selCats.includes(val);
      if (type==='subjects') return selSubjects.includes(val);
      return false;
    };
    const labelFor = (val) => type==='months' ? humanMonth(val) : val;
    panel.innerHTML = `
      <div class="panel-wrap">
        <div class="panel-header">
          <h4><i class="fas fa-check-double"></i> ${title}</h4>
          <div class="panel-actions">
            <button class="btn btn-light btn-sm" id="mp-close">Cerrar</button>
            <button class="btn btn-primary btn-sm" id="mp-apply">Aplicar</button>
          </div>
        </div>
        <div class="chip-grid">
          ${list.map(v => `<button class="chip chip-toggle ${isSelected(v)?'active':''}" data-type="${type}" data-value="${v}">${labelFor(v)}</button>`).join('')}
        </div>
      </div>
    `;
    panel.classList.remove('hidden');
    const toggleSel = (type, val, on) => {
      const selId = type==='months' ? 'analysis-months' : (type==='categories' ? 'analysis-categories' : 'analysis-subjects');
      const sel = document.getElementById(selId);
      if (!sel) return;
      for (const opt of sel.options) { if (opt.value === val) { opt.selected = !!on; break; } }
    };
    panel.querySelectorAll('.chip-toggle').forEach(ch => {
      ch.addEventListener('click', () => {
        ch.classList.toggle('active');
        const on = ch.classList.contains('active');
        toggleSel(ch.getAttribute('data-type'), ch.getAttribute('data-value'), on);
      });
    });
    document.getElementById('mp-close')?.addEventListener('click', () => {
      panel.classList.add('hidden');
    });
    document.getElementById('mp-apply')?.addEventListener('click', async () => {
      panel.classList.add('hidden');
      try { await renderAnalysis(); } catch(e){}
    });
  }

  window.loadMonthlyAnalysis = loadMonthlyAnalysis;
  function applyMemberSelectColor(){
    const el = document.getElementById('analysis-member');
    if (!el) return;
    const val = el.value || '';
    const cls = getMemberClass(val);
    el.classList.remove('member-color','jose-luis','gemma','hugo','alba','familia','otros');
    if (!val || val === 'Todos') {
      return; // No colorear en "Todos"
    }
    el.classList.add('member-color');
    if (cls) el.classList.add(cls);
  }
  // Escuchar cambios en transacciones y refrescar si la vista está activa
  try {
    window.addEventListener('transactions-changed', async () => {
      const active = document.querySelector('.monthly-analysis');
      if (active) {
        try { await renderAnalysis(); } catch (_) {}
        // Reaplicar color del selector por si cambió el miembro
        try { applyMemberSelectColor(); } catch(_) {}
      }
    });
  } catch (_) {}
  // Helper para exportación CSV actual
  async function buildCurrentFilteredCSV(){
    const state = window.__analysisState || {};
    const all = (typeof window.getAllTransactions === 'function')
      ? await window.getAllTransactions()
      : (typeof DB !== 'undefined' ? await DB.getAll('transactions') : []);
    const now = new Date();
    let start = null, end = null;
    const period = state.period || 'current-year';
    if (period === 'current-month') { start = new Date(now.getFullYear(), now.getMonth(), 1); end = new Date(now.getFullYear(), now.getMonth()+1, 0, 23, 59, 59, 999); }
    else if (period === 'last-month') { const lm = new Date(now.getFullYear(), now.getMonth()-1, 1); start = new Date(lm.getFullYear(), lm.getMonth(), 1); end = new Date(lm.getFullYear(), lm.getMonth()+1, 0, 23, 59, 59, 999); }
    else if (period === 'current-quarter') { const q = Math.floor(now.getMonth()/3); const sm = q*3; start = new Date(now.getFullYear(), sm, 1); end = new Date(now.getFullYear(), sm+3, 0, 23, 59, 59, 999); }
    else if (period === 'current-year') { start = new Date(now.getFullYear(),0,1); end = new Date(now.getFullYear(),11,31, 23, 59, 59, 999); }
    else if (period === 'last-year') { start = new Date(now.getFullYear()-1,0,1); end = new Date(now.getFullYear()-1,11,31, 23, 59, 59, 999); }
    const within = all.filter(t => {
      if (!t.date) return false;
      const d = new Date(t.date);
      return (!start || d >= start) && (!end || d <= end);
    });
    const selectedMonths = state.selectedMonths || [];
    const selectedCats = state.selectedCats || [];
    const selectedSubjects = state.selectedSubjects || [];
    const filtered = within.filter(t => {
      const mk = monthKey(t.date);
      const cat = t.category || 'otros';
      const mem = t.member || '';
      const byMonth = !selectedMonths.length || selectedMonths.includes(mk);
      const byCat = !selectedCats.length || selectedCats.includes(cat);
      const bySubject = !selectedSubjects.length || selectedSubjects.includes(mem);
      return byMonth && byCat && bySubject;
    });
    const fmt = (v) => String(v ?? '').replace(/"/g,'""');
    const headers = ['Fecha','Sujeto','Categoría','Tipo','Importe','Descripción'];
    const rows = filtered.map(t => {
      const type = (t.type||t.kind)==='income' ? 'Ingreso' : 'Gasto';
      const desc = t.description || t.concept || t.note || t.member || '';
      return [t.date||'', t.member||'', t.category||'', type, Number(t.amount)||0, desc];
    });
    const csv = [headers.join(',')].concat(rows.map(r => r.map(c => `"${fmt(c)}"`).join(','))).join('\n');
    return csv;
  }

  // Helper: construir filas filtradas actuales para Excel/PDF
  async function buildCurrentFilteredRows(){
    const state = window.__analysisState || {};
    const all = (typeof window.getAllTransactions === 'function')
      ? await window.getAllTransactions()
      : (typeof DB !== 'undefined' ? await DB.getAll('transactions') : []);
    const now = new Date();
    let start = null, end = null;
    const period = state.period || 'current-year';
    if (period === 'current-month') { start = new Date(now.getFullYear(), now.getMonth(), 1); end = new Date(now.getFullYear(), now.getMonth()+1, 0); }
    else if (period === 'last-month') { const lm = new Date(now.getFullYear(), now.getMonth()-1, 1); start = new Date(lm.getFullYear(), lm.getMonth(), 1); end = new Date(lm.getFullYear(), lm.getMonth()+1, 0); }
    else if (period === 'current-quarter') { const q = Math.floor(now.getMonth()/3); const sm = q*3; start = new Date(now.getFullYear(), sm, 1); end = new Date(now.getFullYear(), sm+3, 0); }
    else if (period === 'current-year') { start = new Date(now.getFullYear(),0,1); end = new Date(now.getFullYear(),11,31); }
    else if (period === 'last-year') { start = new Date(now.getFullYear()-1,0,1); end = new Date(now.getFullYear()-1,11,31); }
    const within = all.filter(t => {
      if (!t.date) return false;
      const d = new Date(t.date);
      return (!start || d >= start) && (!end || d <= end);
    });
    const selectedMonths = state.selectedMonths || [];
    const selectedCats = state.selectedCats || [];
    const selectedSubjects = state.selectedSubjects || [];
    const filtered = within.filter(t => {
      const mk = monthKey(t.date);
      const cat = t.category || 'otros';
      const subj = t.member || '';
      const byMonth = !selectedMonths.length || selectedMonths.includes(mk);
      const byCat = !selectedCats.length || selectedCats.includes(cat);
      const bySubject = !selectedSubjects.length || selectedSubjects.includes(subj);
      return byMonth && byCat && bySubject;
    });
    const headers = ['Fecha','Sujeto','Categoría','Tipo','Importe','Descripción'];
    const rows = filtered.map(t => {
      const type = (t.type||t.kind)==='income' ? 'Ingreso' : 'Gasto';
      const desc = t.description || t.concept || t.note || t.member || '';
      return [t.date||'', t.member||'', t.category||'', type, Number(t.amount)||0, desc];
    });
    return { headers, rows };
  }

  // Helper: construir HTML de tabla para Excel (formato compatible .xls)
  function buildExcelHTML(headers, rows){
    const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const amountIdx = headers.findIndex(h => /importe/i.test(String(h)));
    const fmtNum = (n) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n)||0);
    const thead = `<thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>`;
    const tbodyRows = rows.map(r => {
      return `<tr>${r.map((c, idx) => {
        const val = (idx === amountIdx) ? fmtNum(c) : c;
        return `<td>${esc(val)}</td>`;
      }).join('')}</tr>`;
    }).join('');
    const tbody = `<tbody>${tbodyRows}</tbody>`;
    return `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Excel Export</title></head><body><table>${thead}${tbody}</table></body></html>`;
  }
  // Exponer globalmente el cargador de Análisis mensual
  try {
    if (typeof window !== 'undefined' && typeof loadMonthlyAnalysis === 'function') {
      window.loadMonthlyAnalysis = loadMonthlyAnalysis;
    }
  } catch (_) {}
})();