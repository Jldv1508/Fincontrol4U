// analysis.js - Pestaña de análisis avanzada por categoría/subcategoría, sujeto y período
(function(){
  // Lista por defecto de categorías y subcategorías (fallback)
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
  // ==== Utilidades de datos ====
  async function getAllTx(){
    if (typeof window.getAllTransactions === 'function') {
      try { return await window.getAllTransactions(); } catch(_) { return []; }
    }
    if (typeof window.DB !== 'undefined' && typeof DB.getAll === 'function') {
      try { return await DB.getAll('transactions'); } catch(_) { return []; }
    }
    return [];
  }

  function formatAmount(n){
    const num = Number(n)||0;
    if (typeof window.formatAmount === 'function') {
      try { return window.formatAmount(num); } catch(_) {}
    }
    const s = new Intl.NumberFormat('es-ES',{ style:'currency', currency:'EUR', minimumFractionDigits:2, maximumFractionDigits:2 }).format(num);
    return s.replace(/\u00a0/g,'').replace(/\s*€/,'€');
  }

  function withinPeriod(txs, period){
    // Obsoleto: mantenido por compatibilidad mínima
    return txs;
  }

  // Nuevo filtrado por año/mes
  const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  function getYearsFromTransactions(_txs){
    const startYear = 2024;
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= startYear; y--) {
      years.push(y);
    }
    return years;
  }
  function filterByYearMonth(txs, year, month){
    const y = (year||'').toString();
    const m = (month||'').toString();
    if (!y || y==='Todos') return txs; // si año es Todos, ignorar mes
    const yearNum = Number(y);
    const monthIndex = MONTHS.indexOf(m);
    return txs.filter(t => {
      const d = new Date(t.date);
      if (isNaN(d.getTime())) return false;
      const sameYear = d.getFullYear() === yearNum;
      if (m && m !== 'Todos' && monthIndex >= 0) {
        return sameYear && d.getMonth() === monthIndex;
      }
      return sameYear;
    });
  }

  function filterByMember(txs, member){
    const m = (member||'').trim();
    if (!m || m==='Todos') return txs;
    return txs.filter(t => (t.member||'') === m);
  }

  function generateCategoryAnalysis(transactions){
    const analysis = { totalIncome:0, totalExpenses:0, categories:{}, transactionCount: transactions.length, chartTitle:'Gastos por Categoría', title:'Detalles por Categoría' };
    transactions.forEach(tx => {
      const amount = Number(tx.amount)||0;
      const category = tx.category || 'Sin categoría';
      const type = tx.type || tx.kind || 'expense';
      if (!analysis.categories[category]) analysis.categories[category] = { income:0, expenses:0, transactions:[] };
      analysis.categories[category].transactions.push(tx);
      if (type === 'income') { analysis.categories[category].income += amount; analysis.totalIncome += amount; }
      else if (type === 'expense') { analysis.categories[category].expenses += amount; analysis.totalExpenses += amount; }
      // otros tipos (transferencia/traspaso) no suman en ingresos/gastos
    });
    const sortedCategories = Object.entries(analysis.categories).sort(([,a],[,b]) => (b.expenses) - (a.expenses));
    analysis.sortedCategories = sortedCategories;
    analysis.balance = analysis.totalIncome - analysis.totalExpenses;
    return analysis;
  }

  function generateSubcategoryAnalysis(transactions){
    const analysis = { totalIncome:0, totalExpenses:0, categories:{}, transactionCount: transactions.length, chartTitle:'Gastos por Subcategoría', title:'Detalles por Subcategoría' };
    transactions.forEach(tx => {
      const amount = Number(tx.amount)||0;
      const category = tx.category || 'Sin categoría';
      const sub = tx.subcategory || 'Sin subcategoría';
      const key = `${category}: ${sub}`;
      const type = tx.type || tx.kind || 'expense';
      if (!analysis.categories[key]) analysis.categories[key] = { income:0, expenses:0, transactions:[] };
      analysis.categories[key].transactions.push(tx);
      if (type === 'income') { analysis.categories[key].income += amount; analysis.totalIncome += amount; }
      else if (type === 'expense') { analysis.categories[key].expenses += amount; analysis.totalExpenses += amount; }
      // otros tipos no suman
    });
    const sortedCategories = Object.entries(analysis.categories).sort(([,a],[,b]) => (b.expenses) - (a.expenses));
    analysis.sortedCategories = sortedCategories;
    analysis.balance = analysis.totalIncome - analysis.totalExpenses;
    return analysis;
  }

  function renderAnalysisSummary(analysis, member, year, month){
    let periodText = 'Todo el período';
    if (year && year!=='Todos') {
      periodText = `Año ${year}`;
      if (month && month!=='Todos') periodText += `, ${month}`;
    }
    const memberText = (member && member!=='Todos') ? ` - ${member}` : ' - Todos los miembros';
    return `
      <div class="summary-cards row-1">
        <div class="summary-card income" data-kind="income">
          <h3>Ingresos</h3>
          <button class="summary-detail-btn" data-kind="income" aria-label="Ver detalle" title="Ver detalle">
            <i class="fas fa-eye"></i>
          </button>
          <p class="amount">${formatAmount(analysis.totalIncome)}</p>
        </div>
        <div class="summary-card expense" data-kind="expense">
          <h3>Gastos</h3>
          <button class="summary-detail-btn" data-kind="expense" aria-label="Ver detalle" title="Ver detalle">
            <i class="fas fa-eye"></i>
          </button>
          <p class="amount">-${formatAmount(analysis.totalExpenses)}</p>
        </div>
        <div class="summary-card balance" data-kind="balance">
          <h3>Balance</h3>
          <button class="summary-detail-btn" data-kind="balance" aria-label="Ver detalle" title="Ver detalle">
            <i class="fas fa-eye"></i>
          </button>
          <p class="amount">${formatAmount(analysis.balance)}</p>
        </div>
      </div>
      <div class="summary-cards row-2">
        <div class="summary-card" data-kind="all">
          <h3>Transacciones</h3>
          <button class="summary-detail-btn" data-kind="all" aria-label="Ver detalle" title="Ver detalle">
            <i class="fas fa-eye"></i>
          </button>
          <p>${(analysis.transactionCount||0).toLocaleString('es-ES')}</p>
        </div>
      </div>`;
  }

  function renderCategoryDetails(analysis){
    if (!analysis.sortedCategories || !analysis.sortedCategories.length) {
      return '<p class="empty-state">No hay datos para mostrar</p>';
    }
    return `
      <div class="category-details-list">
        <h3 class="category-details-title">${analysis.title || 'Detalles'}</h3>
        ${analysis.sortedCategories.map(([name, data], idx) => {
          const expensePercentage = analysis.totalExpenses > 0 ? ((data.expenses / analysis.totalExpenses) * 100).toFixed(1) : 0;
          const totalAmount = (Number(data.income)||0) + (Number(data.expenses)||0);
          return `
            <div class="category-detail-item">
              <div class="category-header">
                <div class="category-title-block">
                  <h4>${name}</h4>
                  <button class="cat-detail-btn" data-index="${idx}" aria-label="Ver detalle" title="Ver detalle">
                    <i class="fas fa-eye"></i>
                  </button>
                </div>
                <div class="category-amounts">
                  ${data.income > 0 ? `<span class="income">+${formatAmount(data.income)}</span>` : ''}
                  ${data.expenses > 0 ? `<span class="expense">-${formatAmount(data.expenses)}</span>` : ''}
                  <span class="percentage">${expensePercentage}%</span>
                  
                </div>
              </div>
              <div class="category-progress">
                <div class="progress-fill" style="width:${expensePercentage}%;"></div>
              </div>
              <div class="cat-detail" id="cat-detail-${idx}"></div>
              <p>${data.transactions.length} transacciones</p>
            </div>`;
        }).join('')}
      </div>`;
  }

  function renderChart(canvas, analysis){
    if (!window.Chart || !canvas) return;
    const ctx = canvas.getContext('2d');
    try {
      if (window.analysisChart) { window.analysisChart.destroy(); }
      const top = (analysis.sortedCategories || []).slice(0,8);
      const labels = top.map(([n]) => n);
      const data = top.map(([,d]) => d.expenses);
      const colors = ['#FF6384','#36A2EB','#FFCE56','#4BC0C0','#9966FF','#FF9F40','#C9CBCF','#90CAF9'];
      window.analysisChart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins:{ legend:{ position:'bottom' }, title:{ display:true, text: analysis.chartTitle || 'Gastos' } } }
      });
    } catch(_){}
  }

  // ==== Render principal ====
  function getUniqueCategories(txs){
    const fromData = new Set();
    txs.forEach(t => fromData.add(t.category || 'Sin categoría'));
    const union = Array.from(new Set([].concat(DEFAULT_CATEGORIES, Array.from(fromData))));
    return union.sort((a,b)=>a.localeCompare(b, 'es', { sensitivity:'base' }));
  }
  function getUniqueSubcategories(txs, category){
    const filtered = (category && category!=='Todas') ? txs.filter(t => (t.category||'Sin categoría')===category) : txs;
    const fromData = new Set();
    filtered.forEach(t => fromData.add(t.subcategory || 'Sin subcategoría'));
    const norm = (category||'').toString().trim().toLowerCase();
    const defaults = DEFAULT_SUBCATEGORIES[norm] || [];
    const union = Array.from(new Set([].concat(Array.from(fromData), defaults)));
    return union.sort((a,b)=>a.localeCompare(b, 'es', { sensitivity:'base' }));
  }

  function populateSelect(el, items, placeholder, selected){
    if (!el) return;
    const opts = [`<option value="Todas">${placeholder}</option>`].concat(items.map(i => `<option value="${i}" ${selected===i?'selected':''}>${i}</option>`));
    el.innerHTML = opts.join('');
  }

  function filterByCategorySubcategory(txs, category, subcategory){
    let out = txs;
    if (category && category!=='Todas') out = out.filter(t => (t.category||'Sin categoría') === category);
    if (subcategory && subcategory!=='Todas') out = out.filter(t => (t.subcategory||'Sin subcategoría') === subcategory);
    return out;
  }

  async function render({ year = 'Todos', month = 'Todos', member = 'Todos', category = 'Todas', subcategory = 'Todas' } = {}){
    const main = ensureMain();
    if (!main) return;
    const all = await getAllTx();
    const byYearMonth = filterByYearMonth(all, year, month);
    const byMember = filterByMember(byYearMonth, member);
    // Población inicial de selects dependerá de datos filtrados por período y sujeto
    const categoriesList = getUniqueCategories(byMember);
    const subcategoriesList = getUniqueSubcategories(byMember, category);
    const filteredByCatSub = filterByCategorySubcategory(byMember, category, subcategory);
    const analysis = generateCategoryAnalysis(filteredByCatSub);

    // Estadísticas de Transferencias y Traspasos sobre el conjunto filtrado
    function normalizeType(val){
      const t = (val||'').toString().trim().toLowerCase();
      if (t === 'transfer' || t.startsWith('transferenc')) return 'transferencia';
      if (t === 'traspaso') return 'traspaso';
      return t;
    }
    const transfersStats = filteredByCatSub.reduce((acc, t) => {
      const type = normalizeType(t.type || t.kind);
      const amt = Math.abs(Number(t.amount) || 0);
      if (type === 'transferencia') { acc.transfersAmount += amt; acc.transfersCount += 1; }
      else if (type === 'traspaso') { acc.traspasosAmount += amt; acc.traspasosCount += 1; }
      return acc;
    }, { transfersAmount:0, transfersCount:0, traspasosAmount:0, traspasosCount:0 });

    main.innerHTML = `
      <section class="advanced-analysis" style="padding:1rem;">
        <div class="analysis-toolbar" style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;margin-bottom:.5rem;border-bottom:1px solid #eaeaea;padding:.5rem .25rem;">
          <h2 style="margin:0;display:flex;align-items:center;gap:.5rem;"><i class="fas fa-chart-bar"></i> Análisis</h2>
          <div class="filters" style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;">
            <select id="analysis-year" class="form-control" title="Año"></select>
            <select id="analysis-month" class="form-control" title="Mes"></select>
            <select id="analysis-member" class="form-control" title="Sujeto"></select>
            <select id="analysis-category" class="form-control" title="Categoría"></select>
            <select id="analysis-subcategory" class="form-control" title="Subcategoría"></select>
            <button id="analysis-apply" class="btn btn-primary btn-sm"><i class="fas fa-filter"></i> Aplicar</button>
            <button id="analysis-clear" class="btn btn-secondary btn-sm" title="Limpiar filtros"><i class="fas fa-times"></i> Limpiar filtros</button>
          </div>
        </div>
        <div id="analysis-summary"></div>
        <div style="background:#fff;border-radius:8px;padding:1rem;box-shadow:0 2px 8px rgba(0,0,0,.08);height:240px;margin-bottom:.5rem;">
          <canvas id="analysis-chart" aria-label="Gráfico de categorías" role="img"></canvas>
        </div>
        <div id="analysis-details"></div>
      </section>`;

    // Poblar miembros
    const memberSel = document.getElementById('analysis-member');
    if (memberSel) {
      const optsHtml = (typeof FamilyManager !== 'undefined') ? FamilyManager.generateMemberOptions(member||'Todos') : `<option value="Todos">Sujeto</option>`;
      memberSel.innerHTML = optsHtml;
      try { applyMemberSelectColor(); } catch(_) {}
    }
    // Poblar año y mes
    const yearSel = document.getElementById('analysis-year');
    const monthSel = document.getElementById('analysis-month');
    if (yearSel) {
      const years = getYearsFromTransactions(all);
      const yOpts = ['<option value="Todos">Todos los años</option>']
        .concat(years.map(y => `<option value="${y}" ${String(year)===String(y)?'selected':''}>${y}</option>`))
        .join('');
      yearSel.innerHTML = yOpts;
    }
    if (monthSel) {
      const mOpts = ['<option value="Todos">Todos los meses</option>']
        .concat(MONTHS.map(m => `<option value="${m}" ${month===m?'selected':''}>${m}</option>`))
        .join('');
      monthSel.innerHTML = mOpts;
    }
    // Poblar categorías y subcategorías
    const catSel = document.getElementById('analysis-category');
    const subSel = document.getElementById('analysis-subcategory');
    populateSelect(catSel, categoriesList, 'Categoría', category);
    populateSelect(subSel, subcategoriesList, 'Subcategoría', subcategory);

    // Mostrar resumen y detalles
    const summaryEl = document.getElementById('analysis-summary');
    const detailsEl = document.getElementById('analysis-details');
    if (summaryEl) {
      // Precalcular subconjuntos para los detalles
      const txIncome = filteredByCatSub.filter(t => (t.type||t.kind) === 'income');
      const txExpense = filteredByCatSub.filter(t => (t.type||t.kind) === 'expense');
      const txTransfers = filteredByCatSub.filter(t => normalizeType(t.type||t.kind) === 'transferencia');
      const txTraspasos = filteredByCatSub.filter(t => normalizeType(t.type||t.kind) === 'traspaso');
      const txAll = filteredByCatSub.slice();

      summaryEl.innerHTML = renderAnalysisSummary(analysis, member, year, month);
      const extrasHtml = `
        <div class="summary-card" data-kind="transferencia">
          <h3>Transferencias</h3>
          <button class="summary-detail-btn" data-kind="transferencia" aria-label="Ver detalle" title="Ver detalle">
            <i class="fas fa-eye"></i>
          </button>
          <p class="amount">${formatAmount(transfersStats.transfersAmount)}</p>
        </div>
        <div class="summary-card" data-kind="traspaso">
          <h3>Traspasos</h3>
          <button class="summary-detail-btn" data-kind="traspaso" aria-label="Ver detalle" title="Ver detalle">
            <i class="fas fa-eye"></i>
          </button>
          <p class="amount">${formatAmount(transfersStats.traspasosAmount)}</p>
        </div>`;
      try {
        const grid2 = summaryEl.querySelector('.summary-cards.row-2');
        if (grid2) grid2.insertAdjacentHTML('beforeend', extrasHtml);
      } catch(_) {}

      // Contenedor para detalles del resumen
      summaryEl.insertAdjacentHTML('beforeend', '<div id="summary-details" class="summary-details" style="margin:.5rem 0 1rem;"></div>');

      // Función para renderizar tabla de transacciones
      function renderTxList(title, txs){
        const sorted = txs.slice().sort((a,b)=>{
          const d = (new Date(b.date)) - (new Date(a.date));
          if (d !== 0) return d;
          const ac = (a.category||'').localeCompare(b.category||'', 'es', { sensitivity:'base' });
          if (ac !== 0) return ac;
          return (a.subcategory||'').localeCompare(b.subcategory||'', 'es', { sensitivity:'base' });
        });
        const rows = sorted.map(t => {
          const d = new Date(t.date);
          const dateStr = isNaN(d.getTime()) ? (t.date||'') : d.toLocaleDateString('es-ES');
          const desc = t.description || t.desc || '';
          const cat = t.category || 'Sin categoría';
          const sub = t.subcategory || 'Sin subcategoría';
          const mem = t.member || '';
          const typ = (t.type||t.kind)||'';
          const baseAmt = Math.abs(Number(t.amount)||0);
          const amt = formatAmount(baseAmt);
          const sign = typ==='income' ? '+' : (typ==='expense' ? '-' : '');
          const cls = typ==='income' ? 'income' : (typ==='expense' ? 'expense' : '');
          return `<tr><td>${dateStr}</td><td>${desc}</td><td>${cat}</td><td>${sub}</td><td>${mem}</td><td class="${cls}">${sign}${amt}</td></tr>`;
        }).join('');
        return `
          <div class="card table-card">
            <h3>${title} (${sorted.length})</h3>
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Subcategoría</th><th>Sujeto</th><th>Importe</th></tr></thead>
                <tbody>${rows || '<tr><td colspan="6">Sin datos</td></tr>'}</tbody>
              </table>
            </div>
          </div>`;
      }

      // Eventos de "Ver detalle" en tarjetas del resumen (toggle con segundo clic)
      summaryEl.querySelectorAll('.summary-detail-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const kind = btn.getAttribute('data-kind');
          const box = document.getElementById('summary-details');
          const card = btn.closest('.summary-card');
          if (!box) return;
          const openKind = summaryEl.getAttribute('data-open-kind') || '';
          if (openKind === kind) {
            box.innerHTML = '';
            summaryEl.setAttribute('data-open-kind', '');
            // Quitar estado activo del botón
            btn.classList.remove('active');
            if (card) card.classList.remove('active-card');
            return;
          }
          // Marcar activo el botón actual y desactivar otros
          summaryEl.querySelectorAll('.summary-detail-btn').forEach(b => b.classList.remove('active'));
          // Desactivar estado activo de otras tarjetas
          summaryEl.querySelectorAll('.summary-card').forEach(c => c.classList.remove('active-card'));
          let html = '';
          switch(kind){
            case 'income': html = renderTxList('Detalle de Ingresos', txIncome); break;
            case 'expense': html = renderTxList('Detalle de Gastos', txExpense); break;
            case 'balance': html = renderTxList('Detalle de Balance (ingresos y gastos)', txIncome.concat(txExpense)); break;
            case 'all': html = renderTxList('Todas las transacciones del período', txAll); break;
            case 'transferencia': html = renderTxList('Detalle de Transferencias', txTransfers); break;
            case 'traspaso': html = renderTxList('Detalle de Traspasos', txTraspasos); break;
            case 'period': html = renderTxList('Transacciones del período seleccionado', txAll); break;
            default: html = renderTxList('Transacciones', txAll); break;
          }
          box.innerHTML = html;
          summaryEl.setAttribute('data-open-kind', kind);
          btn.classList.add('active');
          if (card) card.classList.add('active-card');
        });
      });
    }
    if (detailsEl) detailsEl.innerHTML = renderCategoryDetails(analysis);
    // Eventos de "Ver detalle" por categoría (toggle con segundo clic)
    if (detailsEl) {
      const items = analysis.sortedCategories || [];
      detailsEl.querySelectorAll('.cat-detail-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.getAttribute('data-index')) || 0;
          const target = detailsEl.querySelector(`#cat-detail-${idx}`);
          const card = btn.closest('.category-detail-item');
          if (!target) return;
          if (target.innerHTML && target.innerHTML.trim().length > 0) {
            target.innerHTML = '';
            btn.classList.remove('active');
            if (card) card.classList.remove('active-card');
            return;
          }
          // Desactivar otros y activar el actual
          detailsEl.querySelectorAll('.cat-detail-btn').forEach(b => b.classList.remove('active'));
          detailsEl.querySelectorAll('.category-detail-item').forEach(c => c.classList.remove('active-card'));
          const pair = items[idx];
          const data = pair ? pair[1] : null;
          const txs = data ? (data.transactions || []) : [];
          const rows = txs.slice().sort((a,b)=>{
            const d = (new Date(b.date)) - (new Date(a.date));
            if (d !== 0) return d;
            return (a.category||'').localeCompare(b.category||'', 'es', { sensitivity:'base' });
          }).map(t => {
            const d = new Date(t.date);
            const dateStr = isNaN(d.getTime()) ? (t.date||'') : d.toLocaleDateString('es-ES');
            const desc = t.description || t.desc || '';
            const mem = t.member || '';
            const typ = (t.type||t.kind)||'';
            const baseAmt = Math.abs(Number(t.amount)||0);
            const amt = formatAmount(baseAmt);
            const sign = typ==='income' ? '+' : (typ==='expense' ? '-' : '');
            const cls = typ==='income' ? 'income' : (typ==='expense' ? 'expense' : '');
            return `<tr><td>${dateStr}</td><td>${desc}</td><td>${mem}</td><td class="${cls}">${sign}${amt}</td></tr>`;
          }).join('');
          const html = `
            <div class="card table-card">
              <div class="table-wrap">
                <table class="table compact">
                  <thead><tr><th>Fecha</th><th>Descripción</th><th>Sujeto</th><th>Importe</th></tr></thead>
                  <tbody>${rows || '<tr><td colspan="4">Sin datos</td></tr>'}</tbody>
                </table>
              </div>
            </div>`;
          target.innerHTML = html;
          btn.classList.add('active');
          if (card) card.classList.add('active-card');
        });
      });
    }
    // Hacer tarjetas del resumen clicables (además del botón) y accesibles por teclado
    if (summaryEl) {
      summaryEl.querySelectorAll('.summary-card').forEach(card => {
        const kind = card.getAttribute('data-kind');
        if (!kind) return;
        card.setAttribute('tabindex', '0');
        card.addEventListener('click', (e) => {
          // Si el click fue en el botón, dejar que el handler existente actúe
          if ((e.target instanceof HTMLElement) && e.target.closest('.summary-detail-btn')) return;
          const btn = card.querySelector('.summary-detail-btn');
          if (btn) btn.click();
        });
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const btn = card.querySelector('.summary-detail-btn');
            if (btn) btn.click();
          }
        });
      });
    }
    renderChart(document.getElementById('analysis-chart'), analysis);

    // Eventos
    document.getElementById('analysis-apply')?.addEventListener('click', () => {
      const next = {
        year: document.getElementById('analysis-year')?.value || year,
        month: document.getElementById('analysis-month')?.value || month,
        member: document.getElementById('analysis-member')?.value || member,
        category: document.getElementById('analysis-category')?.value || category,
        subcategory: document.getElementById('analysis-subcategory')?.value || subcategory
      };
      render(next);
    });
    document.getElementById('analysis-year')?.addEventListener('change', () => {
      const next = {
        year: document.getElementById('analysis-year')?.value || year,
        month: document.getElementById('analysis-month')?.value || month,
        member: document.getElementById('analysis-member')?.value || member,
        category: document.getElementById('analysis-category')?.value || category,
        subcategory: document.getElementById('analysis-subcategory')?.value || subcategory
      };
      render(next);
    });
    document.getElementById('analysis-month')?.addEventListener('change', () => {
      const next = {
        year: document.getElementById('analysis-year')?.value || year,
        month: document.getElementById('analysis-month')?.value || month,
        member: document.getElementById('analysis-member')?.value || member,
        category: document.getElementById('analysis-category')?.value || category,
        subcategory: document.getElementById('analysis-subcategory')?.value || subcategory
      };
      render(next);
    });
    document.getElementById('analysis-category')?.addEventListener('change', () => {
      const newCat = document.getElementById('analysis-category')?.value || category;
      const updatedSubList = getUniqueSubcategories(byMember, newCat);
      populateSelect(document.getElementById('analysis-subcategory'), updatedSubList, 'Subcategoría', 'Todas');
    });
    document.getElementById('analysis-clear')?.addEventListener('click', () => {
      const next = { year:'Todos', month:'Todos', member:'Todos', category:'Todas', subcategory:'Todas' };
      render(next);
    });
  }

  async function loadAnalysis(){
    const main = ensureMain();
    if (main) main.innerHTML = '<section class="loading"><p>Cargando análisis...</p></section>';
    try { await render({ year:'Todos', month:'Todos', member:'Todos' }); } catch (e) {
      console.error('Error cargando Análisis:', e);
      if (main) main.innerHTML = '<p class="empty-state">Sección no disponible</p>';
      if (window.UIManager) UIManager.showToast('Error al cargar Análisis', 'error');
    }
  }

  function getMemberClass(name){
    if (!name) return '';
    const slug = (name||'').toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-');
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
  function applyMemberSelectColor(){
    const el = document.getElementById('analysis-member');
    if (!el) return;
    const val = el.value || '';
    const cls = getMemberClass(val);
    el.classList.remove('member-color','jose-luis','gemma','hugo','alba','familia','otros');
    if (!val || val === 'Todos') return;
    el.classList.add('member-color');
    if (cls) el.classList.add(cls);
  }

  // Refrescar si cambian transacciones y esta vista está activa
  try {
    window.addEventListener('transactions-changed', async () => {
      const active = document.querySelector('.advanced-analysis');
      if (active) {
        try {
          const year = document.getElementById('analysis-year')?.value || 'Todos';
          const month = document.getElementById('analysis-month')?.value || 'Todos';
          const member = document.getElementById('analysis-member')?.value || 'Todos';
          const category = document.getElementById('analysis-category')?.value || 'Todas';
          const subcategory = document.getElementById('analysis-subcategory')?.value || 'Todas';
          await render({ year, month, member, category, subcategory });
        } catch(_) {}
      }
    });
  } catch(_) {}

  window.loadAnalysis = loadAnalysis;
})();
// === Extensiones multi-select (colocadas fuera del IIFE original por compatibilidad) ===
// Nota: Si estas funciones deben estar dentro del IIFE, mover su contenido antes de la línea 'window.loadAnalysis = loadAnalysis;'
function populateSelectMulti(el, items, placeholder, selectedList){
  if (!el) return;
  const selectedSet = new Set(Array.isArray(selectedList) ? selectedList : []);
  const opts = [`<option value="Todas">${placeholder}</option>`].concat(items.map(i => `<option value="${i}" ${selectedSet.has(i)?'selected':''}>${i}</option>`));
  el.innerHTML = opts.join('');
  el.multiple = true;
}

function getUniqueSubcategoriesMulti(txs, categories){
  const catsArr = Array.isArray(categories) ? categories.filter(Boolean) : [];
  const filtered = catsArr.length ? txs.filter(t => catsArr.includes(t.category||'Sin categoría')) : txs;
  const fromData = new Set();
  filtered.forEach(t => fromData.add(t.subcategory || 'Sin subcategoría'));
  const defaultsAll = catsArr.length
    ? catsArr.flatMap(c => (typeof DEFAULT_SUBCATEGORIES !== 'undefined' ? (DEFAULT_SUBCATEGORIES[(c||'').toString().trim().toLowerCase()] || []) : []))
    : [];
  const union = Array.from(new Set([].concat(Array.from(fromData), defaultsAll)));
  return union.sort((a,b)=>a.localeCompare(b, 'es', { sensitivity:'base' }));
}

function filterByYearMonths(txs, year, months){
  const y = (year||'').toString();
  const monthsArr = Array.isArray(months) ? months.filter(m=>m && m!=='Todos') : [];
  return txs.filter(t => {
    const d = new Date(t.date);
    if (isNaN(d.getTime())) return false;
    const okYear = (!y || y==='Todos') ? true : d.getFullYear() === Number(y);
    const MONTHS_LOCAL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const monthName = MONTHS_LOCAL[d.getMonth()];
    const okMonth = monthsArr.length ? monthsArr.includes(monthName) : true;
    return okYear && okMonth;
  });
}

function filterByMembers(txs, members){
  const arr = Array.isArray(members) ? members.filter(m => m && m!=='Todos') : [];
  if (!arr.length) return txs;
  return txs.filter(t => arr.includes((t.member||'')));
}

function filterByCategoriesSubcategories(txs, categories, subcategories){
  const catsArr = Array.isArray(categories) ? categories.filter(Boolean) : [];
  const subsArr = Array.isArray(subcategories) ? subcategories.filter(Boolean) : [];
  let out = txs;
  if (catsArr.length) out = out.filter(t => catsArr.includes(t.category || 'Sin categoría'));
  if (subsArr.length) out = out.filter(t => subsArr.includes(t.subcategory || 'Sin subcategoría'));
  return out;
}