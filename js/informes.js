/**
 * ===========================================
 * INFORMES Y ESTADÍSTICAS
 * ===========================================
 */

let datosInformes = null;
let rangoFechaInformes = 'today';
// Nueva variable para controlar el estado visual del botón
let filtroSeleccionado = 'diario'; 

// Función principal llamada desde el menú
async function cargarInformes(modalBody) {
    // Resetear filtro visual al abrir
    filtroSeleccionado = 'diario';
    
    // Mostrar loading inicial
    modalBody.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <p style="font-size: 18px; color: #667eea;">📊 Cargando datos del informe...</p>
        </div>
    `;
    try {
        // Obtener fechas por defecto (hoy)
        const hoy = new Date();
        const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        
        // Formato YYYY-MM-DD
        const fechaInicio = primerDiaMes.toLocaleDateString('en-CA'); // Formato seguro ISO
        const fechaFin = hoy.toLocaleDateString('en-CA');
        
        // Cargar datos reales
        const datosReales = await cargarDatosRealesInforme(fechaInicio, fechaFin);
        
        // Renderizar el informe con datos reales
        renderizarInformeConDatos(modalBody, datosReales, fechaInicio, fechaFin);
    } catch (error) {
        console.error('❌ Error cargando informe:', error);
        modalBody.innerHTML = `
            <div style="background: #f8d7da; border: 2px solid #dc3545; border-radius: 8px; padding: 20px; margin: 20px;">
                <strong>❌ Error:</strong> No se pudo cargar el informe.
                <br><small>${error.message}</small>
            </div>
        `;
    }
}

// Función para cargar datos reales de Supabase
async function cargarDatosRealesInforme(fechaInicio, fechaFin) {
    console.log('📊 Cargando datos reales...', { fechaInicio, fechaFin, tenant_id: userData.tenant_id });
    const fechaInicioISO = new Date(fechaInicio + 'T00:00:00').toISOString();
    const fechaFinISO = new Date(fechaFin + 'T23:59:59').toISOString();
    
    // 1. CARGAR VENTAS
    const { data: ventas, error: errorVentas } = await supabase
        .from('ventas')
        .select('total, created_at')
        .eq('tenant_id', userData.tenant_id)
        .eq('activo', true)
        .gte('created_at', fechaInicioISO)
        .lte('created_at', fechaFinISO);
    
    if (errorVentas) throw new Error('Error cargando ventas: ' + errorVentas.message);
    
    // 2. CARGAR MOVIMIENTOS (Compras, Mermas, Consumos)
    const { data: movimientos, error: errorMovimientos } = await supabase
        .from('movimientos_inventario')
        .select('codigo, costo_total, costo_unitario, cantidad, razon, created_at, productos(producto, unidad_compra)')
        .eq('tenant_id', userData.tenant_id)
        .eq('activo', true)
        .gte('created_at', fechaInicioISO)
        .lte('created_at', fechaFinISO);
    
    if (errorMovimientos) throw new Error('Error cargando movimientos: ' + errorMovimientos.message);
    
    // 3. CARGAR GASTOS
    const { data: gastos, error: errorGastos } = await supabase
        .from('gastos')
        .select('monto, concepto, tipo_gasto, created_at')
        .eq('tenant_id', userData.tenant_id)
        .eq('activo', true)
        .is('deleted_at', null)
        .gte('created_at', fechaInicioISO)
        .lte('created_at', fechaFinISO);
    
    if (errorGastos) throw new Error('Error cargando gastos: ' + errorGastos.message);
    
    // CALCULAR TOTALES
    const totalVentas = ventas.reduce((sum, v) => sum + parseFloat(v.total || 0), 0);
    
    const mermas = movimientos.filter(m => m.codigo && m.codigo.startsWith('M'));
    const consumos = movimientos.filter(m => m.codigo && m.codigo.startsWith('C'));
    const compras = movimientos.filter(m => m.codigo && m.codigo.startsWith('E'));

    const calcularCosto = (items) => items.reduce((sum, m) => {
        const total = parseFloat(m.costo_total || 0);
        return sum + (total > 0 ? total : (parseFloat(m.cantidad || 0) * parseFloat(m.costo_unitario || 0)));
    }, 0);
    
    const totalMermas = calcularCosto(mermas);
    const totalConsumos = calcularCosto(consumos);
    const totalCompras = calcularCosto(compras);
    
    // Filtrar y sumar gastos
    const filterGastos = (tipo) => gastos.filter(g => g.tipo_gasto === tipo);
    const sumGastos = (items) => items.reduce((sum, g) => sum + parseFloat(g.monto || 0), 0);

    const gastosServicios = filterGastos('servicios');
    const gastosNomina = filterGastos('nomina');
    const gastosAlimentacion = filterGastos('alimentacion');
    const gastosViaje = filterGastos('viaje');
    const gastosDeuda = filterGastos('deuda');
    const gastosEntretenimiento = filterGastos('entretenimiento');
    const gastosVariable = filterGastos('variable');

    const totalServicios = sumGastos(gastosServicios);
    const totalNomina = sumGastos(gastosNomina);
    const totalAlimentacion = sumGastos(gastosAlimentacion);
    const totalViaje = sumGastos(gastosViaje);
    const totalDeuda = sumGastos(gastosDeuda);
    const totalEntretenimiento = sumGastos(gastosEntretenimiento);
    const totalVariable = sumGastos(gastosVariable);
    
    const gastosOperacionales = totalCompras + totalServicios + totalNomina + totalConsumos;
    const gastosPersonalesExternos = totalAlimentacion + totalViaje + totalDeuda + totalEntretenimiento + totalVariable;
    const gastosTotales = gastosOperacionales + gastosPersonalesExternos + totalMermas;
    
    const utilidadNeta = totalVentas - gastosTotales;
    const margenGanancia = totalVentas > 0 ? ((utilidadNeta / totalVentas) * 100).toFixed(1) : 0;
    
    return {
        totalVentas,
        totalCompras, totalServicios, totalNomina, totalConsumos,
        gastosOperacionales,
        totalAlimentacion, totalViaje, totalDeuda, totalEntretenimiento, totalVariable,
        gastosPersonalesExternos,
        totalMermas,
        gastosTotales,
        utilidadNeta,
        margenGanancia,
        cantidadVentas: ventas.length,
        // LISTAS PARA DETALLES
        listaCompras: compras,
        listaServicios: gastosServicios,
        listaNomina: gastosNomina,
        listaConsumos: consumos,
        listaAlimentacion: gastosAlimentacion,
        listaViaje: gastosViaje,
        listaDeuda: gastosDeuda,
        listaEntretenimiento: gastosEntretenimiento,
        listaVariable: gastosVariable,
        listaMermas: mermas
    };
}

// Función para renderizar el informe (CON DISEÑO GRID DARK TECH)
function renderizarInformeConDatos(modalBody, datos, fechaInicio, fechaFin) {
    
    const formatearMoneda = (valor) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(valor);
    };

    const formatearFechaCorto = (fechaStr) => {
        if (!fechaStr) return '';
        let fecha;
        if (fechaStr.includes('T')) {
            fecha = new Date(fechaStr);
        } else {
            fecha = new Date(fechaStr + 'T00:00:00');
        }

        if (isNaN(fecha.getTime())) return '-';
        return `${fecha.getDate()}/${fecha.getMonth()+1}`;
    };
    
    // --- FUNCIONES GLOBALES PARA INTERACTIVIDAD ---
    
    // 1. Recarga
    window.recargarInformeInterno = async function() {
        const iVal = document.getElementById('fechaInicioInforme').value;
        const fVal = document.getElementById('fechaFinInforme').value;
        const modalBodyRef = document.getElementById('modalBodyInformes');
        
        if (!iVal || !fVal) return;
        
        const contentDiv = document.querySelector('.report-content');
        if(contentDiv) contentDiv.style.opacity = '0.5';
        const btnText = document.getElementById('rango-fechas-label');
        if(btnText) btnText.textContent = 'Cargando...';
        
        try {
            const nuevosDatos = await cargarDatosRealesInforme(iVal, fVal);
            renderizarInformeConDatos(modalBodyRef, nuevosDatos, iVal, fVal);
        } catch (e) {
            console.error('Error al recargar:', e);
            if(contentDiv) contentDiv.style.opacity = '1';
        }
    };

    // 2. Aplicar Filtros (Lógica de Chips)
    window.aplicarFiltroFecha = function(tipo) {
        // Actualizar variable global ANTES de renderizar
        filtroSeleccionado = tipo;

        const hoy = new Date();
        let inicio = new Date();
        let fin = new Date();
        
        // La actualización visual de .active ya no es necesaria aquí manualmente
        // porque se manejará al renderizar todo el HTML de nuevo.
        // Pero para feedback instantáneo si hay latencia, podemos dejarlo:
        document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
        const chip = document.getElementById('chip-' + tipo);
        if(chip) chip.classList.add('active');

        const calContainer = document.getElementById('custom-calendar-container');
        
        if (tipo === 'diario') {
            // Hoy por defecto
        } else if (tipo === 'semanal') {
            const diaSemana = hoy.getDay() || 7; 
            inicio.setDate(hoy.getDate() - diaSemana + 1); 
            fin = new Date();
        } else if (tipo === 'mensual') {
            inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
            fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
        } else if (tipo === 'anual') {
            inicio = new Date(hoy.getFullYear(), 0, 1);
            fin = new Date(hoy.getFullYear(), 11, 31);
        } else if (tipo === 'personalizado') {
            if (calContainer) {
                calContainer.style.display = 'block';
                window.renderizarCalendarioVertical();
            }
            return;
        }

        if (calContainer) calContainer.style.display = 'none';
        window.actualizarInputsYRefrescar(inicio, fin);
    };

    // 3. Actualizar Inputs y Refrescar
    window.actualizarInputsYRefrescar = function(inicio, fin) {
        // Ajuste de zona horaria básico para inputs fecha
        const offset = inicio.getTimezoneOffset();
        const fInicio = new Date(inicio.getTime() - (offset*60*1000)).toISOString().split('T')[0];
        const fFin = new Date(fin.getTime() - (offset*60*1000)).toISOString().split('T')[0];

        const inputInicio = document.getElementById('fechaInicioInforme');
        const inputFin = document.getElementById('fechaFinInforme');
        if(inputInicio) inputInicio.value = fInicio;
        if(inputFin) inputFin.value = fFin;
        
        const opciones = { month: 'short', day: 'numeric' };
        const textoRango = `${inicio.toLocaleDateString('es-CO', opciones)} - ${fin.toLocaleDateString('es-CO', opciones)}`;
        const label = document.getElementById('rango-fechas-label');
        if(label) label.textContent = textoRango;

        setTimeout(() => {
            window.recargarInformeInterno();
        }, 50);
    };

    // 4. Calendario Vertical
    window.rangoSeleccion = { inicio: null, fin: null };
    
    window.renderizarCalendarioVertical = function() {
        const container = document.getElementById('calendar-scroll-area');
        if (!container || container.innerHTML !== '') return;

        const hoy = new Date();
        const mesesAtras = 12; 
        const mesesAdelante = 1;
        let html = '';
        
        for (let i = -mesesAtras; i <= mesesAdelante; i++) {
            const fechaMes = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
            const mesNombre = fechaMes.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
            const diasEnMes = new Date(hoy.getFullYear(), hoy.getMonth() + i + 1, 0).getDate();
            const diaSemanaInicio = (fechaMes.getDay() + 6) % 7; // Lunes = 0
            
            let diasHTML = '';
            for (let j = 0; j < diaSemanaInicio; j++) diasHTML += `<div class="cal-day empty"></div>`;
            
            for (let dia = 1; dia <= diasEnMes; dia++) {
                const fechaDia = new Date(fechaMes.getFullYear(), fechaMes.getMonth(), dia);
                // Truco para evitar problemas de zona horaria al convertir a string
                const fechaStr = new Date(fechaDia.getTime() - (fechaDia.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                
                diasHTML += `<div class="cal-day" onclick="window.seleccionarDia('${fechaStr}', this)" data-date="${fechaStr}">${dia}</div>`;
            }

            html += `
                <div class="cal-month">
                    <div class="cal-month-title">${mesNombre}</div>
                    <div class="cal-days-grid">
                        <div class="cal-day-header">L</div><div class="cal-day-header">M</div><div class="cal-day-header">M</div><div class="cal-day-header">J</div><div class="cal-day-header">V</div><div class="cal-day-header">S</div><div class="cal-day-header">D</div>
                        ${diasHTML}
                    </div>
                </div>
            `;
        }
        container.innerHTML = html;
        setTimeout(() => { container.scrollTop = container.scrollHeight * 0.9; }, 100);
    };

    window.seleccionarDia = function(fechaStr, elemento) {
        const fecha = new Date(fechaStr + 'T00:00:00');
        
        if (!window.rangoSeleccion.inicio || (window.rangoSeleccion.inicio && window.rangoSeleccion.fin)) {
            // Nueva selección (inicio)
            window.rangoSeleccion.inicio = fecha;
            window.rangoSeleccion.fin = null;
            
            document.querySelectorAll('.cal-day').forEach(el => {
                el.classList.remove('selected-start', 'selected-end', 'in-range');
            });
            elemento.classList.add('selected-start');
            
        } else {
            // Selección final
            if (fecha < window.rangoSeleccion.inicio) {
                window.rangoSeleccion.inicio = fecha;
                document.querySelectorAll('.cal-day').forEach(el => el.classList.remove('selected-start'));
                elemento.classList.add('selected-start');
            } else {
                window.rangoSeleccion.fin = fecha;
                elemento.classList.add('selected-end');
                window.resaltarRangoVisual();
                
                window.actualizarInputsYRefrescar(window.rangoSeleccion.inicio, window.rangoSeleccion.fin);
                
                setTimeout(() => {
                    const cal = document.getElementById('custom-calendar-container');
                    if(cal) cal.style.display = 'none';
                }, 800);
            }
        }
    };

    window.resaltarRangoVisual = function() {
        if (!window.rangoSeleccion.inicio || !window.rangoSeleccion.fin) return;
        // Ajuste zona horaria para comparación strings
        const offset = window.rangoSeleccion.inicio.getTimezoneOffset() * 60000;
        const inicio = new Date(window.rangoSeleccion.inicio.getTime() - offset).toISOString().split('T')[0];
        const fin = new Date(window.rangoSeleccion.fin.getTime() - offset).toISOString().split('T')[0];

        document.querySelectorAll('.cal-day[data-date]').forEach(el => {
            const fechaEl = el.getAttribute('data-date');
            if (fechaEl > inicio && fechaEl < fin) {
                el.classList.add('in-range');
            }
        });
    };

    // 5. Toggle de Secciones
    window.toggleSection = function(id) { /* ... (opcional, si se usa) ... */ };
    
    window.toggleSubSection = function(id) {
        const content = document.getElementById('sub-' + id);
        const btn = document.getElementById('btn-sub-' + id);
        if (content && btn) {
            const isVisible = content.style.display === 'block';
            content.style.display = isVisible ? 'none' : 'block';
            btn.textContent = isVisible ? 'Ver' : 'Ocultar';
            if (!isVisible) btn.classList.add('active'); else btn.classList.remove('active');
        }
    };

    // Helper para renderizar items
    const renderListaItems = (items, tipo) => {
        if (!items || items.length === 0) return '<div class="empty-list">No hay registros detallados</div>';
        return items.map(item => {
            let nombreProducto = '';
            let cantidadStr = '';
            let valor = 0;
            
            const fecha = formatearFechaCorto(item.created_at);
            
            if (tipo === 'compra' || tipo === 'consumo' || tipo === 'merma') {
                if (item.productos && item.productos.producto) {
                    nombreProducto = item.productos.producto;
                } else if (item.razon) {
                    nombreProducto = item.razon.replace(/Entrada de\s*/i, '').trim();
                    nombreProducto = nombreProducto.replace(/^\d+\s*\w+\s+/, ''); 
                    nombreProducto = nombreProducto.charAt(0).toUpperCase() + nombreProducto.slice(1);
                } else {
                    nombreProducto = `[${item.codigo}] Item`;
                }
                const cantidadNum = parseFloat(item.cantidad || 0);
                let unidad = item.productos?.unidad_compra || '';
                if (unidad.toUpperCase() === 'UNIDADES' || unidad.toUpperCase() === 'UNIDAD') unidad = 'UND';
                if (unidad.toUpperCase() === 'LIBRAS') unidad = 'LBS';
                if (unidad.toUpperCase() === 'KILOGRAMOS') unidad = 'KG';
                if (cantidadNum > 0) cantidadStr = `${cantidadNum} ${unidad}`.trim();
                valor = parseFloat(item.costo_total || 0);
                if (valor === 0 && item.cantidad && item.costo_unitario) {
                    valor = parseFloat(item.cantidad) * parseFloat(item.costo_unitario);
                }
            } else {
                nombreProducto = item.concepto || 'Gasto vario';
                valor = parseFloat(item.monto || 0);
                cantidadStr = '-';
            }
            return `<div class="sub-item-row"><span class="sub-item-date">${fecha}</span>${cantidadStr && cantidadStr !== '-' ?
                `<span class="sub-item-qty">${cantidadStr}</span>` : ''}<span class="sub-item-desc" title="${nombreProducto}">${nombreProducto}</span><span class="sub-item-val">${formatearMoneda(valor)}</span></div>`;
        }).join('');
    };

    // --- HTML PRINCIPAL ---
    modalBody.innerHTML = `
    <style>
        .report-header-modern { background: #0f172a; padding: 16px; color: white; border-bottom: 1px solid #1e293b; }
        
        /* --- ESTILO OPCIÓN 2: DARK TECH (GRILLA) --- */
        .filters-container { 
            display: grid; 
            grid-template-columns: repeat(6, 1fr);
            gap: 10px; 
            padding-bottom: 15px; 
        }

        .filter-chip { 
            background: #1e293b; /* Fondo sólido oscuro */
            border: 1px solid #334155; 
            color: #94a3b8; 
            padding: 10px 4px; 
            border-radius: 8px; 
            font-size: 11px; 
            font-weight: 500; 
            cursor: pointer; 
            white-space: nowrap; 
            transition: all 0.2s;
            text-align: center;
            box-shadow: 0 2px 0 rgba(0,0,0,0.2); /* Sombra dura */
            grid-column: span 2; 
        }

        .filter-chip:nth-last-child(1), 
        .filter-chip:nth-last-child(2) {
            grid-column: span 3; 
        }

        .filter-chip:hover { background: #334155; color: white; }
        
        .filter-chip.active { 
            background: #3b82f6; /* Azul vibrante */
            border-color: #60a5fa; 
            color: white; 
            box-shadow: 0 0 15px rgba(59, 130, 246, 0.4); /* Resplandor */
            font-weight: 700;
        }
        /* ----------------------------------------- */

        .action-bar { display: flex; justify-content: center; align-items: center; margin-top: 12px; padding-top: 12px; border-top: 1px dashed #334155; }
        .date-range-display { font-size: 14px; font-weight: 700; color: #e2e8f0; display: flex; align-items: center; gap: 6px; }
        .custom-calendar-container { display: none; background: #1e293b; margin-top: 12px; border-radius: 8px; overflow: hidden; border: 1px solid #334155; animation: slideDown 0.3s ease; }
        .calendar-scroll-area { max-height: 320px; overflow-y: auto; padding: 10px; }
        .cal-month { margin-bottom: 20px; }
        .cal-month-title { color: #94a3b8; font-size: 13px; font-weight: 700; text-transform: capitalize; margin-bottom: 10px; text-align: center; position: sticky; top: 0; background: #1e293b; padding: 5px 0; }
        .cal-days-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center; }
        .cal-day-header { color: #64748b; font-size: 10px; font-weight: 600; margin-bottom: 4px; }
        .cal-day { aspect-ratio: 1/1; display: flex; align-items: center; justify-content: center; font-size: 13px; color: #e2e8f0; border-radius: 50%; cursor: pointer; transition: all 0.1s; }
        .cal-day:not(.empty):hover { background: #334155; }
        .cal-day.empty { pointer-events: none; }
        .cal-day.selected-start { background: #3b82f6; color: white; font-weight: 700; }
        .cal-day.selected-end { background: #3b82f6; color: white; font-weight: 700; }
        .cal-day.in-range { background: #3b82f640; border-radius: 0; }
        .cal-day.selected-start { border-top-right-radius: 0; border-bottom-right-radius: 0; }
        .cal-day.selected-end { border-top-left-radius: 0; border-bottom-left-radius: 0; }
        .hidden-inputs { display: none; }
        .report-content { padding: 16px; max-width: 800px; margin: 0 auto; }
        .stat-card { background: white; border-radius: 8px; padding: 14px 16px; margin-bottom: 10px; border-left-width: 4px; border-left-style: solid; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .stat-card.ventas { border-left-color: #10b981; }
        .stat-card.utilidad { border-left-color: #3b82f6; }
        .stat-card.gastos { border-left-color: #ef4444; }
        .stat-label { font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 4px; letter-spacing: 0.5px; }
        .stat-value { font-size: 26px; font-weight: 500; color: #0f172a; letter-spacing: -0.5px; line-height: 1.2; }
        .stat-sub { font-size: 11px; color: #64748b; margin-top: 6px; display: flex; align-items: center; gap: 6px; }
        .badge-pill { padding: 2px 8px; border-radius: 4px; font-weight: 500; font-size: 11px; }
        .detail-card { background: white; border-radius: 12px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
        .section-header { font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid #f1f5f9; display: flex; align-items: center; gap: 8px; justify-content: space-between; }
        .section-title { font-size: 13px; }
        .bar-indicator { width: 4px; height: 16px; display: block; border-radius: 2px; }
        .row-group { margin-bottom: 0; border-bottom: 1px solid #f8fafc; }
        .row-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; }
        .row-label { color: #64748b; font-weight: 500; font-size: 13px; }
        .row-value { font-weight: 600; color: #334155; font-size: 13px; }
        .btn-ver-detalle { font-size: 10px; color: #3b82f6; cursor: pointer; background: #eff6ff; padding: 3px 8px; border-radius: 12px; border: 1px solid #dbeafe; font-weight: 600; transition: all 0.2s; }
        .btn-ver-detalle.active { background: #f1f5f9; color: #64748b; border-color: #e2e8f0; }
        .sub-list { display: none; background: #f8fafc; padding: 8px 0; margin-bottom: 12px; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; animation: fadeIn 0.2s ease-out; }
        .sub-item-row { display: grid; grid-template-columns: 35px auto 1fr auto; gap: 6px; align-items: center; font-size: 11px; padding: 8px 4px; border-bottom: 1px solid #e2e8f0; color: #475569; }
        .sub-item-qty { background: #dbeafe; color: #1e40af; padding: 1px 4px; border-radius: 4px; font-weight: 700; font-size: 10px; white-space: nowrap; text-align: center; }
        .sub-item-desc { font-weight: 500; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sub-item-val { font-weight: 600; color: #64748b; text-align: right; }
        .total-box { padding: 10px; border-radius: 6px; margin-top: 10px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; background: #f8fafc; }
        .total-box span { font-size: 12px; } .total-box strong { font-size: 14px; }
        .balance-card { background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-top: 20px; }
        .balance-final-title { font-size: 14px; font-weight: 700; color: #0f172a; }
        .balance-final-value { font-size: 20px; font-weight: 600; }
        
        @media (max-width: 600px) {
            .stat-value { font-size: 26px; line-height: 1.2; }
            .sub-item-desc { max-width: 140px; }
        }
    </style>

    <div style="background: #f1f5f9; min-height: 100%;">
        <div class="report-header-modern">
            <div class="filters-container">
                <button id="chip-diario" class="filter-chip ${filtroSeleccionado === 'diario' ? 'active' : ''}" onclick="window.aplicarFiltroFecha('diario')">Diario</button>
                <button id="chip-semanal" class="filter-chip ${filtroSeleccionado === 'semanal' ? 'active' : ''}" onclick="window.aplicarFiltroFecha('semanal')">Semanal</button>
                <button id="chip-mensual" class="filter-chip ${filtroSeleccionado === 'mensual' ? 'active' : ''}" onclick="window.aplicarFiltroFecha('mensual')">Mensual</button>
                <button id="chip-anual" class="filter-chip ${filtroSeleccionado === 'anual' ? 'active' : ''}" onclick="window.aplicarFiltroFecha('anual')">Anual</button>
                <button id="chip-personalizado" class="filter-chip ${filtroSeleccionado === 'personalizado' ? 'active' : ''}" onclick="window.aplicarFiltroFecha('personalizado')">Personalizado</button>
            </div>

            <div class="hidden-inputs">
                <input type="date" id="fechaInicioInforme" value="${fechaInicio}">
                <input type="date" id="fechaFinInforme" value="${fechaFin}">
            </div>

            <div id="custom-calendar-container" class="custom-calendar-container">
                <div id="calendar-scroll-area" class="calendar-scroll-area"></div>
                <div style="padding: 10px; text-align: center; border-top: 1px solid #334155; font-size: 11px; color: #94a3b8;">
                    Toca la fecha inicial y luego la final
                </div>
            </div>

            <div class="action-bar">
                <div class="date-range-display">
                    <span class="date-icon">📅</span>
                    <span id="rango-fechas-label" style="opacity: 0.8">Selecciona un filtro...</span>
                </div>
            </div>
        </div>

        <div class="report-content">
            <div class="stat-card ventas">
                <div class="stat-label">💰 Ventas Totales</div>
                <div class="stat-value">${formatearMoneda(datos.totalVentas)}</div>
                <div class="stat-sub"><span class="badge-pill" style="background: #ecfdf5; color: #059669;">${datos.cantidadVentas} transacciones</span></div>
            </div>
            <div class="stat-card utilidad">
                <div class="stat-label">📈 Utilidad Neta</div>
                <div class="stat-value">${formatearMoneda(datos.utilidadNeta)}</div>
                <div class="stat-sub"><span class="badge-pill" style="background: #eff6ff; color: #2563eb;">${datos.margenGanancia}% margen</span></div>
            </div>
            <div class="stat-card gastos">
                <div class="stat-label">💸 Gastos Totales</div>
                <div class="stat-value">${formatearMoneda(datos.gastosTotales)}</div>
                <div class="stat-sub">Operacionales + Personales</div>
            </div>

            <div class="detail-card">
                
                ${datos.gastosOperacionales > 0 ? `
                    <div class="section-header">
                        <div class="section-title-group"><span class="bar-indicator" style="background: #0f172a;"></span><span class="section-title">GASTOS OPERACIONALES</span></div>
                    </div>
                    
                    ${datos.totalCompras > 0 ? `
                    <div class="row-group">
                        <div class="row-item">
                            <div class="row-label-container"><span class="row-label">🛒 Costo Inventario</span><span id="btn-sub-compras" class="btn-ver-detalle" onclick="window.toggleSubSection('compras')">Ver</span></div>
                            <span class="row-value">${formatearMoneda(datos.totalCompras)}</span>
                        </div>
                        <div id="sub-compras" class="sub-list">${renderListaItems(datos.listaCompras, 'compra')}</div>
                    </div>` : ''}

                    ${datos.totalServicios > 0 ? `
                    <div class="row-group">
                        <div class="row-item">
                            <div class="row-label-container"><span class="row-label">🏢 Servicios</span><span id="btn-sub-servicios" class="btn-ver-detalle" onclick="window.toggleSubSection('servicios')">Ver</span></div>
                            <span class="row-value">${formatearMoneda(datos.totalServicios)}</span>
                        </div>
                        <div id="sub-servicios" class="sub-list">${renderListaItems(datos.listaServicios, 'gasto')}</div>
                    </div>` : ''}

                    ${datos.totalNomina > 0 ? `
                    <div class="row-group">
                        <div class="row-item">
                            <div class="row-label-container"><span class="row-label">👥 Nómina</span><span id="btn-sub-nomina" class="btn-ver-detalle" onclick="window.toggleSubSection('nomina')">Ver</span></div>
                            <span class="row-value">${formatearMoneda(datos.totalNomina)}</span>
                        </div>
                        <div id="sub-nomina" class="sub-list">${renderListaItems(datos.listaNomina, 'gasto')}</div>
                    </div>` : ''}

                    ${datos.totalConsumos > 0 ? `
                    <div class="row-group">
                        <div class="row-item">
                            <div class="row-label-container"><span class="row-label">📦 Consumos Int.</span><span id="btn-sub-consumos" class="btn-ver-detalle" onclick="window.toggleSubSection('consumos')">Ver</span></div>
                            <span class="row-value">${formatearMoneda(datos.totalConsumos)}</span>
                        </div>
                        <div id="sub-consumos" class="sub-list">${renderListaItems(datos.listaConsumos, 'consumo')}</div>
                    </div>` : ''}

                    <div class="total-box">
                        <span style="font-weight: 600; color: #64748b; text-transform: uppercase;">Total Operacional</span>
                        <strong style="color: #0f172a;">${formatearMoneda(datos.gastosOperacionales)}</strong>
                    </div>
                    <div style="height: 20px;"></div>
                ` : ''}

                ${datos.gastosPersonalesExternos > 0 ? `
                    <div class="section-header">
                        <div class="section-title-group"><span class="bar-indicator" style="background: #94a3b8;"></span><span class="section-title">GASTOS PERSONALES</span></div>
                    </div>

                    ${datos.totalAlimentacion > 0 ? `
                    <div class="row-group">
                        <div class="row-item">
                            <div class="row-label-container"><span class="row-label">🍽️ Alimentación</span><span id="btn-sub-alim" class="btn-ver-detalle" onclick="window.toggleSubSection('alim')">Ver</span></div>
                            <span class="row-value">${formatearMoneda(datos.totalAlimentacion)}</span>
                        </div>
                        <div id="sub-alim" class="sub-list">${renderListaItems(datos.listaAlimentacion, 'gasto')}</div>
                    </div>` : ''}

                    ${datos.totalEntretenimiento > 0 ? `
                    <div class="row-group">
                        <div class="row-item">
                            <div class="row-label-container"><span class="row-label">🎮 Entretenim.</span><span id="btn-sub-entre" class="btn-ver-detalle" onclick="window.toggleSubSection('entre')">Ver</span></div>
                            <span class="row-value">${formatearMoneda(datos.totalEntretenimiento)}</span>
                        </div>
                        <div id="sub-entre" class="sub-list">${renderListaItems(datos.listaEntretenimiento, 'gasto')}</div>
                    </div>` : ''}

                    ${datos.totalViaje > 0 ? `
                    <div class="row-group">
                        <div class="row-item">
                            <div class="row-label-container"><span class="row-label">🚗 Transporte</span><span id="btn-sub-viaje" class="btn-ver-detalle" onclick="window.toggleSubSection('viaje')">Ver</span></div>
                            <span class="row-value">${formatearMoneda(datos.totalViaje)}</span>
                        </div>
                        <div id="sub-viaje" class="sub-list">${renderListaItems(datos.listaViaje, 'gasto')}</div>
                    </div>` : ''}

                    ${datos.totalDeuda > 0 ? `
                    <div class="row-group">
                        <div class="row-item">
                            <div class="row-label-container"><span class="row-label">💳 Deudas</span><span id="btn-sub-deuda" class="btn-ver-detalle" onclick="window.toggleSubSection('deuda')">Ver</span></div>
                            <span class="row-value">${formatearMoneda(datos.totalDeuda)}</span>
                        </div>
                        <div id="sub-deuda" class="sub-list">${renderListaItems(datos.listaDeuda, 'gasto')}</div>
                    </div>` : ''}

                    ${datos.totalVariable > 0 ? `
                    <div class="row-group">
                        <div class="row-item">
                            <div class="row-label-container"><span class="row-label">📝 Otros</span><span id="btn-sub-var" class="btn-ver-detalle" onclick="window.toggleSubSection('var')">Ver</span></div>
                            <span class="row-value">${formatearMoneda(datos.totalVariable)}</span>
                        </div>
                        <div id="sub-var" class="sub-list">${renderListaItems(datos.listaVariable, 'gasto')}</div>
                    </div>` : ''}

                    <div class="total-box">
                        <span style="font-weight: 600; color: #c2410c; text-transform: uppercase;">Total Personales</span>
                        <strong style="color: #9a3412;">${formatearMoneda(datos.gastosPersonalesExternos)}</strong>
                    </div>
                    <div style="height: 20px;"></div>
                ` : ''}

                ${datos.totalMermas > 0 ? `
                    <div class="section-header">
                        <div class="section-title-group"><span class="bar-indicator" style="background: #ef4444;"></span><span class="section-title" style="color: #ef4444;">MERMAS Y PÉRDIDAS</span></div>
                    </div>
                    <div class="row-group">
                        <div class="row-item">
                            <div class="row-label-container"><span class="row-label">📉 Registros</span><span id="btn-sub-mermas" class="btn-ver-detalle" onclick="window.toggleSubSection('mermas-list')" style="color: #ef4444; background: #fef2f2; border-color: #fee2e2;">Ver</span></div>
                            <span class="row-value" style="color: #ef4444;">${formatearMoneda(datos.totalMermas)}</span>
                        </div>
                        <div id="sub-mermas-list" class="sub-list">${renderListaItems(datos.listaMermas, 'merma')}</div>
                    </div>
                ` : ''}

            </div> <div class="balance-card">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span style="font-weight: 600; color: #64748b; font-size: 14px;">Ingresos Totales</span>
                    <span style="color: #10b981; font-weight: 700; font-size: 14px;">+ ${formatearMoneda(datos.totalVentas)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #e2e8f0;">
                    <span style="font-weight: 600; color: #64748b; font-size: 14px;">Gastos Totales</span>
                    <span style="color: #ef4444; font-weight: 700; font-size: 14px;">- ${formatearMoneda(datos.gastosTotales)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span class="balance-final-title" style="font-weight: 700; color: #0f172a; font-size: 16px;">BALANCE FINAL</span>
                    <span class="balance-final-value" style="color: ${datos.utilidadNeta >= 0 ? '#10b981' : '#ef4444'}; font-weight: 600; font-size: 20px;">
                        ${formatearMoneda(datos.utilidadNeta)}
                    </span>
                </div>
            </div>
            
            <div style="text-align: center; margin-top: 30px; margin-bottom: 20px; font-size: 11px; color: #94a3b8;">
                <p style="margin: 0;">Generado: ${new Date().toLocaleString('es-CO')}</p>
                <p style="margin: 4px 0 0 0; font-weight: 600;">${userData.tenants.nombre_negocio}</p>
            </div>
        </div>
    </div>
    `;
    
    // Inicializar etiqueta de fecha al cargar si hay datos
    setTimeout(() => {
        if(fechaInicio && fechaFin) {
            const opts = { month: 'short', day: 'numeric' };
            const t1 = new Date(fechaInicio + 'T00:00:00').toLocaleDateString('es-CO', opts);
            const t2 = new Date(fechaFin + 'T00:00:00').toLocaleDateString('es-CO', opts);
            
            const label = document.getElementById('rango-fechas-label');
            if(label) label.textContent = `${t1} - ${t2}`;
        }
    }, 100);
}

// Función para actualizar el informe desde inputs ocultos
async function actualizarInforme() {
    const fechaInicio = document.getElementById('fechaInicioInforme').value;
    const fechaFin = document.getElementById('fechaFinInforme').value;
    const modalBody = document.getElementById('modalBodyInformes');
    await cargarInformes(modalBody);
}
