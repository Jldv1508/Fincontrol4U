// Fallback sencillo de modal si la implementación de UI no está disponible
(function(){
  if (typeof window.showModal !== 'function') {
    window.showModal = function({ title, content, size = 'medium', buttons = [], onOpen }) {
      const overlay = document.createElement('div');
      overlay.className = 'modal';
      const modal = document.createElement('div');
      modal.className = 'modal-content';
      modal.innerHTML = `
        <div class="modal-header">
          <h3>${title || ''}</h3>
          <button class="close-modal">×</button>
        </div>
        <div class="modal-body">${content || ''}</div>
        <div class="form-actions">
          ${buttons.map((b, i) => `<button class="btn ${b.type === 'primary' ? 'btn-primary' : ''}" data-i="${i}">${b.text}</button>`).join('')}
        </div>
      `;
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      overlay.style.display = 'flex';
      const closeBtn = modal.querySelector('.close-modal');
      closeBtn.addEventListener('click', () => window.closeModal());
      modal.querySelectorAll('.form-actions .btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = Number(e.currentTarget.getAttribute('data-i'));
          const def = buttons[idx];
          if (def && typeof def.onClick === 'function') def.onClick();
        });
      });
      if (typeof onOpen === 'function') onOpen();
    };
  }
  if (typeof window.closeModal !== 'function') {
    window.closeModal = function() {
      const overlay = document.querySelector('.modal');
      if (overlay) overlay.remove();
    };
  }
})();