// monthly-analysis.js - Vista de análisis mensual de ingresos y gastos
(function(){
  function ensureMain() {
    if (typeof window.ensureMain === 'function') return window.ensureMain();
    return document.getElementById('mainContent');
  }

  function formatAmount(v) {
    const num = Number(v) || 0;
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(num);
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
      const type = (t.type||t.kind) === 'income' ? 'income' : 'expense';
      data[key][type] += amt;
      const cat = (t.category||'otros');
      if (!data[key].categories[cat]) data[key].categories[cat] = { income: 0, expense: 0, members: {} };
      data[key].categories[cat][type] += amt;
      const member = t.member || 'Todos';
      data[key].members[member] = data[key].members[member] || { income: 0, expense: 0 };
      data[key].members[member][type] += amt;
      // Desglose por miembro dentro de categoría
      data[key].categories[cat].members[member] = data[key].categories[cat].members[member] || { income: 0, expense: 0 };
      data[key].categories[cat].members[member][type] += amt;
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
            <select id="analysis-member" class="form-control"></select>
            <button id="analysis-apply" class="btn btn-primary"><i class="fas fa-filter"></i> Aplicar</button>
          </div>
        </div>
        <div class="analysis-summary" id="analysis-summary"></div>
        <div class="monthly-table-wrap">
          <table class="table" id="monthly-table">
            <thead><tr><th>Mes</th><th>Ingresos</th><th>Gastos</th><th>Balance</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="category-month-wrap" id="category-month"></div>
      </section>
    `;

    // Poblar miembros
    const memberSel = document.getElementById('analysis-member');
    if (memberSel) {
      const html = (typeof FamilyManager !== 'undefined')
        ? FamilyManager.generateMemberOptions('Todos')
        : '<option value="">Todos</option>';
      memberSel.innerHTML = html;
    }

    document.getElementById('analysis-apply')?.addEventListener('click', renderAnalysis);

    await renderAnalysis();
  }

  async function renderAnalysis() {
    const period = document.getElementById('analysis-period')?.value || 'current-year';
    const member = document.getElementById('analysis-member')?.value || '';
    const all = (typeof window.getAllTransactions === 'function')
      ? await window.getAllTransactions()
      : (typeof DB !== 'undefined' ? await DB.getAll('transactions') : []);
    // Filtrado por periodo
    const now = new Date();
    let start = null, end = null;
    if (period === 'current-year') { start = new Date(now.getFullYear(),0,1); end = new Date(now.getFullYear(),11,31); }
    else if (period === 'last-year') { start = new Date(now.getFullYear()-1,0,1); end = new Date(now.getFullYear()-1,11,31); }
    const within = all.filter(t => {
      if (!t.date) return false;
      const d = new Date(t.date);
      const byDate = (!start || d >= start) && (!end || d <= end);
      const byMember = !member || !t.member || t.member === member;
      return byDate && byMember;
    });

    const grouped = groupByMonth(within, member);
    const months = Object.keys(grouped).sort();

    // Resumen general
    const totIncome = within.filter(t => (t.type||t.kind)==='income').reduce((s,t)=> s+(Number(t.amount)||0), 0);
    const totExpense = within.filter(t => (t.type||t.kind)==='expense').reduce((s,t)=> s+(Number(t.amount)||0), 0);
    const summaryEl = document.getElementById('analysis-summary');
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div class="summary-cards">
          <div class="summary-card income"><h3>Ingresos</h3><p>${formatAmount(totIncome)}</p></div>
          <div class="summary-card expense"><h3>Gastos</h3><p>${formatAmount(totExpense)}</p></div>
          <div class="summary-card balance"><h3>Balance</h3><p>${formatAmount(totIncome - totExpense)}</p></div>
          <div class="summary-card"><h3>Transacciones</h3><p>${within.length}</p></div>
        </div>
      `;
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

    // Clasificación de gastos por categoría, mes y persona
    const catWrap = document.getElementById('category-month');
    if (catWrap) {
      catWrap.innerHTML = months.map(m => {
        const itm = grouped[m];
        const cats = Object.entries(itm.categories)
          .filter(([, val]) => (val.expense)>0)
          .sort((a,b)=> b[1].expense - a[1].expense);
        const catHtml = cats.map(([cat, val]) => {
          const members = Object.entries(val.members)
            .filter(([, mv]) => mv.expense>0)
            .map(([mem, mv]) => `<span class="chip member">${mem}: ${formatAmount(mv.expense)}</span>`)
            .join('');
          return `
            <div class="cat-row">
              <div class="cat-name">${cat}</div>
              <div class="cat-expense">-${formatAmount(val.expense)}</div>
              <div class="cat-members">${members || ''}</div>
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

  window.loadMonthlyAnalysis = loadMonthlyAnalysis;
})();