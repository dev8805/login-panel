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
    return `${fecha.getDate()}/${fecha.getMonth() + 1}`;
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

// ============================================
// FUNCIONES DE ZONA HORARIA
// ============================================

/**
 * Obtener fecha actual en zona horaria del tenant (formato YYYY-MM-DD)
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
function getFechaTenant() {
    const tz = userData?.zona_horaria || 'America/Bogota';
    return new Date().toLocaleDateString('en-CA', { timeZone: tz });
}

/**
 * Obtener timestamp ISO ajustado a zona horaria del tenant
 * Esto crea un timestamp que representa la hora actual en la zona del tenant
 * @returns {string} Timestamp en formato ISO
 */
function getTimestampTenant() {
    const tz = userData?.zona_horaria || 'America/Bogota';
    // Usar formato sueco (sv-SE) que da YYYY-MM-DD HH:mm:ss
    const fechaLocal = new Date().toLocaleString('sv-SE', { timeZone: tz, hour12: false });
    // Convertir a ISO: reemplazar espacio con T y agregar milisegundos
    return fechaLocal.replace(' ', 'T') + '.000';
}

/**
 * Formatear fecha para mostrar al usuario
 * @param {string} fechaISO - Fecha en formato ISO
 * @param {object} opciones - Opciones adicionales para toLocaleString
 * @returns {string} Fecha formateada
 */
function formatearFechaTenant(fechaISO, opciones = {}) {
    const tz = userData?.zona_horaria || 'America/Bogota';
    const defaults = { timeZone: tz, ...opciones };
    return new Date(fechaISO).toLocaleString('es-CO', defaults);
}

/**
 * Convertir rango de fechas locales (YYYY-MM-DD) a ISO timestamps para consultas
 * Esto asegura que los filtros de fecha cubran todo el día en la zona horaria del tenant
 * @param {string} fechaInicio - Fecha de inicio en formato YYYY-MM-DD
 * @param {string} fechaFin - Fecha de fin en formato YYYY-MM-DD
 * @returns {object} Objeto con inicioISO y finISO
 */
function getRangoUTC(fechaInicio, fechaFin) {
    const tz = userData?.zona_horaria || 'America/Bogota';

    // Crear fechas en la zona horaria del tenant usando toLocaleString
    // Esto nos da la medianoche en la zona del tenant
    const opcionesInicio = { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    const opcionesFin = { ...opcionesInicio };

    // Parsear las fechas de entrada
    const [yearI, monthI, dayI] = fechaInicio.split('-').map(Number);
    const [yearF, monthF, dayF] = fechaFin.split('-').map(Number);

    // Crear objetos Date y obtener su representación en la zona del tenant
    const inicio = new Date(yearI, monthI - 1, dayI, 0, 0, 0);
    const fin = new Date(yearF, monthF - 1, dayF, 23, 59, 59);

    return {
        inicioISO: inicio.toISOString(),
        finISO: fin.toISOString()
    };
}
