/**
 * notifications.js - Sistema de notificaciones y modales
 * Maneja la visualización de notificaciones, alertas y modales en la aplicación
 */

// Tipos de notificaciones
const NOTIFICATION_TYPES = {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
};

// Duración predeterminada de notificaciones (ms)
const DEFAULT_NOTIFICATION_DURATION = 3000;

// Contenedor de notificaciones
let notificationsContainer;

// Inicializar sistema de notificaciones
function initNotifications() {
    // Crear contenedor si no existe
    if (!notificationsContainer) {
        notificationsContainer = document.createElement('div');
        notificationsContainer.className = 'notifications-container';
        document.body.appendChild(notificationsContainer);
    }
    
    // Registrar service worker para notificaciones push si está soportado
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        registerPushNotifications();
    }
}

// Mostrar notificación en la interfaz
function showNotification(message, type = NOTIFICATION_TYPES.INFO, duration = DEFAULT_NOTIFICATION_DURATION) {
    // Asegurar que el contenedor existe
    if (!notificationsContainer) {
        initNotifications();
    }
    
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    // Icono según tipo
    let icon;
    switch (type) {
        case NOTIFICATION_TYPES.SUCCESS:
            icon = 'fa-check-circle';
            break;
        case NOTIFICATION_TYPES.ERROR:
            icon = 'fa-exclamation-circle';
            break;
        case NOTIFICATION_TYPES.WARNING:
            icon = 'fa-exclamation-triangle';
            break;
        default:
            icon = 'fa-info-circle';
    }
    
    // Contenido de la notificación
    notification.innerHTML = `
        <div class="notification-icon">
            <i class="fas ${icon}"></i>
        </div>
        <div class="notification-content">
            <p>${message}</p>
        </div>
        <button class="notification-close">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Añadir al contenedor
    notificationsContainer.appendChild(notification);
    
    // Mostrar con animación
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Configurar botón de cierre
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        closeNotification(notification);
    });
    
    // Auto-cerrar después de la duración especificada
    if (duration > 0) {
        setTimeout(() => {
            closeNotification(notification);
        }, duration);
    }
    
    return notification;
}

// Cerrar notificación
function closeNotification(notification) {
    // Quitar clase show para animar salida
    notification.classList.remove('show');
    
    // Eliminar del DOM después de la animación
    setTimeout(() => {
        if (notification.parentElement) {
            notification.parentElement.removeChild(notification);
        }
    }, 300);
}

// Mostrar modal genérico
function showModal(options = {}) {
    const {
        title = '',
        content = '',
        size = 'medium', // small, medium, large, fullscreen
        closable = true,
        buttons = [],
        onClose = null
    } = options;
    
    // Crear elemento modal
    const modal = document.createElement('div');
    modal.className = `modal modal-${size}`;
    
    // Contenido del modal
    modal.innerHTML = `
        <div class="modal-content">
            ${title ? `
                <div class="modal-header">
                    <h3>${title}</h3>
                    ${closable ? '<button class="close-btn">&times;</button>' : ''}
                </div>
            ` : ''}
            <div class="modal-body">
                ${content}
            </div>
            ${buttons.length > 0 ? `
                <div class="modal-footer">
                    ${buttons.map(btn => `
                        <button class="btn ${btn.class || 'btn-outline'}" data-action="${btn.action || ''}">
                            ${btn.icon ? `<i class="fas ${btn.icon}"></i> ` : ''}${btn.text}
                        </button>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `;
    
    // Añadir al DOM
    document.body.appendChild(modal);
    
    // Mostrar con animación
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
    
    // Configurar eventos
    
    // Botón de cierre
    if (closable) {
        const closeBtn = modal.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                closeModal(modal, onClose);
            });
        }
        
        // Cerrar al hacer clic fuera del contenido
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal, onClose);
            }
        });
        
        // Cerrar con tecla Escape
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeModal(modal, onClose);
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }
    
    // Configurar botones
    buttons.forEach((btn, index) => {
        const buttonElement = modal.querySelectorAll('.modal-footer .btn')[index];
        if (buttonElement && btn.onClick) {
            buttonElement.addEventListener('click', (e) => {
                btn.onClick(e, modal);
            });
        }
    });
    
    return modal;
}

// Cerrar modal (compatibilidad: permite ser llamado sin parámetro)
function closeModal(modalOrCallback, maybeCallback = null) {
    let modal = null;
    let callback = null;
    // Detectar si el primer argumento es el modal o el callback
    if (modalOrCallback && typeof modalOrCallback.classList === 'object') {
        modal = modalOrCallback;
        callback = maybeCallback;
    } else {
        // Buscar el último modal abierto si no se pasó referencia
        modal = document.querySelector('.modal.show') || document.querySelector('.modal');
        callback = typeof modalOrCallback === 'function' ? modalOrCallback : null;
    }
    if (!modal) return;
    // Quitar clase show para animar salida
    modal.classList.remove('show');
    
    // Eliminar del DOM después de la animación
    setTimeout(() => {
        if (modal.parentElement) {
            modal.parentElement.removeChild(modal);
            
            // Ejecutar callback si existe
            if (typeof callback === 'function') {
                callback();
            }
        }
    }, 300);
}

// Mostrar modal de confirmación
function showConfirmModal(title, message, onConfirm, onCancel = null) {
    return showModal({
        title,
        content: `<p>${message}</p>`,
        buttons: [
            {
                text: 'Cancelar',
                class: 'btn-outline',
                action: 'cancel',
                onClick: (e, modal) => {
                    closeModal(modal, onCancel);
                }
            },
            {
                text: 'Confirmar',
                class: 'btn-primary',
                action: 'confirm',
                onClick: (e, modal) => {
                    closeModal(modal, onConfirm);
                }
            }
        ]
    });
}

// Mostrar modal de alerta
function showAlertModal(title, message, onClose = null) {
    return showModal({
        title,
        content: `<p>${message}</p>`,
        buttons: [
            {
                text: 'Aceptar',
                class: 'btn-primary',
                action: 'ok',
                onClick: (e, modal) => {
                    closeModal(modal, onClose);
                }
            }
        ]
    });
}

// Mostrar modal de formulario
function showFormModal(title, formContent, onSubmit, onCancel = null) {
    const modal = showModal({
        title,
        content: `
            <form id="modalForm">
                ${formContent}
            </form>
        `,
        buttons: [
            {
                text: 'Cancelar',
                class: 'btn-outline',
                action: 'cancel',
                onClick: (e, modal) => {
                    closeModal(modal, onCancel);
                }
            },
            {
                text: 'Guardar',
                class: 'btn-primary',
                action: 'submit',
                onClick: (e, modal) => {
                    const form = modal.querySelector('#modalForm');
                    
                    // Validar formulario
                    if (form.checkValidity()) {
                        // Recoger datos del formulario
                        const formData = new FormData(form);
                        const data = {};
                        
                        for (const [key, value] of formData.entries()) {
                            data[key] = value;
                        }
                        
                        // Cerrar modal y ejecutar callback
                        closeModal(modal, () => {
                            if (typeof onSubmit === 'function') {
                                onSubmit(data);
                            }
                        });
                    } else {
                        // Mostrar validación
                        form.reportValidity();
                    }
                }
            }
        ]
    });
    
    return modal;
}

// Mostrar notificación push
function showPushNotification(title, options = {}) {
    // Verificar soporte
    if (!('Notification' in window)) {
        console.warn('Este navegador no soporta notificaciones de escritorio');
        return;
    }
    
    // Verificar permiso
    if (Notification.permission === 'granted') {
        // Crear y mostrar notificación
        const notification = new Notification(title, options);
        
        // Configurar eventos
        if (options.onClick) {
            notification.onclick = options.onClick;
        }
        
        return notification;
    } else if (Notification.permission !== 'denied') {
        // Solicitar permiso
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                showPushNotification(title, options);
            }
        });
    }
}

// Registrar para notificaciones push
async function registerPushNotifications() {
    try {
        // Registrar service worker si no está registrado
        const registration = await navigator.serviceWorker.ready;
        
        // Verificar suscripción existente
        const subscription = await registration.pushManager.getSubscription();
        
        if (!subscription) {
            // Solicitar permiso
            const permission = await Notification.requestPermission();
            
            if (permission === 'granted') {
                // Crear suscripción
                // Nota: En una implementación real, aquí se generaría una clave pública
                // desde el servidor para la suscripción
                console.log('Permiso concedido para notificaciones push');
            }
        }
    } catch (error) {
        console.error('Error al registrar notificaciones push:', error);
    }
}

// Exportar funciones
window.initNotifications = initNotifications;
window.showNotification = showNotification;
window.showModal = showModal;
window.closeModal = closeModal;
window.showConfirmModal = showConfirmModal;
window.showAlertModal = showAlertModal;
window.showFormModal = showFormModal;
window.showPushNotification = showPushNotification;