/**
 * ==========================================
 * SISTEMA DE MESAS (CORREGIDO - SIN OCULTAR TECLADO)
 * ===========================================
 * PROBLEMA RESUELTO: El teclado ya no se oculta al:
 * - Agregar productos
 * - Ajustar cantidades
 * - Eliminar productos
 * 
 * SOLUCIÓN: Preservar el foco del input del buscador
 * después de actualizar la lista de productos
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

// Índice de sugerencia seleccionada para navegación por teclado
let sugerenciaSeleccionadaIndex = -1;

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

// Guardar UNA SOLA mesa en Supabase (para evitar actualizaciones innecesarias)
async function guardarMesa(mesaId) {
    try {
        const mesa = mesasData[mesaId];
        if (!mesa) return;

        const { error } = await supabase
            .from('mesas_activas')
            .upsert([{
                tenant_id: userData.tenant_id,
                mesa_id: mesa.id,
                nombre: mesa.nombre,
                descripcion: mesa.descripcion || '',
                productos: mesa.productos || [],
                updated_at: getTimestampTenant()
            }], {
                onConflict: 'tenant_id,mesa_id'
            });
        if (error) throw error;

        // Actualizar mapeo local para esta mesa
        const { data: mesaActualizada } = await supabase
            .from('mesas_activas')
            .select('id, mesa_id')
            .eq('tenant_id', userData.tenant_id)
            .eq('mesa_id', mesaId)
            .single();

        if (mesaActualizada) {
            window.mesaIdMap[mesaActualizada.id] = mesaActualizada.mesa_id;
        }
    } catch (error) {
        console.error('❌ Error guardando mesa:', error);
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
                    // Solo agregar la nueva mesa, no recargar todo
                    if (payload.new) {
                        mesasData[mesaModificadaId] = {
                            id: payload.new.mesa_id,
                            nombre: payload.new.nombre,
                            descripcion: payload.new.descripcion || '',
                            productos: payload.new.productos || [],
                            createdAt: payload.new.created_at
                        };
                        // Actualizar el mapeo
                        window.mesaIdMap[payload.new.id] = payload.new.mesa_id;
                    }
                    const modalBody = document.getElementById('modalBodyMesas');
                    renderizarMesas(modalBody);
                }
                else if (payload.eventType === 'DELETE') {
                    delete mesasData[mesaModificadaId];
                    const modalBody = document.getElementById('modalBodyMesas');
                    renderizarMesas(modalBody);
                } else if (payload.eventType === 'UPDATE') {
                    // Solo actualizar la mesa modificada, no recargar todo
                    if (payload.new) {
                        mesasData[mesaModificadaId] = {
                            id: payload.new.mesa_id,
                            nombre: payload.new.nombre,
                            descripcion: payload.new.descripcion || '',
                            productos: payload.new.productos || [],
                            createdAt: payload.new.created_at
                        };
                    }
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
    modalBody.removeEventListener('keydown', handleKeyboardNavigation);

    // Agregar nuevos listeners
    modalBody.addEventListener('input', handleSearchInput);
    modalBody.addEventListener('change', handleChangeInput);
    modalBody.addEventListener('click', handleClickActions);
    modalBody.addEventListener('mousedown', handleMouseDown);
    modalBody.addEventListener('mouseup', handleMouseUp);
    modalBody.addEventListener('mouseleave', handleMouseLeave);
    modalBody.addEventListener('touchstart', handleTouchStart);
    modalBody.addEventListener('touchend', handleTouchEnd);
    modalBody.addEventListener('keydown', handleKeyboardNavigation);

    console.log('✅ Event listeners configurados con delegación');
    console.log('═══════════════════════════════════════');

    suscribirseACambiosMesas();
    setTimeout(() => {
        if (!canalMesas || canalMesas.state !== 'joined') {
            iniciarPollingMesas();
        }
    }, 5000);

    // Inicializar deslizamiento móvil
    setTimeout(() => {
        inicializarDeslizamientoMovil();
    }, 100);
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

// Handler para navegación por teclado en el buscador (solo desktop)
function handleKeyboardNavigation(e) {
    const target = e.target;

    // Solo actuar si el foco está en el input de búsqueda de productos
    if (!target || !target.classList.contains('input-producto-buscar')) return;

    // Solo en desktop (pantallas mayores a 1024px)
    if (window.innerWidth < 1024) return;

    const inputId = target.id;
    const mesaId = inputId.replace('buscar-', '');
    const resultadosDiv = document.getElementById(`resultados-busqueda-${mesaId}`);
    const items = resultadosDiv ? resultadosDiv.querySelectorAll('.resultado-producto-item') : [];

    switch (e.key) {
        case 'ArrowLeft':
            // Ajustar cantidad hacia abajo
            e.preventDefault();
            ajustarCantidadBusqueda(mesaId, -1);
            break;

        case 'ArrowRight':
            // Ajustar cantidad hacia arriba
            e.preventDefault();
            ajustarCantidadBusqueda(mesaId, 1);
            break;

        case 'ArrowDown':
            // Navegar a la siguiente sugerencia
            e.preventDefault();
            if (resultadosDiv && resultadosDiv.style.display !== 'none' && items.length > 0) {
                // Remover selección anterior
                items.forEach(item => item.classList.remove('sugerencia-seleccionada'));

                // Incrementar índice
                sugerenciaSeleccionadaIndex++;
                if (sugerenciaSeleccionadaIndex >= items.length) {
                    sugerenciaSeleccionadaIndex = 0;
                }

                // Marcar nuevo item seleccionado
                const itemSeleccionado = items[sugerenciaSeleccionadaIndex];
                if (itemSeleccionado) {
                    itemSeleccionado.classList.add('sugerencia-seleccionada');
                    itemSeleccionado.scrollIntoView({ block: 'nearest' });
                }
            }
            break;

        case 'ArrowUp':
            // Navegar a la sugerencia anterior
            e.preventDefault();
            if (resultadosDiv && resultadosDiv.style.display !== 'none' && items.length > 0) {
                // Remover selección anterior
                items.forEach(item => item.classList.remove('sugerencia-seleccionada'));

                // Decrementar índice
                sugerenciaSeleccionadaIndex--;
                if (sugerenciaSeleccionadaIndex < 0) {
                    sugerenciaSeleccionadaIndex = items.length - 1;
                }

                // Marcar nuevo item seleccionado
                const itemSeleccionado = items[sugerenciaSeleccionadaIndex];
                if (itemSeleccionado) {
                    itemSeleccionado.classList.add('sugerencia-seleccionada');
                    itemSeleccionado.scrollIntoView({ block: 'nearest' });
                }
            }
            break;

        case 'Enter':
            // Seleccionar producto si hay una sugerencia seleccionada
            e.preventDefault();
            if (resultadosDiv && resultadosDiv.style.display !== 'none' && items.length > 0) {
                let itemParaSeleccionar = null;

                // Si hay una sugerencia seleccionada por teclado, usar esa
                if (sugerenciaSeleccionadaIndex >= 0 && sugerenciaSeleccionadaIndex < items.length) {
                    itemParaSeleccionar = items[sugerenciaSeleccionadaIndex];
                }
                // Si no, seleccionar la primera sugerencia
                else if (items.length > 0) {
                    itemParaSeleccionar = items[0];
                }

                if (itemParaSeleccionar) {
                    const producto = JSON.parse(itemParaSeleccionar.dataset.producto);
                    seleccionarProductoMesa(mesaId, producto);
                    sugerenciaSeleccionadaIndex = -1; // Resetear índice
                }
            }
            break;

        case 'Escape':
            // Cerrar sugerencias
            if (resultadosDiv) {
                resultadosDiv.style.display = 'none';
                sugerenciaSeleccionadaIndex = -1;
            }
            break;
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
        const estaSeleccionada = mesaSeleccionadaId === mesa.id;

        return `
            <div class="mesa-card ${estaOcupada ? 'ocupada' : ''} ${estaSeleccionada ? 'selected' : ''}" data-mesa-id="${mesa.id}" onclick="seleccionarMesa('${mesa.id}')">
                <div class="mesa-header">
                    <span class="mesa-nombre">${mesa.nombre}</span>
                    ${estaOcupada ? `<span class="mesa-total">${mesa.totalMonto.toLocaleString('es-CO')}</span>` : ''}
                    ${!estaOcupada ? `<button class="btn-delete-mesa" onclick="event.stopPropagation(); eliminarMesa('${mesa.id}')">&times;</button>` : ''}
                </div>
                ${!mesa.descripcion || !mesa.descripcion.trim() ?
                `<div class="mesa-descripcion-chip placeholder mesa-descripcion-${mesa.id}" onclick="event.stopPropagation(); editarDescripcionMesa('${mesa.id}')">Descripción</div>` :
                `<div class="mesa-descripcion-chip mesa-descripcion-${mesa.id}" onclick="event.stopPropagation(); editarDescripcionMesa('${mesa.id}')">${mesa.descripcion}</div>`
            }
            </div>
        `;
    }).join('') + tarjetaNuevaMesa;

    // Inyectar controles en el header del modal
    const modalHeader = document.querySelector('#modalMesas .modal-header');
    if (modalHeader) {
        // Remover controles previos si existen
        const existingControls = modalHeader.querySelector('.mesas-header-controls');
        if (existingControls) existingControls.remove();

        // Crear nuevos controles
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'mesas-header-controls';
        controlsDiv.style.cssText = 'display: flex; align-items: center; gap: 10px; margin-left: auto; margin-right: 12px;';
        controlsDiv.innerHTML = `
            <div class="status-badge" id="estadoMesasBadge" style="font-size: 11px; padding: 4px 10px;">
                ${canalMesas && canalMesas.state === 'joined' ? 'Tiempo real activo' : pollingInterval ? 'Modo polling (3s)' : 'Desconectado'}
            </div>
            <button onclick="abrirHistorialMesas()" class="btn-historial" style="padding: 4px 10px; font-size: 11px; min-height: auto;">
                Historial
            </button>
        `;
        modalHeader.insertBefore(controlsDiv, modalHeader.querySelector('.modal-close'));
    }

    const detalleHTML = renderizarDetalleMesa(mesaSeleccionadaId ? mesasData[mesaSeleccionadaId] : null);

    modalBody.innerHTML = `
        <div class="modal-mesas-layout mesas-split-layout">
            <div class="bottom-sheet-overlay" id="bottomSheetOverlay"></div>
            <div class="mesas-panel mesas-panel-izquierdo">
                <div class="mesa-grid modal-mesas-grid">
                    ${mesasHTML}
                </div>
            </div>
            <div class="mesas-panel mesas-panel-derecho" id="panelDetalleMesa">
                <div class="bottom-sheet-handle" id="bottomSheetHandle"></div>
                ${detalleHTML}
            </div>
        </div>
    `;

    // Configurar overlay para cerrar bottom sheet
    const overlay = document.getElementById('bottomSheetOverlay');
    if (overlay) {
        overlay.addEventListener('click', () => {
            const panel = document.getElementById('panelDetalleMesa');
            if (panel) {
                panel.classList.add('oculto');
                overlay.classList.remove('visible');
            }
        });
    }

    setTimeout(() => { actualizarIndicadorEstado(); }, 100);
}

function seleccionarMesa(mesaId) {
