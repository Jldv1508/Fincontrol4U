// comparative-analysis.js - Análisis comparativo por meses, categorías, subcategorías y sujetos
(function(){
  const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  let currentMetric = 'expense';

  async function getAll(){
    if (typeof window.getAllTransactions === 'function') {
      try { return await window.getAllTransactions(); } catch(_) { return []; }
    }
    if (typeof DB !== 'undefined' && typeof DB.getAll === 'function') {
      try { return await DB.getAll('transactions'); } catch(_) { return []; }
    }
    return [];
  }

  function isLoanCategory(cat){
    const lc = (cat||'').toLowerCase();
    return lc.includes('préstamo') || lc.includes('prestamo') || lc.includes('préstamos') || lc.includes('prestamos');
  }

  function monthKeyFromDate(d){
    const y = d.getFullYear();
    const m = d.getMonth()+1;
    return `${y}-${String(m).padStart(2,'0')}`;
  }

  function buildMonthRange(startYear=2024){
    const now = new Date();
    const endYear = now.getFullYear();
    const endMonth = now.getMonth()+1;
    const out = [];
    for (let y=endYear; y>=startYear; y--) {
      const maxM = (y===endYear? endMonth : 12);
      for (let m=maxM; m>=1; m--) {
        out.push(`${y}-${String(m).padStart(2,'0')}`);
      }
    }
    return out;
  }

  function humanMonth(key){
    const [y,m] = key.split('-');
    const name = MONTHS[Number(m)-1]||key;
    return `${name} ${y}`;
  }

  async function getUniqueMembers(){
    const all = await getAll();
    const set = new Set(
      all
        .map(t => (t.member || t.subject || '').trim())
        .filter(Boolean)
    );
    const arr = Array.from(set).sort((a,b)=> a.localeCompare(b,'es',{sensitivity:'base'}));
    return arr;
  }

  async function getUniqueCategories(){
    const all = await getAll();
    const fromData = Array.from(new Set(all.map(t => (t.category||'').trim()).filter(Boolean).filter(c => !isLoanCategory(c))));
    // Defaults: reusar parte clave de taxonomy ya usada
    const DEFAULT_CATEGORIES = [
      'Vivienda','Alimentación','Transporte','Salud','Educación','Ocio','Tecnología','Ropa','Mascotas','Regalos',
      'Impuestos','Seguros','Banco','Suscripciones','Otros',
      'Supermercado','Frutas y verduras','Lácteos','Carnes','Pescados','Panadería','Bebidas','Congelados',
      'Suministros','Luz','Agua','Gas','Internet','Telefonía','Mantenimiento','Reparaciones','Electrodomésticos',
      'Gasolina','Parking','Peajes','Taxis','Vehículo','Seguro coche',
      'Farmacia','Médico','Dental','Óptica',
      'Colegio','Universidad','Libros','Material escolar',
      'Restauración','Cine','Música','Deporte','Gimnasio','Viajes','Hotel','Vuelos',
      'Electrónica','Informática',
      'Calzado',
      'Comisiones','Streaming',
      'Sueldo','Freelance','Venta','Intereses','Dividendos','Reembolso','Devolución','Alquiler recibido','Regalos recibidos'
    ];
    const union = Array.from(new Set([].concat(DEFAULT_CATEGORIES, fromData)));
    return union.sort((a,b)=> a.localeCompare(b,'es',{sensitivity:'base'}));
  }

  async function getUniqueSubcategories(categories){
    const all = await getAll();
    const sel = (categories||[]).map(c => (c||'').toLowerCase());
    const fromData = Array.from(new Set(
      all
        .filter(t => sel.length? sel.includes((t.category||'').toLowerCase()) : true)
        .map(t => (t.subcategory||'').trim())
        .filter(Boolean)
    ));
    const DEFAULT_SUBCATEGORIES = {
      'vivienda': ['Alquiler','Hipoteca','Comunidad','IBI','Basura','Reformas','Muebles'],
      'alimentación': ['Supermercado','Frutería','Carnicería','Panadería','Bebidas','Takeaway'],
      'supermercado': ['Despensa','Limpieza','Higiene','Bebidas','Frescos'],
      'frutas y verduras': ['Frutería','Mercado','Orgánico'],
      'lácteos': ['Leche','Yogur','Queso','Mantequilla'],
      'carnes': ['Pollo','Ternera','Cerdo'],
      'pescados': ['Blanco','Azul','Marisco'],
      'panadería': ['Pan','Bollería'],
      'bebidas': ['Agua','Refrescos','Zumos','Café','Té'],
      'congelados': ['Verduras','Pescado','Precocinados'],
      'suministros': ['Luz','Agua','Gas','Internet','Telefonía'],
      'mantenimiento': ['Reparaciones','Electrodomésticos'],
      'gasolina': ['Gasolinera'],
      'vehículo': ['Seguro coche','Mantenimiento'],
      'farmacia': ['Medicamentos','Parafarmacia'],
      'médico': ['Consulta','Pruebas'],
      'colegio': ['Libros','Material escolar'],
      'restauración': ['Restaurantes','Bares','Cafeterías','Comida rápida'],
      'cine': ['Entradas','Streaming'],
      'música': ['Conciertos','Suscripciones'],
      'deporte': ['Gimnasio','Material deportivo','Clases'],
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
    const defaults = sel.length
      ? Array.from(new Set(sel.flatMap(k => DEFAULT_SUBCATEGORIES[k]||[])))
      : Array.from(new Set(Object.values(DEFAULT_SUBCATEGORIES).flat()));
    const union = Array.from(new Set([].concat(defaults, fromData)));
    return union.sort((a,b)=> a.localeCompare(b,'es',{sensitivity:'base'}));
  }

  function renderUI(){
    const main = document.getElementById('mainContent');
    if (!main) return;
    main.innerHTML = `
      <section class="comparative-analysis">
        <div class="analysis-toolbar">
          <h2><i class="fas fa-balance-scale"></i> Análisis comparativo</h2>
          <div class="metric-toggle" style="display:flex; align-items:center; gap:.5rem;">
            <span>Mostrar:</span>
            <label><input type="radio" name="metric" value="income"> Ingresos</label>
            <label><input type="radio" name="metric" value="expense" checked> Gastos</label>
            <label><input type="radio" name="metric" value="balance"> Balance</label>
          </div>
        </div>
        <div class="analysis-filters">
          <div class="filter-row">
            <details class="dd-filter" open>
              <summary>Meses</summary>
              <div class="dd-controls quick-select" data-for="dd-months">
                <button type="button" class="btn btn-sm" data-select="all">Todo</button>
                <button type="button" class="btn btn-sm" data-select="none">Ninguno</button>
              </div>
              <div id="dd-months" class="dd-list"></div>
            </details>
            <details class="dd-filter">
              <summary>Categorías</summary>
              <div class="dd-controls quick-select" data-for="dd-categories">
                <button type="button" class="btn btn-sm" data-select="all">Todo</button>
                <button type="button" class="btn btn-sm" data-select="none">Ninguno</button>
              </div>
              <div id="dd-categories" class="dd-list"></div>
            </details>
            <details class="dd-filter">
              <summary>Subcategorías</summary>
              <div class="dd-controls quick-select" data-for="dd-subcategories">
                <button type="button" class="btn btn-sm" data-select="all">Todo</button>
                <button type="button" class="btn btn-sm" data-select="none">Ninguno</button>
              </div>
              <div id="dd-subcategories" class="dd-list"></div>
            </details>
            <details class="dd-filter">
              <summary>Sujetos</summary>
              <div class="dd-controls quick-select" data-for="dd-subjects">
                <button type="button" class="btn btn-sm" data-select="all">Todo</button>
                <button type="button" class="btn btn-sm" data-select="none">Ninguno</button>
              </div>
              <div id="dd-subjects" class="dd-list"></div>
            </details>
            <button id="comp-apply" class="btn btn-primary">Aplicar</button>
            <button id="comp-clear" class="btn">Limpiar</button>
          </div>
        </div>
        <div class="active-filters" id="comp-summary"></div>
        <div id="comp-charts" class="charts-container">
          <div class="card chart-card">
            <h3>Gastos por sujeto</h3>
            <div class="chart-wrapper" style="height:300px; position:relative">
              <canvas id="comp-chart-subjects"></canvas>
            </div>
          </div>
          <div class="card chart-card">
            <h3>Gastos por mes</h3>
            <div class="chart-wrapper" style="height:300px; position:relative">
              <canvas id="comp-chart-months"></canvas>
            </div>
          </div>
          <div class="card chart-card">
            <h3>Gastos por categoría › subcategoría</h3>
            <div class="chart-wrapper" style="height:300px; position:relative">
              <canvas id="comp-chart-catsubs"></canvas>
            </div>
          </div>
        </div>
        <div id="comp-results"></div>
      </section>
    `;
  }

  async function populateFilters(){
    const monthsEl = document.getElementById('dd-months');
    const catsEl = document.getElementById('dd-categories');
    const subsDepEl = document.getElementById('dd-subcategories');
    const subjectsEl = document.getElementById('dd-subjects');

    const months = buildMonthRange(2024);
    if (monthsEl) {
      monthsEl.innerHTML = months.map(k => `<label class="dd-item"><input type="checkbox" value="${k}"> ${humanMonth(k)}</label>`).join('');
      const last6 = months.slice(-6);
      last6.forEach(k => {
        const box = monthsEl.querySelector(`input[value="${k}"]`);
        if (box) box.checked = true;
      });
    }
    const cats = await getUniqueCategories();
    if (catsEl) {
      catsEl.innerHTML = cats.map(c => `<label class="dd-item"><input type="checkbox" value="${c}"> ${c}</label>`).join('');
      Array.from(catsEl.querySelectorAll('input[type="checkbox"]')).forEach(b => { b.checked = true; });
    }
    const subs = await getUniqueSubcategories([]);
    if (subsDepEl) {
      subsDepEl.innerHTML = subs.map(s => `<label class="dd-item"><input type="checkbox" value="${s}"> ${s}</label>`).join('');
    }
    const members = await getUniqueMembers();
    if (subjectsEl) {
      subjectsEl.innerHTML = members.map(m => `<label class="dd-item"><input type="checkbox" value="${m}"> ${m}</label>`).join('');
      // Por defecto seleccionar todos los sujetos
      Array.from(subjectsEl.querySelectorAll('input[type="checkbox"]')).forEach(b => { b.checked = true; });
    }

    // Actualizar subcategorías cuando cambien categorías (checkboxes)
    if (catsEl && subsDepEl) {
      catsEl.addEventListener('change', async ()=>{
        const selectedCats = Array.from(catsEl.querySelectorAll('input[type="checkbox"]:checked')).map(i=>i.value);
        const subs2 = await getUniqueSubcategories(selectedCats);
        subsDepEl.innerHTML = subs2.map(s => `<label class="dd-item"><input type="checkbox" value="${s}"> ${s}</label>`).join('');
      }, true);
    }
  }

  function attachQuickSelects(){
    const containers = Array.from(document.querySelectorAll('.quick-select'));
    containers.forEach(c => {
      const targetId = c.getAttribute('data-for');
      const listEl = document.getElementById(targetId);
      if (!listEl) return;
      c.addEventListener('click', (ev) => {
        const btn = ev.target.closest('button[data-select]');
        if (!btn) return;
        const mode = btn.getAttribute('data-select');
        const boxes = Array.from(listEl.querySelectorAll('input[type="checkbox"]'));
        if (mode === 'all') {
          boxes.forEach(b => { b.checked = true; });
        } else if (mode === 'none') {
          boxes.forEach(b => { b.checked = false; });
        }
        listEl.dispatchEvent(new Event('change'));
      });
    });
  }

  function readSelections(){
    const months = Array.from(document.querySelectorAll('#dd-months input[type="checkbox"]:checked')).map(i=>i.value);
    const cats = Array.from(document.querySelectorAll('#dd-categories input[type="checkbox"]:checked')).map(i=>i.value);
    const subs = Array.from(document.querySelectorAll('#dd-subcategories input[type="checkbox"]:checked')).map(i=>i.value);
    const members = Array.from(document.querySelectorAll('#dd-subjects input[type="checkbox"]:checked')).map(i=>i.value);
    return { months, cats, subs, members };
  }

  function saveSelections(sel){
    try { localStorage.setItem('compAnalysisSelections', JSON.stringify(sel)); } catch(_){}
  }

  function restoreSelections(){
    try {
      const raw = localStorage.getItem('compAnalysisSelections');
      if (!raw) return;
      const sel = JSON.parse(raw);
      const setList = (id, values=[]) => {
        const el = document.getElementById(id);
        if (!el) return;
        Array.from(el.querySelectorAll('input[type="checkbox"]')).forEach(b => { b.checked = values.includes(b.value); });
      };
      setList('dd-months', sel.months||[]);
      setList('dd-categories', sel.cats||[]);
      setList('dd-subcategories', sel.subs||[]);
      setList('dd-subjects', sel.members||[]);
      // Restaurar métrica si está guardada
      try {
        const m = localStorage.getItem('compMetric');
        if (m && ['income','expense','balance'].includes(m)) {
          currentMetric = m;
          const r = document.querySelector(`input[name="metric"][value="${m}"]`);
          if (r) r.checked = true;
        }
      } catch(_){}
    } catch(_){}
  }

  function filterTransactions(all, sel){
    return all.filter(t => {
      // Fecha a Mes
      const d = new Date(t.date);
      if (isNaN(d.getTime())) return false;
      const mk = monthKeyFromDate(d);
      if (sel.months && sel.months.length && !sel.months.includes(mk)) return false;
      // Miembro/Sujeto
      if (sel.members && sel.members.length) {
        const subj = t.member || t.subject;
        if (!subj || !sel.members.includes(subj)) return false;
      }
      // Categoría
      if (sel.cats && sel.cats.length && (!t.category || !sel.cats.includes(t.category))) return false;
      // Subcategoría
      if (sel.subs && sel.subs.length && (!t.subcategory || !sel.subs.includes(t.subcategory))) return false;
      // Excluir financiaciones
      if (isLoanCategory(t.category)) return false;
      return true;
    });
  }

  function summarizeBySubject(list){
    const agg = {};
    list.forEach(t => {
      const m = t.member || t.subject || 'Sin sujeto';
      const a = Number(t.amount)||0;
      const type = t.type || t.kind || 'expense';
      if (!agg[m]) agg[m] = { income:0, expense:0, balance:0 };
      if (type === 'income') agg[m].income += a; else agg[m].expense += a;
      agg[m].balance = agg[m].income - agg[m].expense;
    });
    return agg;
  }

  function summarizeByMonth(list){
    const agg = {};
    list.forEach(t => {
      const d = new Date(t.date);
      const mk = monthKeyFromDate(d);
      const a = Number(t.amount)||0;
      const type = t.type || t.kind || 'expense';
      if (!agg[mk]) agg[mk] = { income:0, expense:0, balance:0 };
      if (type === 'income') agg[mk].income += a; else agg[mk].expense += a;
      agg[mk].balance = agg[mk].income - agg[mk].expense;
    });
    return agg;
  }

  function summarizeByCategorySub(list){
    const agg = {};
    list.forEach(t => {
      const cat = t.category || 'Sin categoría';
      const sub = t.subcategory || 'Sin subcategoría';
      const key = `${cat} › ${sub}`;
      const a = Number(t.amount)||0;
      const type = t.type || t.kind || 'expense';
      if (!agg[key]) agg[key] = { income:0, expense:0, balance:0 };
      if (type === 'income') agg[key].income += a; else agg[key].expense += a;
      agg[key].balance = agg[key].income - agg[key].expense;
    });
    return agg;
  }

  function renderSummaryCards(list){
    const totals = list.reduce((acc,t)=>{
      const a = Number(t.amount)||0;
      const type = t.type || t.kind || 'expense';
      if (type==='income') acc.income += a; else acc.expense += a;
      acc.count += 1; acc.balance = acc.income - acc.expense; return acc;
    }, {income:0, expense:0, balance:0, count:0});
    const fmt = v => window.formatAmount(Number(v)||0);
    return `
      <div class="summary-cards">
        <div class="summary-card income"><h3>Ingresos</h3><p class="amount">${fmt(totals.income)}</p></div>
        <div class="summary-card expense"><h3>Gastos</h3><p class="amount">${fmt(totals.expense)}</p></div>
        <div class="summary-card ${totals.balance>=0?'positive':'negative'}"><h3>Balance</h3><p class="amount">${fmt(totals.balance)}</p></div>
        <div class="summary-card"><h3>Transacciones</h3><p>${totals.count}</p></div>
      </div>
    `;
  }

  function renderSubjectTable(agg){
    const members = Object.keys(agg).sort((a,b)=> a.localeCompare(b,'es',{sensitivity:'base'}));
    if (!members.length) return '<p class="empty-state">Sin datos para los filtros seleccionados.</p>';
    const fmt = v => window.formatAmount(Number(v)||0);
    const rows = members.map(m => {
      const a = agg[m];
      const pct = a.expense>0 ? ((a.expense/(a.income+a.expense))*100).toFixed(1) : '0.0';
      return `<tr><td>${m}</td><td class="pos">${fmt(a.income)}</td><td class="neg">${fmt(a.expense)}</td><td>${fmt(a.balance)}</td><td>${pct}%</td></tr>`;
    }).join('');
    return `
      <div class="member-comparison">
        <h3>Comparativa por sujeto</h3>
        <table class="table comparison-table">
          <thead><tr><th>Sujeto</th><th>Ingresos</th><th>Gastos</th><th>Balance</th><th>% gasto</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function renderMonthTable(agg){
    const keys = Object.keys(agg).sort();
    if (!keys.length) return '';
    const fmt = v => window.formatAmount(Number(v)||0);
    const rows = keys.map(k => {
      const a = agg[k];
      return `<tr><td>${humanMonth(k)}</td><td class="pos">${fmt(a.income)}</td><td class="neg">${fmt(a.expense)}</td><td>${fmt(a.balance)}</td></tr>`;
    }).join('');
    return `
      <div class="monthly-table-wrap">
        <h3>Totales por mes</h3>
        <table class="table">
          <thead><tr><th>Mes</th><th>Ingresos</th><th>Gastos</th><th>Balance</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function renderCategorySubList(agg){
    const keys = Object.keys(agg).sort((a,b)=> a.localeCompare(b,'es',{sensitivity:'base'}));
    if (!keys.length) return '';
    const fmt = v => window.formatAmount(Number(v)||0);
    const rows = keys.map(k => {
      const a = agg[k];
      return `<div class="cat-row"><span class="cat">${k}</span><span class="inc">+${fmt(a.income)}</span><span class="exp">-${fmt(a.expense)}</span></div>`;
    }).join('');
    return `
      <div class="category-month-wrap">
        <h3>Detalle por categoría › subcategoría</h3>
        <div class="month-block">${rows}</div>
      </div>
    `;
  }

  async function applyAndRender(){
    const sel = readSelections();
    const all = await getAll();
    const filtered = filterTransactions(all, sel);
    saveSelections(sel);
    const results = document.getElementById('comp-results');
    if (!filtered.length) {
      if (results) results.innerHTML = `<div class="card" style="padding:1rem;">No hay resultados con los filtros seleccionados. Prueba a ampliar el rango de meses o categorías.</div>`;
      renderActiveFilters(sel);
      renderCharts({}, {}, {});
      return;
    }
    const subjectAgg = summarizeBySubject(filtered);
    const monthAgg = summarizeByMonth(filtered);
    const catSubAgg = summarizeByCategorySub(filtered);
    const out = [];
    out.push(renderSummaryCards(filtered));
    out.push(renderSubjectTable(subjectAgg));
    out.push(renderMonthTable(monthAgg));
    out.push(renderCategorySubList(catSubAgg));
    if (results) results.innerHTML = out.join('');
    renderActiveFilters(sel);
    // Renderizar gráficos circulares
    renderCharts(subjectAgg, monthAgg, catSubAgg);
  }

  function renderActiveFilters(sel){
    const el = document.getElementById('comp-summary');
    if (!el) return;
    const chips = [];
    if (sel.months?.length) chips.push(`<span class="chip months">${sel.months.map(humanMonth).join(', ')}</span>`);
    if (sel.cats?.length) chips.push(`<span class="chip categories">${sel.cats.join(', ')}</span>`);
    if (sel.subs?.length) chips.push(`<span class="chip">${sel.subs.join(', ')}</span>`);
    if (sel.members?.length) chips.push(`<span class="chip members">${sel.members.join(', ')}</span>`);
    chips.push(`<span class="chip txcount">Selecciones: ${[sel.months, sel.cats, sel.subs, sel.members].map(a=>a.length).reduce((s,n)=>s+n,0)}</span>`);
    el.innerHTML = `<div class="filter-summary">${chips.join(' ')}</div>`;
  }

  async function loadComparativeAnalysis(){
    renderUI();
    await populateFilters();
    restoreSelections();
    attachQuickSelects();
    const btn = document.getElementById('comp-apply');
    if (btn){ btn.addEventListener('click', applyAndRender); }
    const clearBtn = document.getElementById('comp-clear');
    if (clearBtn){
      clearBtn.addEventListener('click', async ()=>{
        ['dd-months','dd-categories','dd-subcategories','dd-subjects'].forEach(id => {
          const el = document.getElementById(id);
          if (!el) return;
          Array.from(el.querySelectorAll('input[type="checkbox"]')).forEach(b => { b.checked = false; });
        });
        await populateFilters();
        restoreSelections();
        renderActiveFilters({ months: [], cats: [], subs: [], members: [] });
      });
    }
    Array.from(document.querySelectorAll('input[name="metric"]')).forEach(r => {
      r.addEventListener('change', (ev)=>{
        currentMetric = ev.target.value;
        try { localStorage.setItem('compMetric', currentMetric); } catch(_){}
        applyAndRender();
      });
    });
    // Auto aplicar al abrir
    applyAndRender();
  }

  function renderCharts(subjectAgg={}, monthAgg={}, catSubAgg={}){
    const metric = currentMetric;
    const subjLabels = Object.keys(subjectAgg||{});
    const subjData = subjLabels.map(k => Number(subjectAgg[k]?.[metric]||0));
    const monthLabels = Object.keys(monthAgg||{});
    const monthData = monthLabels.map(k => Number(monthAgg[k]?.[metric]||0));
    const catSubLabels = Object.keys(catSubAgg||{});
    const catSubData = catSubLabels.map(k => Number(catSubAgg[k]?.[metric]||0));

    const titleByMetric = { income: 'Ingresos', expense: 'Gastos', balance: 'Balance' };
    makeDoughnut('comp-chart-subjects', subjLabels, subjData, `${titleByMetric[metric]} por sujeto`);
    makeDoughnut('comp-chart-months', monthLabels.map(humanMonth), monthData, `${titleByMetric[metric]} por mes`);
    makeDoughnut('comp-chart-catsubs', catSubLabels, catSubData, `${titleByMetric[metric]} por categoría › subcategoría`);
  }

  function makeDoughnut(id, labels, data, title){
    const canvas = document.getElementById(id);
    if (!canvas || typeof Chart === 'undefined') return;
    const ctx = canvas.getContext('2d');
    window.compCharts = window.compCharts || {};
    try { if (window.compCharts[id]) { window.compCharts[id].destroy(); } } catch(_){}
    const colors = buildPalette(labels.length);
    window.compCharts[id] = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: '#ffffff', borderWidth: 2, hoverOffset: 12, offset: 8 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, title: { display: true, text: title } }, cutout: '60%' }
    });
  }

  function buildPalette(n){
    const base = ['#4e79a7','#f28e2c','#e15759','#76b7b2','#59a14f','#edc948','#b07aa1','#ff9da7','#9c755f','#bab0ab','#86bc86','#fabfd2','#b2df8a','#a6cee3','#1f78b4','#33a02c','#fb9a99','#e31a1c'];
    const colors = [];
    for (let i = 0; i < n; i++) { colors.push(base[i % base.length]); }
    return colors;
  }

  // Refrescar si cambian transacciones
  try {
    window.addEventListener('transactions-changed', () => {
      const active = document.querySelector('.comparative-analysis');
      if (active) { applyAndRender(); }
    });
  } catch(_) {}

  window.loadComparativeAnalysis = loadComparativeAnalysis;
})();