/**
 * ==========================================
 * SISTEMA DE MESAS (CORREGIDO COMPLETO)
 * ===========================================
 */

let mesasData = {};
let suscripcionMesas = null;
let canalMesas = null;
let pollingInterval = null;
let intentosReconexion = 0;
const MAX_INTENTOS_RECONEXION = 3;
let mediaRecorderMesa = null;
let audioChunksMesa = [];
let estaGrabandoMesa = false;
let heartbeatInterval = null;
let mesaSeleccionadaId = null;

// Productos precargados para búsqueda rápida (como en compras)
let productosDataMesas = [];

// Inicializar mesas desde Supabase
async function inicializarMesas() {
    try {
        // Cargar mesas activas
        const { data: mesas, error } = await supabase
            .from('mesas_activas')
            .select('*')
            .eq('tenant_id', userData.tenant_id);
        if (error) throw error;

        mesasData = {};
        if (mesas && mesas.length > 0) {
            mesas.forEach(mesa => {
                mesasData[mesa.mesa_id] = {
                    id: mesa.mesa_id,
                    nombre: mesa.nombre,
                    descripcion: mesa.descripcion || '',
                    productos: mesa.productos || [],
                    createdAt: mesa.created_at
                };
            });
        }

        // Mapeo para eventos DELETE de Realtime
        window.mesaIdMap = {};
        if (mesas && mesas.length > 0) {
            mesas.forEach(mesa => {
                window.mesaIdMap[mesa.id] = mesa.mesa_id;
            });
        }

        // PRECARGAR PRODUCTOS para búsqueda rápida (como en compras)
        try {
            console.log('═══════════════════════════════════════');
            console.log('📦 PRECARGANDO PRODUCTOS');
            console.log('tenant_id:', userData.tenant_id);

            const { data: productos, error: errorProd } = await supabase
                .from('productos')
                .select('producto_id, codigo, producto, precio_venta, tipo_venta, unidad_venta, apodos_input')
                .eq('tenant_id', userData.tenant_id)
                .eq('activo', true);

            if (errorProd) {
                console.error('❌ Error en query de productos:', errorProd);
                productosDataMesas = [];
            } else if (productos) {
                productosDataMesas = productos;
                console.log('✅ Productos precargados:', productosDataMesas.length);
                console.log('Primeros 3 productos:', productosDataMesas.slice(0, 3));
            } else {
                console.log('⚠️ No se obtuvieron productos (data es null/undefined)');
                productosDataMesas = [];
            }
            console.log('═══════════════════════════════════════');
        } catch (e) {
            console.error('❌ Excepción precargando productos:', e);
            productosDataMesas = [];
        }

        console.log('📋 Mesas inicializadas:', Object.keys(mesasData).length);
    } catch (error) {
        console.error('❌ Error cargando mesas:', error);
        mesasData = {};
    }
}

// Guardar mesas en Supabase
async function guardarMesas() {
    try {
        const mesasArray = Object.values(mesasData).map(mesa => ({
            tenant_id: userData.tenant_id,
            mesa_id: mesa.id,
            nombre: mesa.nombre,
            descripcion: mesa.descripcion || '',
            productos: mesa.productos || [],
            updated_at: getTimestampTenant()
        }));

        const { error } = await supabase
            .from('mesas_activas')
            .upsert(mesasArray, {
                onConflict: 'tenant_id,mesa_id'
            });
        if (error) throw error;

        // Actualizar mapeo local
        const { data: mesasActualizadas } = await supabase
            .from('mesas_activas')
            .select('id, mesa_id')
            .eq('tenant_id', userData.tenant_id);

        if (mesasActualizadas) {
            window.mesaIdMap = {};
            mesasActualizadas.forEach(m => {
                window.mesaIdMap[m.id] = m.mesa_id;
            });
        }
    } catch (error) {
        console.error('❌ Error guardando mesas:', error);
    }
}

// Suscribirse a cambios en tiempo real
function suscribirseACambiosMesas() {
    if (canalMesas) {
        try {
            canalMesas.unsubscribe();
        } catch (error) { console.error(error); }
        canalMesas = null;
    }

    console.log('📡 Iniciando suscripción Realtime...');

    canalMesas = supabase
        .channel(`mesas-activas-${userData.tenant_id}`, {
            config: { broadcast: { self: false }, presence: { key: '' } }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas_activas', filter: `tenant_id=eq.${userData.tenant_id}` },
            async (payload) => {
                let mesaModificadaId;
                if (payload.eventType === 'DELETE') {
                    mesaModificadaId = window.mesaIdMap[payload.old?.id];
                } else {
                    mesaModificadaId = payload.new?.mesa_id;
                }

                detenerPollingMesas();
                const modal = document.getElementById('modalMesas');
                if (!modal || !modal.classList.contains('show')) return;

                if (payload.eventType === 'INSERT') {
                    if (window.mesaRecienCreada === mesaModificadaId) return;
                    await inicializarMesas();
                    const modalBody = document.getElementById('modalBodyMesas');
                    renderizarMesas(modalBody);
                }
                else if (payload.eventType === 'DELETE') {
                    delete mesasData[mesaModificadaId];
                    const modalBody = document.getElementById('modalBodyMesas');
                    renderizarMesas(modalBody);
                } else if (payload.eventType === 'UPDATE') {
                    await inicializarMesas();
                    const mesa = mesasData[mesaModificadaId];
                    if (!mesa) return;

                    if (mesaSeleccionadaId === mesaModificadaId) {
                        const inputBuscador = document.getElementById(`buscar-${mesaModificadaId}`);
                        const teniaFoco = (document.activeElement === inputBuscador);
                        const valorInput = inputBuscador?.value || '';
                        const cursorPos = inputBuscador?.selectionStart || 0;

                        actualizarPanelDetalle(mesaModificadaId);

                        if (teniaFoco || valorInput) {
                            setTimeout(() => {
                                const nuevoInput = document.getElementById(`buscar-${mesaModificadaId}`);
                                if (nuevoInput) {
                                    nuevoInput.value = valorInput;
                                    if (teniaFoco) {
                                        nuevoInput.focus();
                                        nuevoInput.setSelectionRange(cursorPos, cursorPos);
                                    }
                                }
                            }, 10);
                        }
                    }

                    actualizarPreviewMesa(mesaModificadaId, mesa);
                }
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                intentosReconexion = 0;
                detenerPollingMesas();
                iniciarHeartbeat();
                actualizarIndicadorEstado();
            }
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                iniciarPollingMesas();
            }
        });
}

function iniciarHeartbeat() {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(async () => {
        if (!canalMesas || canalMesas.state !== 'joined') {
            clearInterval(heartbeatInterval);
            suscribirseACambiosMesas();
            return;
        }
        try {
            await supabase.from('mesas_activas').select('mesa_id', { count: 'exact', head: true }).eq('tenant_id', userData.tenant_id).limit(1);
        } catch (error) { }
    }, 30000);
}

function detenerPollingMesas() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

function iniciarPollingMesas() {
    if (pollingInterval) clearInterval(pollingInterval);
    let ultimoHash = '';
    pollingInterval = setInterval(async () => {
        const modal = document.getElementById('modalMesas');
        if (modal && modal.classList.contains('show')) {
            const modalBody = document.getElementById('modalBodyMesas');
            const enHistorial = modalBody && modalBody.innerHTML.includes('Historial');
            if (!enHistorial) {
                try {
                    const { data: mesasActuales, error } = await supabase.from('mesas_activas').select('*').eq('tenant_id', userData.tenant_id);
                    if (error) return;
                    const nuevoHash = JSON.stringify(mesasActuales);
                    if (nuevoHash !== ultimoHash) {
                        ultimoHash = nuevoHash;
                        await inicializarMesas();
                        renderizarMesas(modalBody);
                    }
                } catch (error) { console.error(error); }
            }
        }
    }, 3000);
}

async function abrirModalMesas() {
    const modal = document.getElementById('modalMesas');
    const modalBody = document.getElementById('modalBodyMesas');
    modalBody.innerHTML = '<div style="text-align: center; padding: 40px;"><p>Cargando mesas...</p></div>';
    modal.classList.add('show');

    await inicializarMesas();
    renderizarMesas(modalBody);

    // EVENT DELEGATION - Configurar una sola vez
    console.log('═══════════════════════════════════════');
    console.log('🎯 CONFIGURANDO EVENT DELEGATION');
    console.log('modalBody existe?', !!modalBody);

    // Remover listeners previos si existen
    modalBody.removeEventListener('input', handleSearchInput);
    modalBody.removeEventListener('change', handleChangeInput);
    modalBody.removeEventListener('click', handleClickActions);
    modalBody.removeEventListener('mousedown', handleMouseDown);
    modalBody.removeEventListener('mouseup', handleMouseUp);
    modalBody.removeEventListener('mouseleave', handleMouseLeave);
    modalBody.removeEventListener('touchstart', handleTouchStart);
    modalBody.removeEventListener('touchend', handleTouchEnd);

    // Agregar nuevos listeners
    modalBody.addEventListener('input', handleSearchInput);
    modalBody.addEventListener('change', handleChangeInput);
    modalBody.addEventListener('click', handleClickActions);
    modalBody.addEventListener('mousedown', handleMouseDown);
    modalBody.addEventListener('mouseup', handleMouseUp);
    modalBody.addEventListener('mouseleave', handleMouseLeave);
    modalBody.addEventListener('touchstart', handleTouchStart);
    modalBody.addEventListener('touchend', handleTouchEnd);

    console.log('✅ Event listeners configurados con delegación');
    console.log('═══════════════════════════════════════');

    suscribirseACambiosMesas();
    setTimeout(() => {
        if (!canalMesas || canalMesas.state !== 'joined') {
            iniciarPollingMesas();
        }
    }, 5000);
}

// Exponer globalmente
window.abrirModalMesas = abrirModalMesas;

// ==============================================
// HANDLERS PARA EVENT DELEGATION
// ==============================================

// Handler para inputs de búsqueda
function handleSearchInput(e) {
    const target = e.target;

    if (target && target.classList && target.classList.contains('input-producto-buscar')) {
        const inputId = target.id;
        const mesaId = inputId.replace('buscar-', '');
        buscarProductoMesa(mesaId, target);
    }
}

// Handler para cambios en inputs (validación de cantidad)
function handleChangeInput(e) {
    const target = e.target;
    const action = target.dataset.action;

    if (action === 'validar-cantidad-busqueda') {
        const mesaId = target.dataset.mesaId;
        validarCantidadBusqueda(mesaId);
    }
}

// Handler principal para clicks
function handleClickActions(e) {
    // Verificar si es un resultado de búsqueda
    const resultadoItem = e.target.closest('.resultado-producto-item');
    if (resultadoItem) {
        e.preventDefault();
        const mesaId = resultadoItem.dataset.mesaId;
        const producto = JSON.parse(resultadoItem.dataset.producto);
        seleccionarProductoMesa(mesaId, producto);
        return;
    }

    // Verificar si es una acción con data-action
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    const mesaId = target.dataset.mesaId;

    switch (action) {
        case 'ajustar-cantidad':
            e.stopPropagation();
            const productoIndex = parseInt(target.dataset.productoIndex);
            const delta = parseInt(target.dataset.delta);
            ajustarCantidad(mesaId, productoIndex, delta);
            break;

        case 'eliminar-producto':
            e.stopPropagation();
            const index = parseInt(target.dataset.productoIndex);
            eliminarProductoMesa(mesaId, index);
            break;

        case 'ajustar-busqueda':
            const deltaBusqueda = parseInt(target.dataset.delta);
            ajustarCantidadBusqueda(mesaId, deltaBusqueda);
            break;
    }
}

// Handler para mousedown (prevenir selección de texto)
function handleMouseDown(e) {
    const target = e.target.closest('.qty-btn, .delete-btn, .btn-grabar-voz');
    if (target) {
        e.preventDefault();
    }

    // Iniciar grabación de voz
    const voiceBtn = e.target.closest('[data-action="grabar-voz"]');
    if (voiceBtn) {
        const mesaId = voiceBtn.dataset.mesaId;
        iniciarGrabacionMesa(mesaId, voiceBtn);
    }
}

// Handler para mouseup (detener grabación)
function handleMouseUp(e) {
    if (estaGrabandoMesa) {
        const voiceBtn = document.querySelector('.btn-grabar-voz[data-action="grabar-voz"]');
        detenerGrabacionMesa(voiceBtn);
    }
}

// Handler para mouseleave (detener grabación si sale del contenedor)
function handleMouseLeave(e) {
    if (estaGrabandoMesa && e.target.id === 'modalBodyMesas') {
        const voiceBtn = document.querySelector('.btn-grabar-voz[data-action="grabar-voz"]');
        detenerGrabacionMesa(voiceBtn);
    }
}

// Handler para touchstart (móvil)
function handleTouchStart(e) {
    const voiceBtn = e.target.closest('[data-action="grabar-voz"]');
    if (voiceBtn) {
        e.preventDefault();
        const mesaId = voiceBtn.dataset.mesaId;
        iniciarGrabacionMesa(mesaId, voiceBtn);
    }
}

// Handler para touchend (móvil)
function handleTouchEnd(e) {
    const voiceBtn = e.target.closest('[data-action="grabar-voz"]');
    if (voiceBtn && estaGrabandoMesa) {
        e.preventDefault();
        detenerGrabacionMesa(voiceBtn);
    }
}

function closeModalMesas() {
    document.getElementById('modalMesas').classList.remove('show');
    if (canalMesas) {
        try { canalMesas.unsubscribe(); } catch (e) { }
        canalMesas = null;
    }
    detenerPollingMesas();
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}

function actualizarIndicadorEstado() {
    const indicador = document.getElementById('estadoMesasBadge');
    if (!indicador) return;
    const estaConectado = canalMesas && canalMesas.state === 'joined';
    const estaPolling = !!pollingInterval;

    indicador.classList.remove('status-online', 'status-polling', 'status-offline');

    if (estaConectado) {
        indicador.classList.add('status-online');
        indicador.textContent = 'Tiempo real activo';
    } else if (estaPolling) {
        indicador.classList.add('status-polling');
        indicador.textContent = 'Modo polling (3s)';
    } else {
        indicador.classList.add('status-offline');
        indicador.textContent = 'Desconectado';
    }
}

function calcularTotalesMesa(mesa) {
    mesa.totalProductos = mesa.productos ? mesa.productos.length : 0;
    mesa.totalMonto = mesa.productos ?
        mesa.productos.reduce((sum, p) => {
            const precio = p.precio_unitario || p.precio || 0;
            return sum + (precio * p.cantidad);
        }, 0) : 0;
}

function renderizarMesas(modalBody) {
    const mesasArray = Object.values(mesasData);
    mesasArray.sort((a, b) => {
        const numA = parseInt(a.nombre.match(/\d+/)?.[0] || 0);
        const numB = parseInt(b.nombre.match(/\d+/)?.[0] || 0);
        return numA - numB;
    });
    mesasArray.forEach(mesa => calcularTotalesMesa(mesa));

    if (!mesaSeleccionadaId || !mesasData[mesaSeleccionadaId]) {
        mesaSeleccionadaId = mesasArray[0]?.id || null;
    }

    const tarjetaNuevaMesa = `
        <div class="mesa-card mesa-nueva" onclick="crearNuevaMesa()">
            <div class="mesa-nueva-icono">+</div>
            <div class="mesa-nueva-texto">Nueva mesa</div>
        </div>
    `;

    const mesasHTML = mesasArray.map(mesa => {
        const estaOcupada = mesa.totalProductos > 0;
        const productosPreview = mesa.productos && mesa.productos.length > 0
            ? mesa.productos.map(p => `${p.cantidad} ${p.nombre}`).slice(0, 2).join(', ') + (mesa.productos.length > 2 ? '...' : '')
            : 'Vacía';
        const mostrarBotonEditar = !(mesa.descripcion && mesa.descripcion.trim());
        const estaSeleccionada = mesaSeleccionadaId === mesa.id;

        return `
            <div class="mesa-card ${estaOcupada ? 'ocupada' : ''} ${estaSeleccionada ? 'selected' : ''}" data-mesa-id="${mesa.id}" onclick="seleccionarMesa('${mesa.id}')">
                <div class="mesa-card-header">
                    <div class="mesa-info">
                        <div class="mesa-nombre-row">
                            <div class="mesa-nombre">${mesa.nombre}</div>
                            <div class="mesa-descripcion-chip mesa-descripcion-${mesa.id} ${mesa.descripcion ? '' : 'is-empty'}" onclick="event.stopPropagation(); editarDescripcionMesa('${mesa.id}')">${mesa.descripcion || ''}</div>
                            ${mostrarBotonEditar ? `<button onclick="event.stopPropagation(); editarDescripcionMesa('${mesa.id}')" class="mesa-edit-btn mesa-edit-btn-${mesa.id}" data-mesa-id="${mesa.id}" title="Editar descripción" aria-label="Editar descripción de ${mesa.nombre}">&#9998;</button>` : ''}
                        </div>
                        <div class="mesa-resumen mesa-resumen-${mesa.id}">
                            <span class="mesa-items">${mesa.totalProductos} items</span>
                            <span class="mesa-total">$${mesa.totalMonto.toLocaleString('es-CO')}</span>
                        </div>
                    </div>
                    <div class="mesa-actions">
                        <span class="mesa-estado ${estaOcupada ? 'ocupada' : 'libre'}">${estaOcupada ? 'Ocupada' : 'Libre'}</span>
                        ${!estaOcupada ? `<button class="btn-delete-mesa" onclick="event.stopPropagation(); eliminarMesa('${mesa.id}')">&times;</button>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('') + tarjetaNuevaMesa;

    const headerHTML = `
        <div class="mesas-header">
            <div class="status-badge" id="estadoMesasBadge">
                ${canalMesas && canalMesas.state === 'joined' ? 'Tiempo real activo' : pollingInterval ? 'Modo polling (3s)' : 'Desconectado'}
            </div>
            <button onclick="abrirHistorialMesas()" class="btn-historial">
                Historial
            </button>
        </div>
    `;

    const detalleHTML = renderizarDetalleMesa(mesaSeleccionadaId ? mesasData[mesaSeleccionadaId] : null);

    modalBody.innerHTML = `
        <div class="modal-mesas-layout mesas-split-layout">
            <div class="mesas-panel mesas-panel-izquierdo">
                ${headerHTML}
                <div class="mesa-grid modal-mesas-grid">
                    ${mesasHTML}
                </div>
            </div>
            <div class="mesas-panel mesas-panel-derecho" id="panelDetalleMesa">
                ${detalleHTML}
            </div>
        </div>
    `;

    setTimeout(() => { actualizarIndicadorEstado(); }, 100);
}

function seleccionarMesa(mesaId) {
    if (!mesasData[mesaId]) return;
    if (mesaSeleccionadaId === mesaId) return;

    mesaSeleccionadaId = mesaId;

    document.querySelectorAll('.mesa-card.selected').forEach(card => card.classList.remove('selected'));
    const tarjeta = document.querySelector(`.mesa-card[data-mesa-id="${mesaId}"]`);
    if (tarjeta) tarjeta.classList.add('selected');

    actualizarPanelDetalle(mesaId);

    // En móvil, mostrar el panel de detalle automáticamente
    if (window.innerWidth < 768) {
        const panel = document.getElementById('panelDetalleMesa');
        if (panel) {
            panel.classList.remove('oculto');
        }
    }
}

function actualizarPanelDetalle(mesaId) {
    const panel = document.getElementById('panelDetalleMesa');
    if (!panel) return;
    const mesa = mesaId ? mesasData[mesaId] : null;
    panel.innerHTML = renderizarDetalleMesa(mesa);
}

function generarHTMLProductos(mesa) {
    if (!mesa.productos || mesa.productos.length === 0) return '';

    return mesa.productos.map((p, index) => `
        <div class="producto-item" style="display: flex; align-items: center; border-bottom: 1px solid #f3f4f6; padding: 0 8px; height: 32px; background: white;">
            <div class="producto-controls" style="display: flex; align-items: center; border: 1px solid #e5e7eb; border-radius: 4px; height: 22px; margin-right: 8px; overflow: hidden; flex-shrink: 0; background: white;">
                <div class="qty-btn qty-btn-minus" data-mesa-id="${mesa.id}" data-producto-index="${index}" data-action="ajustar-cantidad" data-delta="-1" style="width: 20px; height: 100%; border-right: 1px solid #f3f4f6; background: #f9fafb; cursor: pointer; font-size: 10px; color: #666; display: flex; align-items: center; justify-content: center; user-select: none;">−</div>
                <div class="qty-display" style="min-width: 20px; padding: 0 4px; height: 100%; text-align: center; font-weight: 600; font-size: 11px; display: flex; align-items: center; justify-content: center; color: #374151;">${p.cantidad}</div>
                <div class="qty-btn qty-btn-plus" data-mesa-id="${mesa.id}" data-producto-index="${index}" data-action="ajustar-cantidad" data-delta="1" style="width: 20px; height: 100%; border-left: 1px solid #f3f4f6; background: #f9fafb; cursor: pointer; font-size: 10px; color: #666; display: flex; align-items: center; justify-content: center; user-select: none;">+</div>
            </div>
            <div class="producto-info" style="flex: 1; display: flex; align-items: center; min-width: 0; padding-right: 8px;">
                <span class="producto-nombre" style="font-size: 11px; color: #374151; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                   ${p.unidad && p.unidad !== 'und' ? `<span style="color:#9ca3af; margin-right:2px; font-size:10px;">${p.unidad}</span>` : ''} ${p.nombre}
                </span>
            </div>
            <div style="font-weight: 600; font-size: 11px; color: #10b981; white-space: nowrap; margin-right: 8px;">
                ${((p.precio_unitario || p.precio || 0) * p.cantidad).toLocaleString('es-CO')}
            </div>
            <button class="delete-btn" data-mesa-id="${mesa.id}" data-producto-index="${index}" data-action="eliminar-producto" style="width: 20px; height: 20px; flex-shrink: 0; background: transparent; border: none; color: #9ca3af; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px; padding: 0; box-shadow: none;">🗑️</button>
        </div>
    `).join('');
}

function renderizarDetalleMesa(mesa) {
    if (!mesa) {
        return `
            <div class="detalle-empty">
                <div class="empty-icon">🍽️</div>
                <div class="empty-text">Selecciona una mesa para ver su detalle</div>
            </div>
        `;
    }

    const productosHTML = mesa.productos && mesa.productos.length > 0 ? generarHTMLProductos(mesa) : '';
    const totalMesa = mesa.productos?.reduce((sum, p) => sum + ((p.precio_unitario || p.precio || 0) * p.cantidad), 0) || 0;
    const estaOcupada = mesa.productos && mesa.productos.length > 0;

    const listaHTML = estaOcupada
        ? `<div class="productos-lista">${productosHTML}</div>`
        : `<div class="empty-state"><div class="empty-icon">--</div><div class="empty-text">Mesa vacía - agrega productos</div></div>`;

    return `
        <div class="detalle-header">
            <div>
                <div class="detalle-titulo">${mesa.nombre}</div>
                ${mesa.descripcion ? `<p class="detalle-descripcion">${mesa.descripcion}</p>` : ''}
            </div>
            <span class="detalle-badge ${estaOcupada ? 'ocupada' : 'libre'}">${estaOcupada ? 'Ocupada' : 'Libre'}</span>
        </div>
        <div class="detalle-body">
            ${listaHTML}
        </div>
        <div class="detalle-footer">
            ${renderizarBuscadorMesa(mesa)}
            <button class="btn btn-primary" onclick="registrarVentaMesa('${mesa.id}')">
                Registrar venta • $${totalMesa.toLocaleString('es-CO')}
            </button>
        </div>
    `;
}

function renderizarBuscadorMesa(mesa) {
    return `
        <div class="buscador-mesa-wrapper" style="position: relative; margin-bottom: 8px;">
            <div style="display: flex; gap: 8px; align-items: center;">
                <div class="buscar-producto" style="flex: 1; display: flex; gap: 4px; align-items: center; background: #f9fafb; padding: 4px 8px; border: 1px solid #e5e7eb; border-radius: 8px; height: 36px;">
                    <div class="producto-controls" style="display: flex; align-items: center; border: 1px solid #e5e7eb; border-radius: 4px; height: 22px; background: white; flex-shrink: 0;">
                        <div class="qty-btn qty-btn-busqueda-minus" data-mesa-id="${mesa.id}" data-action="ajustar-busqueda" data-delta="-1" style="width: 20px; height: 100%; border-right: 1px solid #f3f4f6; cursor: pointer; font-size: 10px; color: #666; display: flex; align-items: center; justify-content: center; user-select: none;">−</div>
                        
                        <input type="number" class="cantidad-input" id="cantidad-buscar-${mesa.id}" value="1" min="1" data-mesa-id="${mesa.id}" data-action="validar-cantidad-busqueda" style="width: 24px; height: 100%; text-align: center; padding: 0; border: none; font-size: 11px; font-weight: 600; outline: none; -moz-appearance: textfield; background: transparent;">
                        
                        <div class="qty-btn qty-btn-busqueda-plus" data-mesa-id="${mesa.id}" data-action="ajustar-busqueda" data-delta="1" style="width: 20px; height: 100%; border-left: 1px solid #f3f4f6; cursor: pointer; font-size: 10px; color: #666; display: flex; align-items: center; justify-content: center; user-select: none;">+</div>
                    </div>
                    
                    <input type="text" class="buscar-input input-producto-buscar" id="buscar-${mesa.id}" placeholder="Buscar producto..." 
                        style="flex: 1; padding: 0 8px; height: 24px; border: none; background: transparent; font-size: 11px; font-weight: 500; outline: none;">
                </div>
                
                <button class="btn-grabar-voz" data-mesa-id="${mesa.id}" data-action="grabar-voz" style="background: transparent; border: none; cursor: pointer; padding: 0; display: flex; align-items: center; justify-content: center; color: #667eea; width: 36px; height: 36px; border-radius: 8px;">
                    <span style="font-size: 20px;">🎤</span>
                </button>
            </div>
            <div id="resultados-busqueda-${mesa.id}" style="display: none; position: absolute; bottom: 100%; left: 0; right: 0; z-index: 9999; background: white; border: 2px solid #E5E7EB; border-radius: 12px; max-height: 300px; overflow-y: auto; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15); margin-bottom: 4px;"></div>
        </div>
    `;
}

function actualizarPreviewMesa(mesaId, mesa) {
    calcularTotalesMesa(mesa);
    const descripcionElement = document.querySelector(`.mesa-descripcion-${mesaId}`);
    if (descripcionElement) {
        if (mesa.descripcion && mesa.descripcion.trim() !== '') {
            descripcionElement.textContent = mesa.descripcion;
            descripcionElement.classList.remove('is-empty');
        } else {
            descripcionElement.textContent = '';
            descripcionElement.classList.add('is-empty');
        }
    }

    const botonLapiz = document.querySelector(`.mesa-edit-btn-${mesaId}`);
    const debeMostrarLapiz = !(mesa.descripcion && mesa.descripcion.trim());

    if (botonLapiz) {
        botonLapiz.style.display = debeMostrarLapiz ? '' : 'none';
    } else if (debeMostrarLapiz && descripcionElement) {
        const nombreRow = descripcionElement.closest('.mesa-nombre-row');
        if (nombreRow) {
            const nuevoBoton = document.createElement('button');
            nuevoBoton.onclick = (event) => { event.stopPropagation(); editarDescripcionMesa(mesaId); };
            nuevoBoton.className = `mesa-edit-btn mesa-edit-btn-${mesaId}`;
            nuevoBoton.dataset.mesaId = mesaId;
            nuevoBoton.title = 'Editar descripción';
            nuevoBoton.setAttribute('aria-label', `Editar descripción de ${mesa.nombre}`);
            nuevoBoton.textContent = '✏️';
            nombreRow.appendChild(nuevoBoton);
        }
    }

    const resumenElement = document.querySelector(`.mesa-resumen-${mesaId}`);
    if (resumenElement) {
        resumenElement.innerHTML = `<span>${mesa.totalProductos} items</span><span style="color: #10b981; font-weight: 600;">$${mesa.totalMonto.toLocaleString('es-CO')}</span>`;
    }
}

async function crearNuevaMesa() {
    const numerosExistentes = Object.values(mesasData)
        .map(m => {
            const match = m.nombre.match(/Mesa (\d+)/);
            return match ? parseInt(match[1]) : 0;
        })
        .sort((a, b) => a - b);
    let numeroMesa = 1;
    for (let i = 0; i < numerosExistentes.length; i++) {
        if (numerosExistentes[i] === numeroMesa) {
            numeroMesa++;
        } else {
            break;
        }
    }

    const mesaId = `mesa-${Date.now()}`;
    mesasData[mesaId] = {
        id: mesaId,
        nombre: `Mesa ${numeroMesa}`,
        descripcion: '',
        productos: [],
        createdAt: getTimestampTenant()
    };

    window.mesaRecienCreada = mesaId;
    const modalBody = document.getElementById('modalBodyMesas');
    mesaSeleccionadaId = mesaId;
    renderizarMesas(modalBody);
    setTimeout(() => {
        seleccionarMesa(mesaId);
        window.mesaRecienCreada = null;
    }, 50);
    await guardarMesas();
}

async function eliminarMesa(mesaId) {
    if (!confirm('¿Seguro que deseas eliminar esta mesa?')) return;
    try {
        const { error } = await supabase.from('mesas_activas').delete().eq('tenant_id', userData.tenant_id).eq('mesa_id', mesaId);
        if (error) throw error;
        delete mesasData[mesaId];
        if (mesaSeleccionadaId === mesaId) {
            mesaSeleccionadaId = Object.keys(mesasData)[0] || null;
        }
        const modalBody = document.getElementById('modalBodyMesas');
        renderizarMesas(modalBody);
    } catch (error) {
        console.error('Error eliminando mesa:', error);
        alert('Error al eliminar la mesa');
    }
}

async function editarDescripcionMesa(mesaId) {
    const mesa = mesasData[mesaId];
    if (!mesa) return;
    const chip = document.querySelector(`.mesa-descripcion-${mesaId}`);
    if (!chip || chip.dataset.editing === 'true') return;

    const botonLapiz = document.querySelector(`.mesa-edit-btn-${mesaId}`);
    if (botonLapiz) {
        botonLapiz.style.display = 'none';
    }

    const tarjetaMesa = chip.closest('.mesa-card');
    const indicadorEstado = tarjetaMesa?.querySelector('.mesa-estado');
    const flechaMesa = tarjetaMesa?.querySelector('.mesa-flecha');
    if (tarjetaMesa) tarjetaMesa.classList.add('editando-descripcion');
    if (indicadorEstado) indicadorEstado.style.display = 'none';
    if (flechaMesa) flechaMesa.style.display = 'none';

    chip.dataset.editing = 'true';
    chip.classList.remove('is-empty');
    chip.classList.add('editing');

    const input = document.createElement('input');
    input.type = 'text';
    input.value = mesa.descripcion || '';
    input.placeholder = 'Descripción';
    input.className = 'mesa-descripcion-input';

    const acciones = document.createElement('div');
    acciones.className = 'mesa-descripcion-acciones';

    const btnCancelar = document.createElement('button');
    btnCancelar.textContent = '×';
    btnCancelar.title = 'Cancelar edición';
    btnCancelar.className = 'mesa-descripcion-btn cancelar';

    const btnGuardar = document.createElement('button');
    btnGuardar.textContent = '✓';
    btnGuardar.title = 'Guardar descripción';
    btnGuardar.className = 'mesa-descripcion-btn guardar';

    const restaurarChip = () => {
        chip.dataset.editing = 'false';
        chip.classList.remove('editing');
        if (botonLapiz) {
            botonLapiz.style.display = '';
        }
        if (tarjetaMesa) tarjetaMesa.classList.remove('editando-descripcion');
        if (indicadorEstado) indicadorEstado.style.display = '';
        if (flechaMesa) flechaMesa.style.display = '';
        actualizarPreviewMesa(mesaId, mesa);
    };

    btnCancelar.addEventListener('click', (event) => {
        event.stopPropagation();
        restaurarChip();
    });

    btnGuardar.addEventListener('click', async (event) => {
        event.stopPropagation();
        mesa.descripcion = input.value.trim();
        await guardarMesas();
        restaurarChip();
    });

    chip.innerHTML = '';
    chip.appendChild(input);
    acciones.appendChild(btnCancelar);
    acciones.appendChild(btnGuardar);
    chip.appendChild(acciones);

    chip.addEventListener('click', (event) => event.stopPropagation());
    setTimeout(() => input.focus(), 0);
}

function ajustarCantidad(mesaId, productoIndex, delta) {
    const mesa = mesasData[mesaId];
    if (!mesa || !mesa.productos[productoIndex]) return;

    const inputBuscador = document.getElementById(`buscar-${mesaId}`);
    const teniaFoco = (document.activeElement === inputBuscador);

    mesa.productos[productoIndex].cantidad += delta;
    if (mesa.productos[productoIndex].cantidad <= 0) {
        mesa.productos.splice(productoIndex, 1);
    }
    guardarMesas();

    if (mesaSeleccionadaId === mesaId) {
        actualizarPanelDetalle(mesaId);
    }
    actualizarPreviewMesa(mesaId, mesa);

    if (teniaFoco) {
        setTimeout(() => {
            const nuevoInput = document.getElementById(`buscar-${mesaId}`);
            if (nuevoInput) nuevoInput.focus();
        }, 10);
    }
}

function ajustarCantidadBusqueda(mesaId, delta) {
    const inputQty = document.getElementById(`cantidad-buscar-${mesaId}`);
    const inputSearch = document.getElementById(`buscar-${mesaId}`);

    if (!inputQty) return;

    let cantidad = parseInt(inputQty.value) || 1;
    cantidad += delta;
    if (cantidad < 1) cantidad = 1;

    inputQty.value = cantidad;

    if (inputSearch) {
        inputSearch.focus();
    }
}

function eliminarProductoMesa(mesaId, productoIndex) {
    const mesa = mesasData[mesaId];
    if (!mesa || !mesa.productos[productoIndex]) return;

    const inputBuscador = document.getElementById(`buscar-${mesaId}`);
    const teniaFoco = (document.activeElement === inputBuscador);

    mesa.productos.splice(productoIndex, 1);
    guardarMesas();

    if (mesaSeleccionadaId === mesaId) {
        actualizarPanelDetalle(mesaId);
    }

    actualizarPreviewMesa(mesaId, mesa);

    if (teniaFoco) {
        setTimeout(() => {
            const nuevoInput = document.getElementById(`buscar-${mesaId}`);
            if (nuevoInput) nuevoInput.focus();
        }, 10);
    }
}

async function iniciarGrabacionMesa(mesaId, btnElement) {
    if (estaGrabandoMesa) return;
    
    // Si no se pasa el botón, intentar encontrarlo
    const btn = btnElement || document.querySelector(`[data-mesa-id="${mesaId}"][data-action="grabar-voz"]`);
    if (!btn) return;
    
    btn.style.transform = 'scale(0.9)';
    btn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    const iconSpan = btn.querySelector('span');
    if (iconSpan) iconSpan.textContent = '⏹️';
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderMesa = new MediaRecorder(stream);
        audioChunksMesa = [];

        mediaRecorderMesa.ondataavailable = (event) => {
            if (event.data.size > 0) audioChunksMesa.push(event.data);
        };

        mediaRecorderMesa.onstop = async () => {
            stream.getTracks().forEach(track => track.stop());
            if (audioChunksMesa.length > 0) {
                const audioBlob = new Blob(audioChunksMesa, { type: 'audio/webm' });
                if (audioBlob.size > 1000) await enviarAudioMesa(mesaId, audioBlob);
            }
            audioChunksMesa = [];
        };

        mediaRecorderMesa.start();
        estaGrabandoMesa = true;
    } catch (error) {
        console.error('Error con micrófono:', error);
        alert('No se pudo acceder al micrófono');
        btn.style.transform = 'scale(1)';
        btn.style.background = '#667eea';
        btn.innerHTML = '🎤';
    }
}

function detenerGrabacionMesa(btnElement) {
    if (!estaGrabandoMesa) return;
    
    if (mediaRecorderMesa && mediaRecorderMesa.state === 'recording') {
        mediaRecorderMesa.stop();
    }
    estaGrabandoMesa = false;
    
    // Buscar el botón de grabación activo
    const btn = btnElement || document.querySelector('.btn-grabar-voz[data-action="grabar-voz"]');
    if (btn) {
        btn.style.transform = 'scale(1)';
        btn.style.background = 'transparent';
        const iconSpan = btn.querySelector('span');
        if (iconSpan) iconSpan.textContent = '🎤';
    }
}

async function enviarAudioMesa(mesaId, audioBlob) {
    try {
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
            const base64Audio = reader.result.split(',')[1];
            const response = await fetch('https://n8n-n8n.aa7tej.easypanel.host/webhook/productos-mesas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    audio: base64Audio,
                    tipo: 'audio',
                    mesa_id: mesaId,
                    tenant_id: userData.tenant_id,
                    user_id: userData.user_id
                })
            });
            const data = await response.json();
            if (data.productos && data.productos.length > 0) {
                const mesa = mesasData[mesaId];
                if (mesa) {
                    data.productos.forEach(prod => {
                        const existente = mesa.productos.find(p => p.codigo === prod.codigo);
                        if (existente) {
                            existente.cantidad += prod.cantidad;
                        } else {
                            mesa.productos.push({
                                codigo: prod.codigo,
                                nombre: prod.nombre,
                                cantidad: prod.cantidad,
                                precio: prod.precio || 0,
                                precio_unitario: prod.precio || 0,
                                unidad: prod.unidad || 'und'
                            });
                        }
                    });
                    await guardarMesas();
                    if (mesaSeleccionadaId === mesaId) {
                        actualizarPanelDetalle(mesaId);
                    }
                    actualizarPreviewMesa(mesaId, mesa);
                }
            } else {
                alert('No se pudieron procesar los productos del audio');
            }
        };
    } catch (error) {
        console.error('Error enviando audio:', error);
        alert('Error al procesar el audio');
    }
}

function seleccionarProductoMesa(mesaId, producto) {
    const mesa = mesasData[mesaId];
    if (!mesa) return;
    if (!mesa.productos) mesa.productos = [];

    const inputCantidad = document.getElementById(`cantidad-buscar-${mesaId}`);
    const cantidadAgregar = inputCantidad ? parseInt(inputCantidad.value) || 1 : 1;
    const existente = mesa.productos.find(p => p.codigo === producto.codigo);

    if (existente) {
        existente.cantidad += cantidadAgregar;
    } else {
        if (mesa.productos.length >= 10) {
            alert('Una mesa puede tener máximo 10 productos diferentes');
            return;
        }
        mesa.productos.push({
            codigo: producto.codigo,
            nombre: producto.producto,
            cantidad: cantidadAgregar,
            precio: parseFloat(producto.precio_venta) || 0,
            precio_unitario: parseFloat(producto.precio_venta) || 0,
            unidad: producto.tipo_venta === 'peso' || producto.tipo_venta === 'medida' ? producto.unidad_venta : 'und'
        });
    }

    guardarMesas();

    const input = document.getElementById(`buscar-${mesaId}`);
    const resultadosDiv = document.getElementById(`resultados-busqueda-${mesaId}`);

    if (resultadosDiv) resultadosDiv.style.display = 'none';
    if (input) {
        input.value = '';
    }
    if (inputCantidad) input