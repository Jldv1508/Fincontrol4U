// ocr.js - Stub mínimo para OCRManager cuando el módulo real no está disponible
(function(){
  const OCRManager = {
    state: { isInitialized: false },
    async init() {
      this.state.isInitialized = true;
      if (typeof window.showNotification === 'function') {
        showNotification('OCR inicializado (stub)', 'info');
      }
      return true;
    },
    showScanInterface() {
      if (typeof window.showNotification === 'function') {
        showNotification('Interfaz OCR no disponible en esta instalación', 'warning');
      } else if (window.UIManager) {
        UIManager.showToast('Interfaz OCR no disponible', 'warning');
      }
    },
    processUploadedImage(file) {
      if (typeof window.showNotification === 'function') {
        showNotification('Procesamiento OCR no disponible', 'error');
      } else if (window.UIManager) {
        UIManager.showToast('Procesamiento OCR no disponible', 'error');
      }
    }
  };
  window.OCRManager = OCRManager;
})();