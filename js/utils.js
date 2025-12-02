/**
 * ===========================================
 * FUNCIONES UTILITARIAS
 * ===========================================
 */

// Mostrar/ocultar error
function showError(message) {
    const errorDiv = document.getElementById('errorMsg');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.add('show');
    }
}

function hideError() {
    const errorDiv = document.getElementById('errorMsg');
    if (errorDiv) {
        errorDiv.classList.remove('show');
    }
}

// Verificar permiso
function checkPermission(permisos, permissionPath) {
    if (userData.rol === 'dueno') return true;
    
    const parts = permissionPath.split('.');
    let current = permisos;
    
    for (const part of parts) {
        if (!current || !current[part]) return false;
        current = current[part];
    }
    
    return current === true;
}

// Formatear moneda
function formatearMoneda(valor) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
    }).format(valor);
}

// Formatear fecha corta
function formatearFechaCorto(fechaStr) {
    if (!fechaStr) return '';
    
    let fecha;
    if (fechaStr.includes('T')) {
        fecha = new Date(fechaStr);
    } else {
        fecha = new Date(fechaStr + 'T00:00:00');
    }

    if (isNaN(fecha.getTime())) return '-';
    return `${fecha.getDate()}/${fecha.getMonth()+1}`;
}

// Toggle unidad personalizada en compras
function toggleUnidadCompraPersonalizada() {
    const select = document.getElementById('unidadCompra');
    const campoPersonalizado = document.getElementById('campoUnidadPersonalizada');
    const inputPersonalizado = document.getElementById('unidadCompraPersonalizada');
    
    if (select && campoPersonalizado) {
        if (select.value === 'OTRA') {
            campoPersonalizado.style.display = 'block';
            inputPersonalizado.required = true;
        } else {
            campoPersonalizado.style.display = 'none';
            inputPersonalizado.required = false;
            inputPersonalizado.value = '';
        }
    }
}
