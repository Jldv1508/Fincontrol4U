// Parser robusto de extractos PDF con carga automática de pdfjs
(function(){
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

  function parseLocaleNumber(str) {
    if (typeof str === 'number') return str;
    if (typeof str !== 'string') return 0;
    let s = str.trim();
    const neg = /^-/.test(s) || /\(.*\)/.test(s);
    s = s.replace(/[\s\(\)]/g, '').replace(/^\+/, '').replace(/^-/, '');
    const m = s.match(/([.,])(\d{1,2})$/);
    if (m) {
      const dec = m[1];
      const thou = dec === '.' ? ',' : '.';
      s = s.replace(new RegExp('\\' + thou, 'g'), '');
      s = s.replace(new RegExp('\\' + dec, 'g'), '.');
    } else {
      s = s.replace(/[.,]/g, '');
    }
    const n = parseFloat(s);
    return neg ? -Math.abs(n) : n;
  }

  async function robustParsePDFStatement(file) {
    await ensurePdfJs();
    const buf = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const rows = [];
    const textParts = [];
    const dateRe = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/;
    const amountRe = /[\-\+]?\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d{2})/;
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const tokens = content.items.map(it => (it.str || '').trim()).filter(Boolean);
      try { textParts.push(content.items.map(it => it.str).join('\n')); } catch(_) {}
      let currentDate = null;
      let buffer = [];
      for (const tok of tokens) {
        const dateMatch = tok.match(dateRe);
        if (dateMatch) {
          if (currentDate && buffer.length) {
            const joined = buffer.join(' ');
            const amtMatch = joined.match(amountRe);
            if (amtMatch) {
              const amtStr = amtMatch[0];
              const desc = joined.replace(amtStr, '').trim();
              rows.push({ date: currentDate, description: desc, amount: parseLocaleNumber(amtStr) });
            }
          }
          currentDate = dateMatch[1];
          buffer = [];
          continue;
        }
        const amtMatchInline = tok.match(amountRe);
        if (amtMatchInline && currentDate) {
          const amtStr = amtMatchInline[0];
          const desc = buffer.join(' ').trim();
          rows.push({ date: currentDate, description: desc, amount: parseLocaleNumber(amtStr) });
          buffer = [];
          currentDate = null;
        } else {
          buffer.push(tok);
        }
      }
      if (currentDate && buffer.length) {
        const joined = buffer.join(' ');
        const amtMatch = joined.match(amountRe);
        if (amtMatch) {
          const amtStr = amtMatch[0];
          const desc = joined.replace(amtStr, '').trim();
          rows.push({ date: currentDate, description: desc, amount: parseLocaleNumber(amtStr) });
        }
      }
    }
    if ((!rows || rows.length === 0) && window.BankExtractManager && typeof window.BankExtractManager.extractTransactionsFromText === 'function') {
      const text = textParts.join('\n');
      const fallback = window.BankExtractManager.extractTransactionsFromText(text, 'Genérico', new Date().toISOString().slice(0,10)) || [];
      return fallback.map(r => ({ date: r.date, description: r.description, amount: r.amount }));
    }
    return rows;
  }

  window.robustParsePDFStatement = robustParsePDFStatement;
})();