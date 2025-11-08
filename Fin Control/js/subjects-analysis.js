// subjects-analysis.js - Vista de análisis por sujetos/miembros
(function(){
  function formatAmount(v){
    try {
      if (typeof window.formatAmount === 'function') return window.formatAmount(v);
    } catch(_) {}
    const n = Number(v)||0;
    const s = new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR', minimumFractionDigits:2, maximumFractionDigits:2}).format(n);
    return s.replace(/\u00a0/g,'').replace(/\s*€/,'€');
  }

  function getMemberLabel(name){
    const n = (name||'').trim();
    if (!n || n === 'Todos') return 'Sin asignar';
    return n;
  }

  function groupByMember(transactions){
    const agg = {};
    for (const t of (transactions||[])){
      const m = getMemberLabel(t.member||'');
      if (!agg[m]) agg[m] = { income:0, expense:0, count:0, items:[] };
      const amt = Number(t.amount)||0;
      const isExp = ((t.type||t.kind)==='expense');
      if (isExp) agg[m].expense += amt; else agg[m].income += amt;
      agg[m].count += 1;
      agg[m].items.push(t);
    }
    return agg;
  }

  function renderSubjectsTable(agg){
    const sortSel = document.getElementById('sa-sort');
    const mode = sortSel ? (sortSel.value||'balance-desc') : 'balance-desc';
    const members = Object.keys(agg||{});
    members.sort((a,b)=>{
      const A = agg[a], B = agg[b];
      const balA = (A.income - A.expense), balB = (B.income - B.expense);
      switch(mode){
        case 'expense-desc': return (B.expense - A.expense);
        case 'income-desc': return (B.income - A.income);
        case 'name-asc': return a.localeCompare(b, 'es');
        case 'balance-desc':
        default: return (balB - balA);
      }
    });
    if (!members.length) return '<p class="empty-state">No hay datos para el período seleccionado.</p>';
    const rows = members.map(m => {
      const a = agg[m];
      const bal = (a.income - a.expense);
      return `<tr data-member="${m}">
        <td class="member">${m}</td>
        <td class="income">${formatAmount(a.income)}</td>
        <td class="expense">-${formatAmount(a.expense)}</td>
        <td class="balance">${formatAmount(bal)}</td>
        <td class="count">${a.count}</td>
        <td class="actions"><button class="btn small" data-action="toggle">Ver</button></td>
      </tr>
      <tr class="details" data-member="${m}" style="display:none"><td colspan="6">${renderMemberDetails(a.items)}</td></tr>`;
    }).join('');
    return `<table class="subjects-table">
      <thead><tr><th>Sujeto</th><th>Ingresos</th><th>Gastos</th><th>Balance</th><th>#</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  function renderSubjectsChart(agg){
    const canvas = document.getElementById('sa-chart');
    if (!canvas || !window.Chart) return;
    const ctx = canvas.getContext('2d');
    try { if (window.saChart) { window.saChart.destroy(); } } catch(_){}
    const labels = Object.keys(agg||{});
    const incomes = labels.map(l=> agg[l].income);
    const expenses = labels.map(l=> agg[l].expense);
    window.saChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Ingresos', data: incomes, backgroundColor: 'rgba(76,201,240,0.7)', borderColor: 'rgba(76,201,240,1)', borderWidth: 1 },
          { label: 'Gastos', data: expenses, backgroundColor: 'rgba(247,37,133,0.7)', borderColor: 'rgba(247,37,133,1)', borderWidth: 1 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } }
    });
  }

  function buildSubjectsCSV(agg){
    const header = ['Sujeto','Ingresos','Gastos','Balance','Transacciones'];
    const rows = Object.keys(agg||{}).map(m=>{
      const a = agg[m];
      const bal = (a.income - a.expense);
      return [m, a.income, a.expense, bal, a.count].join(',');
    });
    return [header.join(','), ...rows].join('\n');
  }

  function renderMemberDetails(items){
    if (!items || !items.length) return '<div class="empty-state">Sin transacciones</div>';
    const lis = items.slice().sort((a,b)=> new Date(b.date)-new Date(a.date)).map(t=>{
      const isExp = ((t.type||t.kind)==='expense');
      const sign = isExp?'-':'+';
      const amt = formatAmount(Number(t.amount)||0);
      const d = t.date? new Date(t.date).toLocaleDateString('es-ES'):'';
      const desc = t.description||'';
      const cat = t.category||'';
      return `<div class="detail-row">
        <span class="date">${d}</span>
        <span class="amount ${isExp?'neg':'pos'}">${sign}${amt}</span>
        <span class="cat"><i class="fas fa-tag"></i> ${cat}</span>
        <span class="desc">${desc}</span>
      </div>`;
    }).join('');
    return `<div class="member-details">${lis}</div>`;
  }

  async function renderSubjectsAnalysis(){
    const main = ensureMain();
    if (!main) return;
    main.innerHTML = `<section class="subjects-analysis">
      <div class="tx-toolbar">
        <div class="tx-title"><i class="fas fa-user-friends"></i> <span>Análisis por sujetos</span></div>
      </div>
      <div class="analysis-intro" style="margin:10px 0;padding:10px;border:1px dashed #ccc;border-radius:6px;color:#444;">
        <p>
          Analiza ingresos y gastos por sujeto. Selecciona un rango de fechas y
          despliega las filas para ver el detalle de transacciones por cada sujeto.
        </p>
      </div>
      <div class="filters" style="display:flex;gap:8px;align-items:end;flex-wrap:wrap;margin-bottom:12px;">
        <div><label>Desde</label><input type="date" id="sa-start" class="form-control" /></div>
        <div><label>Hasta</label><input type="date" id="sa-end" class="form-control" /></div>
        <div><button id="sa-apply" class="btn primary"><i class="fas fa-sync"></i> Aplicar</button></div>
      </div>
      <div class="actions" style="display:flex;gap:8px;align-items:center;margin:6px 0 10px;flex-wrap:wrap;">
        <label for="sa-sort">Orden</label>
        <select id="sa-sort" class="form-control">
          <option value="balance-desc" selected>Por balance (desc)</option>
          <option value="expense-desc">Por gastos (desc)</option>
          <option value="income-desc">Por ingresos (desc)</option>
          <option value="name-asc">Por nombre (asc)</option>
        </select>
        <button id="sa-export" class="btn btn-outline btn-sm"><i class="fas fa-file-csv"></i> Exportar CSV</button>
      </div>
      <div id="sa-summary" class="summary" style="display:flex;gap:12px;flex-wrap:wrap;margin:8px 0;"></div>
      <div class="chart-wrap" style="height:260px;margin:8px 0 12px;"><canvas id="sa-chart"></canvas></div>
      <div id="sa-table" class="table-wrap"><div class="loading">Cargando...</div></div>
    </section>`;

    const apply = async () => {
      const start = (document.getElementById('sa-start')?.value)||'';
      const end = (document.getElementById('sa-end')?.value)||'';
      let txs = [];
      try { txs = await (typeof window.getAllTransactions==='function' ? window.getAllTransactions() : DB.getAll('transactions')); } catch(e){ txs = []; }
      // Filtrar rango
      const within = txs.filter(t => {
        const d = t.date ? new Date(t.date) : null;
        if (!d) return false;
        const okStart = start ? (d >= new Date(start)) : true;
        const okEnd = end ? (d <= new Date(end)) : true;
        return okStart && okEnd;
      });

      const agg = groupByMember(within);
      const totIncome = within.filter(t=> (t.type||t.kind)==='income').reduce((s,t)=> s+(Number(t.amount)||0),0);
      const totExpense = within.filter(t=> (t.type||t.kind)==='expense').reduce((s,t)=> s+(Number(t.amount)||0),0);
      const summaryEl = document.getElementById('sa-summary');
      if (summaryEl){
        summaryEl.innerHTML = `
          <div class="summary-card income"><h4>Ingresos</h4><p>${formatAmount(totIncome)}</p></div>
          <div class="summary-card expense"><h4>Gastos</h4><p>-${formatAmount(totExpense)}</p></div>
          <div class="summary-card balance"><h4>Balance</h4><p>${formatAmount(totIncome - totExpense)}</p></div>
          <div class="summary-card count"><h4>Transacciones</h4><p>${within.length}</p></div>
        `;
      }

      const tableEl = document.getElementById('sa-table');
      if (tableEl){ tableEl.innerHTML = renderSubjectsTable(agg); }
      // Gráfico
      renderSubjectsChart(agg);
      // Botón toggle de filas detalles
      try {
        tableEl.querySelectorAll('button[data-action="toggle"]').forEach(btn => {
          btn.addEventListener('click', (e)=>{
            const tr = e.target.closest('tr');
            const member = tr?.getAttribute('data-member');
            const details = tableEl.querySelector(`tr.details[data-member="${member}"]`);
            if (details) details.style.display = (details.style.display==='none'?'':'none') === '' ? 'none' : '';
            // Simpler toggle
            if (details) details.style.display = (details.style.display === 'none' ? '' : 'none');
          });
        });
      } catch(_) {}
    };

    document.getElementById('sa-apply')?.addEventListener('click', apply);
    document.getElementById('sa-sort')?.addEventListener('change', apply);
    document.getElementById('sa-export')?.addEventListener('click', async ()=>{
      try {
        // Recalcular con filtros activos para exportar lo visible
        const start = (document.getElementById('sa-start')?.value)||'';
        const end = (document.getElementById('sa-end')?.value)||'';
        let txs = [];
        try { txs = await (typeof window.getAllTransactions==='function' ? window.getAllTransactions() : DB.getAll('transactions')); } catch(e){ txs = []; }
        const within = txs.filter(t => {
          const d = t.date ? new Date(t.date) : null;
          if (!d) return false;
          const okStart = start ? (d >= new Date(start)) : true;
          const okEnd = end ? (d <= new Date(end)) : true;
          return okStart && okEnd;
        });
        const agg = groupByMember(within);
        const csv = buildSubjectsCSV(agg);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `analisis-sujetos-${Date.now()}.csv`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch(e){ console.error('Error exportando CSV de sujetos', e); }
    });
    await apply();
  }

  // Recarga si cambian transacciones y esta vista está activa
  window.addEventListener('transactions-changed', async () => {
    try {
      const active = document.querySelector('.subjects-analysis');
      if (active) await renderSubjectsAnalysis();
    } catch(_) {}
  });

  window.loadSubjectsAnalysis = renderSubjectsAnalysis;
})();