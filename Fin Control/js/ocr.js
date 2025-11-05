// ocr.js - Implementación básica de OCR con Tesseract.js para escaneo de extractos
(function(){
  // Utilidad para cargar scripts externos
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

  // Asegurar Tesseract.js y el idioma
  let tesseractReady = false;
  let worker = null;
  async function ensureTesseract() {
    if (!window.Tesseract) {
      await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@2.1.5/dist/tesseract.min.js');
    }
    if (!tesseractReady) {
      const core = window.Tesseract;
      if (!core) throw new Error('Tesseract no disponible');
      worker = await core.createWorker({
        logger: (m) => {
          try {
            const el = document.getElementById('scanner-status') || document.getElementById('ocr-status');
            if (el) el.textContent = `OCR: ${m.status || ''} ${m.progress ? Math.round(m.progress*100)+'%' : ''}`;
          } catch(_){}
        }
      });
      // Intentar español, caer a inglés si falla
      await worker.loadLanguage('spa').catch(async () => {
        await worker.loadLanguage('eng');
      });
      try { await worker.initialize('spa'); }
      catch(_) { await worker.initialize('eng'); }
      tesseractReady = true;
    }
  }

  // Parseo robusto de números locales
  function parseLocaleNumber(input) {
    let s = String(input || '').trim();
    const neg = /\(/.test(s) || /^-/.test(s);
    s = s.replace(/\s/g, '');
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    let decIdx = Math.max(lastComma, lastDot);
    if (decIdx > -1) {
      const intPart = s.slice(0, decIdx).replace(/[.,]/g, '');
      const fracPart = s.slice(decIdx + 1);
      s = intPart + '.' + fracPart;
    } else {
      s = s.replace(/[.,]/g, '');
    }
    let n = parseFloat(s);
    if (isNaN(n)) n = 0;
    return neg ? -Math.abs(n) : n;
  }

  function normalizeDate(raw) {
    if (!raw) return new Date().toISOString().slice(0,10);
    const s = String(raw).trim();
    const m = s.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
    if (m) {
      let d = parseInt(m[1],10), mo = parseInt(m[2],10)-1, y = parseInt(m[3],10);
      if (y < 100) y += 2000;
      const dt = new Date(y, mo, d);
      return dt.toISOString().slice(0,10);
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0,10);
    return new Date().toISOString().slice(0,10);
  }

  // Extraer transacciones de texto
  function extractTransactionsFromText(text) {
    const lines = String(text || '').split(/\n/).map(l => l.trim()).filter(Boolean);
    const rows = [];
    const re = /(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}).*?([A-Za-zÁÉÍÓÚÑ0-9 ,\.\-\/]+?)\s+([\-\+]?\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d{2}))/;
    for (const l of lines) {
      const m = l.match(re);
      if (m) {
        rows.push({
          date: normalizeDate(m[1]),
          description: m[2].trim(),
          amount: parseLocaleNumber(m[3])
        });
      }
    }
    if (!rows.length) {
      const tokens = String(text || '').split(/\s+/).filter(Boolean);
      let curDate = null; let buffer = [];
      const dateRe = /(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/;
      const amountRe = /[\-\+]?\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d{2})/;
      for (const tok of tokens) {
        const dm = tok.match(dateRe);
        if (dm) {
          if (curDate && buffer.length) {
            const joined = buffer.join(' ');
            const am = joined.match(amountRe);
            if (am) {
              rows.push({ date: normalizeDate(curDate), description: joined.replace(am[0],'').trim(), amount: parseLocaleNumber(am[0]) });
            }
          }
          curDate = dm[1]; buffer = []; continue;
        }
        const amInline = tok.match(amountRe);
        if (amInline && curDate) {
          const desc = buffer.join(' ').trim();
          rows.push({ date: normalizeDate(curDate), description: desc, amount: parseLocaleNumber(amInline[0]) });
          buffer = []; curDate = null; continue;
        }
        buffer.push(tok);
      }
    }
    return rows;
  }

  // Mostrar resultados en modal
  function showExtractResults(transactions, meta = {}) {
    if (!transactions || !transactions.length) {
      if (typeof showNotification === 'function') showNotification('No se encontraron movimientos en el escaneo', 'warning');
      return;
    }
    const fmt = (n) => (Number(n||0)).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const items = transactions.map((t, i) => `
      <div class="transaction-item" data-i="${i}">
        <div class="transaction-details">
          <div class="transaction-title">${t.description || 'Movimiento'}</div>
          <div class="transaction-date">${normalizeDate(t.date)}</div>
        </div>
        <div class="transaction-amount ${t.amount >= 0 ? 'income' : 'expense'}">${t.amount >= 0 ? '+' : '-'}${fmt(Math.abs(t.amount))} €</div>
      </div>
    `).join('');
    const content = `
      <div class="extract-results">
        <div class="results-summary"><p>Detectados ${transactions.length} movimientos${meta.bank ? ' · Banco: '+meta.bank : ''}.</p></div>
        <div class="transactions-container">${items}</div>
        <div class="form-actions">
          <button id="add-all-ocr" class="btn btn-primary"><i class="fas fa-plus"></i> Añadir todos</button>
          <button id="close-ocr" class="btn btn-secondary">Cerrar</button>
        </div>
      </div>
    `;
    window.showModal({ title: 'Resultados del escaneo', content, size: 'large', onOpen: () => {
      const addAll = document.getElementById('add-all-ocr');
      const closeBtn = document.getElementById('close-ocr');
      if (addAll) addAll.addEventListener('click', async () => {
        let saved = 0;
        for (const r of transactions) {
          const tx = {
            id: 'trans_' + Date.now() + '_' + Math.random().toString(16).slice(2),
            type: r.amount >= 0 ? 'income' : 'expense',
            amount: Math.abs(Number(r.amount)||0),
            date: normalizeDate(r.date),
            description: r.description || 'Movimiento',
            category: 'otros',
            source: meta.source || 'OCR',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          try { if (window.DB && typeof DB.add === 'function') { await DB.add('transactions', tx); saved++; } }
          catch(e){ console.error('Error guardando movimiento OCR', e); }
        }
        window.closeModal();
        if (typeof showNotification === 'function') showNotification(`Añadidos ${saved}/${transactions.length} movimientos`, 'success');
      });
      if (closeBtn) closeBtn.addEventListener('click', () => window.closeModal());
    }});
  }

  const OCRManager = {
    state: { isInitialized: false },
    async init() {
      await ensureTesseract();
      this.state.isInitialized = true;
      if (typeof window.showNotification === 'function') {
        showNotification('OCR inicializado', 'info');
      }
      return true;
    },
    showScanInterface() {
      const content = `
        <div class="ocr-scanner-container">
          <div class="ocr-viewfinder">
            <video id="ocr-camera-preview" autoplay playsinline></video>
            <div class="ocr-scan-area">
              <div class="ocr-corner top-left"></div>
              <div class="ocr-corner top-right"></div>
              <div class="ocr-corner bottom-left"></div>
              <div class="ocr-corner bottom-right"></div>
              <div class="ocr-scan-line"></div>
            </div>
          </div>
          <div class="ocr-controls">
            <button id="ocr-capture-btn" class="btn primary"><i class="fas fa-camera"></i></button>
            <label class="btn btn-outline-secondary"><i class="fas fa-file-image"></i>
              <input type="file" id="ocr-upload-input" accept="image/*" style="display:none" />
            </label>
          </div>
          <div id="ocr-status" class="ocr-status"></div>
        </div>
      `;
      window.showModal({ title: 'Escáner OCR', content, size: 'fullscreen', onClose: () => {
        try { const v = document.getElementById('ocr-camera-preview'); if (v && v.srcObject) v.srcObject.getTracks().forEach(t => t.stop()); } catch(_){}
      }});
      (async () => {
        const video = document.getElementById('ocr-camera-preview');
        const statusEl = document.getElementById('ocr-status');
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
          if (video) video.srcObject = stream;
        } catch (e) {
          if (statusEl) statusEl.textContent = 'No se pudo acceder a la cámara. Usa subida de imagen.';
        }
        const cap = document.getElementById('ocr-capture-btn');
        if (cap) cap.addEventListener('click', async () => {
          if (!video) return;
          statusEl.textContent = 'Procesando captura...';
          const canvas = document.createElement('canvas');
          const w = 1024; const h = Math.round(w * (video.videoHeight / Math.max(1, video.videoWidth)));
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/png');
          try {
            await ensureTesseract();
            const res = await worker.recognize(dataUrl);
            const text = res && res.data && res.data.text ? res.data.text : '';
            statusEl.textContent = 'Analizando texto...';
            let rows = [];
            if (window.BankExtractManager && typeof window.BankExtractManager.extractTransactionsFromText === 'function') {
              rows = window.BankExtractManager.extractTransactionsFromText(text, 'Genérico', new Date().toISOString().slice(0,10)) || [];
            } else {
              rows = extractTransactionsFromText(text);
            }
            statusEl.textContent = `Detectados ${rows.length} movimientos`;
            showExtractResults(rows, { source: 'OCR' });
          } catch (err) {
            console.error('Error OCR:', err);
            statusEl.textContent = 'Error OCR en la captura';
            if (typeof showNotification === 'function') showNotification('Error OCR en la captura', 'error');
          }
        });
        const up = document.getElementById('ocr-upload-input');
        if (up) up.addEventListener('change', async (e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          statusEl.textContent = 'Procesando imagen...';
          try {
            const reader = new FileReader();
            const dataUrl = await new Promise((resolve, reject) => { reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
            await ensureTesseract();
            const res = await worker.recognize(dataUrl);
            const text = res && res.data && res.data.text ? res.data.text : '';
            statusEl.textContent = 'Analizando texto...';
            let rows = [];
            if (window.BankExtractManager && typeof window.BankExtractManager.extractTransactionsFromText === 'function') {
              rows = window.BankExtractManager.extractTransactionsFromText(text, 'Genérico', new Date().toISOString().slice(0,10)) || [];
            } else {
              rows = extractTransactionsFromText(text);
            }
            statusEl.textContent = `Detectados ${rows.length} movimientos`;
            showExtractResults(rows, { source: 'OCR' });
          } catch (err) {
            console.error('Error OCR imagen:', err);
            statusEl.textContent = 'Error al procesar la imagen';
            if (typeof showNotification === 'function') showNotification('Error OCR en imagen', 'error');
          } finally {
            e.target.value = '';
          }
        });
      })();
    },
    async processUploadedImage(file) {
      try {
        const statusEl = document.getElementById('scanner-status');
        if (statusEl) statusEl.textContent = 'Procesando imagen...';
        const reader = new FileReader();
        const dataUrl = await new Promise((resolve, reject) => { reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
        await ensureTesseract();
        const res = await worker.recognize(dataUrl);
        const text = res && res.data && res.data.text ? res.data.text : '';
        if (statusEl) statusEl.textContent = 'Analizando texto...';
        let rows = [];
        if (window.BankExtractManager && typeof window.BankExtractManager.extractTransactionsFromText === 'function') {
          rows = window.BankExtractManager.extractTransactionsFromText(text, 'Genérico', new Date().toISOString().slice(0,10)) || [];
        } else {
          rows = extractTransactionsFromText(text);
        }
        if (statusEl) statusEl.textContent = `Detectados ${rows.length} movimientos`;
        showExtractResults(rows, { source: 'OCR' });
      } catch (e) {
        console.error('Error OCR:', e);
        if (typeof window.showNotification === 'function') {
          showNotification('Error OCR procesando imagen', 'error');
        }
      }
    }
  };
  window.OCRManager = OCRManager;
})();