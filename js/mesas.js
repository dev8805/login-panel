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
    if (!mesasData[mesaId]) return;

    const esMismaMesa = mesaSeleccionadaId === mesaId;

    if (!esMismaMesa) {
        mesaSeleccionadaId = mesaId;
        document.querySelectorAll('.mesa-card.selected').forEach(card => card.classList.remove('selected'));
        const tarjeta = document.querySelector(`.mesa-card[data-mesa-id="${mesaId}"]`);
        if (tarjeta) tarjeta.classList.add('selected');
        actualizarPanelDetalle(mesaId);
    }

    // Mostrar bottom sheet en móvil/tablet
    if (window.innerWidth <= 1024) {
        const panel = document.getElementById('panelDetalleMesa');
        const overlay = document.getElementById('bottomSheetOverlay');
        if (panel) {
            panel.classList.remove('oculto');
        }
        if (overlay) {
            overlay.classList.add('visible');
        }
    }

    // Enfocar automáticamente el input del buscador (TODAS las pantallas)
    setTimeout(() => {
        const inputBuscador = document.getElementById(`buscar-${mesaId}`);
        if (inputBuscador) {
            inputBuscador.focus();
        }
    }, 100);
}

function actualizarPanelDetalle(mesaId, soloListaProductos = false) {
    const panel = document.getElementById('panelDetalleMesa');
    if (!panel) return;
    const mesa = mesaId ? mesasData[mesaId] : null;
    
    // Si solo queremos actualizar la lista de productos (optimización para móvil)
    if (soloListaProductos && mesa) {
        const detalleBody = panel.querySelector('.detalle-body');
        const detalleFooter = panel.querySelector('.detalle-footer');
        
        if (detalleBody) {
            const productosHTML = mesa.productos && mesa.productos.length > 0 ? generarHTMLProductos(mesa) : '';
            const estaOcupada = mesa.productos && mesa.productos.length > 0;
            
            const listaHTML = estaOcupada
                ? `<div class="productos-lista">${productosHTML}</div>`
                : `<div class="empty-state"><div class="empty-icon">--</div><div class="empty-text">Mesa vacía - agrega productos</div></div>`;
            
            detalleBody.innerHTML = listaHTML;
        }
        
        // Actualizar también el botón del footer con el total actualizado
        if (detalleFooter) {
            const totalMesa = mesa.productos?.reduce((sum, p) => sum + ((p.precio_unitario || p.precio || 0) * p.cantidad), 0) || 0;
            const btnRegistrar = detalleFooter.querySelector('.btn-primary');
            if (btnRegistrar) {
                btnRegistrar.textContent = `Registrar venta • ${totalMesa.toLocaleString('es-CO')}`;
            }
        }
    } else {
        // Actualización completa (regenerar todo el HTML)
        panel.innerHTML = renderizarDetalleMesa(mesa);
    }
}

function generarHTMLProductos(mesa) {
    if (!mesa.productos || mesa.productos.length === 0) return '';

    return mesa.productos.map((p, index) => `
        <div class="producto-item" style="display: flex; align-items: center; border-bottom: 1px solid #f1f5f9; padding: 6px 10px; background: #ffffff; gap: 6px;">
            <div class="producto-controls" style="display: flex; align-items: center; border: 1px solid #e2e8f0; border-radius: 4px; height: 22px; overflow: hidden; flex-shrink: 0; background: #f8fafc;">
                <div class="qty-btn qty-btn-minus" data-mesa-id="${mesa.id}" data-producto-index="${index}" data-action="ajustar-cantidad" data-delta="-1" style="width: 18px; height: 100%; background: transparent; cursor: pointer; font-size: 10px; color: #64748b; display: flex; align-items: center; justify-content: center; user-select: none;">−</div>
                <div class="qty-display" style="min-width: 20px; padding: 0 2px; height: 100%; text-align: center; font-weight: 700; font-size: 11px; display: flex; align-items: center; justify-content: center; color: #059669; background: white; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">${p.cantidad}</div>
                <div class="qty-btn qty-btn-plus" data-mesa-id="${mesa.id}" data-producto-index="${index}" data-action="ajustar-cantidad" data-delta="1" style="width: 18px; height: 100%; background: transparent; cursor: pointer; font-size: 10px; color: #64748b; display: flex; align-items: center; justify-content: center; user-select: none;">+</div>
            </div>
            <div class="producto-info" style="flex: 1; min-width: 0; overflow: hidden;">
                <span class="producto-nombre" style="font-size: 11px; color: #1e293b; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;">
                   ${p.unidad && p.unidad !== 'und' ? `<span style="color:#64748b; font-size:10px;">${p.unidad}</span> ` : ''}${p.nombre}
                </span>
            </div>
            <div style="font-weight: 600; font-size: 11px; color: #059669; white-space: nowrap; flex-shrink: 0;">
                ${((p.precio_unitario || p.precio || 0) * p.cantidad).toLocaleString('es-CO')}
            </div>
            <button class="delete-btn" data-mesa-id="${mesa.id}" data-producto-index="${index}" data-action="eliminar-producto" style="width: 20px; height: 20px; flex-shrink: 0; background: transparent; border: none; color: #cbd5e1; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px; padding: 0;" onmouseover="this.style.color='#ef4444';" onmouseout="this.style.color='#cbd5e1';">🗑️</button>
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
        <div class="detalle-header" style="flex-wrap: nowrap;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; flex: 1; min-width: 0;">
                <div class="detalle-titulo" style="flex-shrink: 0;">${mesa.nombre}</div>
                ${mesa.descripcion ? `<div style="padding: 3px 10px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 11px; font-weight: 500; color: #475569; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;">${mesa.descripcion}</div>` : ''}
            </div>
            ${estaOcupada ? `<span style="display: inline-flex; align-items: center; justify-content: center; width: 10px; height: 10px; background: #10b981; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);" title="Ocupada"></span>` : `<span style="display: inline-flex; align-items: center; justify-content: center; width: 10px; height: 10px; background: #cbd5e1; border-radius: 50%; flex-shrink: 0;" title="Libre"></span>`}
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
                <div class="buscar-producto" style="flex: 1; display: flex; gap: 6px; align-items: center; background: #f8fafc; padding: 6px 10px; border: 2px solid #e2e8f0; border-radius: 10px; height: 38px; transition: all 0.2s;" onfocus="this.style.borderColor='#6366f1'; this.style.boxShadow='0 0 0 3px rgba(99,102,241,0.1)';" onblur="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none';">
                    <div class="producto-controls" style="display: flex; align-items: center; border: 1px solid #e2e8f0; border-radius: 6px; height: 26px; background: white; flex-shrink: 0;">
                        <div class="qty-btn qty-btn-busqueda-minus" data-mesa-id="${mesa.id}" data-action="ajustar-busqueda" data-delta="-1" style="width: 24px; height: 100%; cursor: pointer; font-size: 12px; color: #64748b; display: flex; align-items: center; justify-content: center; user-select: none; transition: all 0.2s;" onmouseover="this.style.background='#6366f1'; this.style.color='white';" onmouseout="this.style.background='transparent'; this.style.color='#64748b';">−</div>
                        
                        <input type="number" class="cantidad-input" id="cantidad-buscar-${mesa.id}" value="1" min="1" data-mesa-id="${mesa.id}" data-action="validar-cantidad-busqueda" style="width: 28px; height: 100%; text-align: center; padding: 0; border: none; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; font-size: 12px; font-weight: 700; outline: none; -moz-appearance: textfield; background: white; color: #059669;">
                        
                        <div class="qty-btn qty-btn-busqueda-plus" data-mesa-id="${mesa.id}" data-action="ajustar-busqueda" data-delta="1" style="width: 24px; height: 100%; cursor: pointer; font-size: 12px; color: #64748b; display: flex; align-items: center; justify-content: center; user-select: none; transition: all 0.2s;" onmouseover="this.style.background='#6366f1'; this.style.color='white';" onmouseout="this.style.background='transparent'; this.style.color='#64748b';">+</div>
                    </div>
                    
                    <input type="text" class="buscar-input input-producto-buscar" id="buscar-${mesa.id}" placeholder="Buscar producto..." 
                        style="flex: 1; padding: 6px 8px; border: none; background: transparent; font-size: 13px; font-weight: 500; outline: none; color: #1e293b;">
                </div>
                
                <button class="btn-grabar-voz" data-mesa-id="${mesa.id}" data-action="grabar-voz" style="background: linear-gradient(135deg, #5B7FFF 0%, #4A63CC 100%); border: none; cursor: pointer; padding: 0; display: flex; align-items: center; justify-content: center; color: white; width: 38px; height: 38px; border-radius: 10px; transition: all 0.2s; box-shadow: 0 4px 10px rgba(91, 127, 255, 0.25);" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 14px rgba(91,127,255,0.35)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 10px rgba(91,127,255,0.25)';">
                    <span style="font-size: 18px;">🎤</span>
                </button>
            </div>
            <div id="resultados-busqueda-${mesa.id}" style="display: none; position: absolute; bottom: 100%; left: 0; right: 0; z-index: 9999; background: #ffffff; border: 2px solid #e2e8f0; border-radius: 12px; max-height: 300px; overflow-y: auto; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12); margin-bottom: 4px;"></div>
        </div>
    `;
}

function actualizarPreviewMesa(mesaId, mesa) {
    calcularTotalesMesa(mesa);

    const cardElement = document.querySelector(`.mesa-card[data-mesa-id="${mesaId}"]`);
    if (!cardElement) return;

    const estaOcupada = mesa.totalProductos > 0;

    // Actualizar clase 'ocupada'
    if (estaOcupada) {
        cardElement.classList.add('ocupada');
    } else {
        cardElement.classList.remove('ocupada');
    }

    // Actualizar mesa-header completo
    const headerElement = cardElement.querySelector('.mesa-header');
    if (headerElement) {
        headerElement.innerHTML = `
            <span class="mesa-nombre">${mesa.nombre}</span>
            ${estaOcupada ? `<span class="mesa-total">${mesa.totalMonto.toLocaleString('es-CO')}</span>` : ''}
            ${!estaOcupada ? `<button class="btn-delete-mesa" onclick="event.stopPropagation(); eliminarMesa('${mesaId}')">&times;</button>` : ''}
        `;
    }

    // Actualizar chip de descripción
    const descripcionElement = document.querySelector(`.mesa-descripcion-${mesaId}`);
    if (descripcionElement) {
        if (mesa.descripcion && mesa.descripcion.trim() !== '') {
            descripcionElement.textContent = mesa.descripcion;
            descripcionElement.classList.remove('placeholder');
            descripcionElement.style.display = 'inline-flex';
        } else {
            // Si no hay descripción, mostrar el placeholder
            descripcionElement.textContent = 'Descripción';
            descripcionElement.classList.add('placeholder');
            descripcionElement.style.display = 'inline-flex';
        }
    } else {
        // Si no existe el chip, crearlo
        if (cardElement) {
            const chip = document.createElement('div');
            chip.className = `mesa-descripcion-chip mesa-descripcion-${mesaId}`;

            if (mesa.descripcion && mesa.descripcion.trim()) {
                chip.textContent = mesa.descripcion;
            } else {
                chip.textContent = 'Descripción';
                chip.classList.add('placeholder');
            }

            chip.onclick = (event) => {
                event.stopPropagation();
                editarDescripcionMesa(mesaId);
            };
            cardElement.appendChild(chip);
        }
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

    const cardElement = document.querySelector(`.mesa-card[data-mesa-id="${mesaId}"]`);
    if (!cardElement) return;

    let chip = cardElement.querySelector(`.mesa-descripcion-${mesaId}`);

    // Si no existe el chip, crearlo
    if (!chip) {
        chip = document.createElement('div');
        chip.className = `mesa-descripcion-chip mesa-descripcion-${mesaId}`;
        cardElement.appendChild(chip);
    }

    if (chip.dataset.editing === 'true') return;

    // Añadir clase de edición a la card
    cardElement.classList.add('editando-descripcion');

    chip.dataset.editing = 'true';
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
        cardElement.classList.remove('editando-descripcion');
        actualizarPreviewMesa(mesaId, mesa);
    };

    btnCancelar.addEventListener('click', (event) => {
        event.stopPropagation();
        restaurarChip();
    });

    btnGuardar.addEventListener('click', async (event) => {
        event.stopPropagation();
        mesa.descripcion = input.value.trim();
        await guardarMesa(mesaId);  // ← Solo guarda esta mesa
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

    mesa.productos[productoIndex].cantidad += delta;
    if (mesa.productos[productoIndex].cantidad <= 0) {
        mesa.productos.splice(productoIndex, 1);
    }
    guardarMesa(mesaId);

    if (mesaSeleccionadaId === mesaId) {
        const panel = document.getElementById('panelDetalleMesa');
        const detalleBody = panel?.querySelector('.detalle-body');
        const scrollPos = detalleBody?.scrollTop || 0;
        
        // OPTIMIZACIÓN: Solo actualizar lista, no regenerar buscador
        actualizarPanelDetalle(mesaId, true);
        
        // Restaurar scroll
        if (detalleBody) {
            const nuevoDetalleBody = panel.querySelector('.detalle-body');
            if (nuevoDetalleBody) nuevoDetalleBody.scrollTop = scrollPos;
        }
    }
    actualizarPreviewMesa(mesaId, mesa);
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

    mesa.productos.splice(productoIndex, 1);
    guardarMesa(mesaId);

    if (mesaSeleccionadaId === mesaId) {
        const panel = document.getElementById('panelDetalleMesa');
        const detalleBody = panel?.querySelector('.detalle-body');
        const scrollPos = detalleBody?.scrollTop || 0;
        
        // OPTIMIZACIÓN: Solo actualizar lista, no regenerar buscador
        actualizarPanelDetalle(mesaId, true);
        
        // Restaurar scroll
        if (detalleBody) {
            const nuevoDetalleBody = panel.querySelector('.detalle-body');
            if (nuevoDetalleBody) nuevoDetalleBody.scrollTop = scrollPos;
        }
    }

    actualizarPreviewMesa(mesaId, mesa);
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
                    await guardarMesa(mesaId);  // ← Solo guarda esta mesa
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

    guardarMesa(mesaId);  // ← Solo guarda esta mesa

    const input = document.getElementById(`buscar-${mesaId}`);
    const resultadosDiv = document.getElementById(`resultados-busqueda-${mesaId}`);

    if (resultadosDiv) resultadosDiv.style.display = 'none';
    if (input) {
        input.value = '';
    }
    if (inputCantidad) inputCantidad.value = '1';

    if (mesaSeleccionadaId === mesaId) {
        // Guardar posición de scroll
        const panel = document.getElementById('panelDetalleMesa');
        const detalleBody = panel?.querySelector('.detalle-body');
        const scrollPos = detalleBody?.scrollTop || 0;
        
        // OPTIMIZACIÓN: Solo actualizar la lista de productos, NO regenerar el buscador
        // Esto evita que el input pierda el foco y el teclado se oculte
        actualizarPanelDetalle(mesaId, true);
        
        // Restaurar posición de scroll
        if (detalleBody) {
            const nuevoDetalleBody = panel.querySelector('.detalle-body');
            if (nuevoDetalleBody) {
                nuevoDetalleBody.scrollTop = scrollPos;
            }
        }
    }

    actualizarPreviewMesa(mesaId, mesa);
}

async function registrarVentaMesa(mesaId) {
    const mesa = mesasData[mesaId];
    if (!mesa || !mesa.productos || mesa.productos.length === 0) {
        alert('La mesa no tiene productos');
        return;
    }
    if (!confirm(`¿Registrar venta de ${mesa.nombre}?`)) return;

    try {
        const mensaje = mesa.productos.map(p => `"${p.codigo}" ${p.cantidad}`).join(', ');
        const response = await fetch('https://n8n-n8n.aa7tej.easypanel.host/webhook/chat-panel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mensaje: mensaje,
                tipo: 'texto',
                usuario: userData.nombre,
                tenant_id: userData.tenant_id,
                user_id: userData.user_id,
                sessionid: `mesa_${mesaId}`,
                mesa_id: mesaId,
                mesa_nombre: mesa.nombre
            })
        });
        const data = await response.json();
        const respuestaFinal = Array.isArray(data) ? data[0] : data;

        if (respuestaFinal && (respuestaFinal.mensaje || respuestaFinal.respuesta)) {
            const mensajeConfirmacion = respuestaFinal.mensaje || respuestaFinal.respuesta || 'Venta registrada correctamente';
            await guardarHistorialMesa(mesa, data);
            alert(mensajeConfirmacion);

            mesa.productos = [];
            mesa.descripcion = mesa.descripcion || '';
            await guardarMesas();

            if (mesaSeleccionadaId === mesaId) {
                actualizarPanelDetalle(mesaId);
            }
            actualizarPreviewMesa(mesaId, mesa);
        } else {
            alert('Error: El servidor no devolvió una confirmación válida');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al registrar la venta: ' + error.message);
    }
}

async function guardarHistorialMesa(mesa, dataVenta) {
    try {
        const total = mesa.productos.reduce((sum, p) => sum + (p.precio * p.cantidad), 0);
        await supabase.from('historial_ventas_mesas').insert({
            tenant_id: userData.tenant_id,
            mesa_id: null,
            mesa_nombre: mesa.nombre,
            productos: mesa.productos,
            total: total,
            usuario: userData.nombre,
            venta_id: dataVenta.venta_id || null
        });
    } catch (error) { console.error('Error:', error); }
}

// CONTINUACIÓN DEL ARCHIVO mesas.js desde la función buscarProductoMesa

function buscarProductoMesa(mesaId, inputElement) {
    const input = inputElement || document.getElementById(`buscar-${mesaId}`);
    const resultadosDiv = document.getElementById(`resultados-busqueda-${mesaId}`);

    if (!input || !resultadosDiv) {
        console.error('❌ No se encontró input o resultadosDiv para mesa:', mesaId);
        return;
    }

    // Resetear índice de sugerencia seleccionada al escribir
    sugerenciaSeleccionadaIndex = -1;

    const termino = input.value.trim().toLowerCase();

    if (termino.length === 0) {
        resultadosDiv.style.display = 'none';
        return;
    }

    console.log('🔍 Buscando:', termino);
    console.log('📦 Total productos disponibles:', productosDataMesas.length);

    const filtrados = productosDataMesas.filter(p => {
        const nombreMatch = p.producto && p.producto.toLowerCase().includes(termino);
        const codigoMatch = p.codigo && p.codigo.toLowerCase().includes(termino);
        const apodosMatch = p.apodos_input && p.apodos_input.toLowerCase().includes(termino);
        return nombreMatch || codigoMatch || apodosMatch;
    }).slice(0, 4);

    console.log('✅ Productos encontrados:', filtrados.length);

    if (filtrados.length === 0) {
        resultadosDiv.innerHTML = `
            <div style="padding: 16px; text-align: center; color: #94a3b8;">
                No se encontraron productos
            </div>
        `;
        resultadosDiv.style.display = 'block';
        return;
    }

    resultadosDiv.innerHTML = filtrados.map(p => `
        <div class="resultado-producto-item" 
             data-mesa-id="${mesaId}" 
             data-producto='${JSON.stringify(p)}'
             style="padding: 12px 14px; border-bottom: 1px solid #f1f5f9; cursor: pointer; background: #ffffff; transition: background 0.15s;" 
             onmouseover="this.style.background='#f8fafc'" 
             onmouseout="this.style.background='#ffffff'">
            <div style="font-weight: 600; font-size: 13px; color: #1e293b; margin-bottom: 2px;">
                <span style="color: #6366f1; font-size: 11px;">[${p.codigo}]</span> ${p.producto}
            </div>
            <div style="font-size: 13px; color: #059669; font-weight: 600;">
                ${parseFloat(p.precio_venta).toLocaleString('es-CO')}
            </div>
        </div>
    `).join('');

    resultadosDiv.style.display = 'block';
}

function validarCantidadBusqueda(mesaId) {
    const input = document.getElementById(`cantidad-buscar-${mesaId}`);
    if (!input) return;
    let cantidad = parseInt(input.value) || 1;
    if (cantidad < 1) cantidad = 1;
    input.value = cantidad;
}

async function abrirHistorialMesas() {
    const modalBody = document.getElementById('modalBodyMesas');
    modalBody.innerHTML = '<div style="padding: 20px; text-align: center;"><p>Cargando historial...</p></div>';
    try {
        const { data: historial, error } = await supabase
            .from('historial_ventas_mesas')
            .select('*')
            .eq('tenant_id', userData.tenant_id)
            .order('created_at', { ascending: false })
            .limit(50);
        if (error) throw error;

        if (!historial || historial.length === 0) {
            modalBody.innerHTML = `
                <div style="padding: 40px; text-align: center; background: #1f2230; min-height: 400px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <p style="font-size: 48px; margin-bottom: 10px;">📋</p>
                    <p style="color: #94a3b8;">No hay historial de ventas</p>
                    <button onclick="volverAMesas()" style="margin-top: 20px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer; transition: all 0.15s;" onmouseover="this.style.background='#5568d3';" onmouseout="this.style.background='#667eea';">← Volver a Mesas</button>
                </div>
            `;
            return;
        }

        const historialHTML = historial.map(registro => {
            const fecha = formatearFechaCorto(registro.created_at);
            const abreviarUnidad = (unidad) => {
                const abreviaturas = { 'unidades': 'und', 'unidad': 'und', 'libras': 'lbs', 'kilogramos': 'kg', 'gramos': 'g', 'metros': 'm', 'centimetros': 'cm', 'milimetros': 'mm', 'litros': 'L', 'mililitros': 'ml' };
                return abreviaturas[unidad?.toLowerCase()] || unidad || 'und';
            };
            const productosTexto = registro.productos.map(p => `${p.cantidad} ${abreviarUnidad(p.unidad)} ${p.nombre}`).join(', ');

            return `
                <div style="background: #2d3142; border: 2px solid #3a3f54; border-radius: 12px; padding: 16px; margin-bottom: 12px; transition: all 0.15s;" onmouseover="this.style.borderColor='#4a5568';" onmouseout="this.style.borderColor='#3a3f54';">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                        <div>
                            <div style="font-weight: 700; font-size: 16px; color: #e8eaf0;">${registro.mesa_nombre}</div>
                            <div style="font-size: 12px; color: #94a3b8;">${fecha}</div>
                        </div>
                        <div style="font-weight: 700; font-size: 18px; color: #10b981;">${parseFloat(registro.total).toLocaleString('es-CO')}</div>
                    </div>
                    <div style="font-size: 13px; color: #94a3b8; margin-bottom: 4px;">${productosTexto}</div>
                    <div style="font-size: 12px; color: #6b7280;">${registro.productos.length} items • ${registro.usuario || 'Usuario'}</div>
                </div>
            `;
        }).join('');

        modalBody.innerHTML = `
            <div class="mesas-container" style="background: #1f2230; min-height: 100vh;">
                <div class="mesas-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; background: #242838; padding: 16px; border-radius: 12px; border: 1px solid #2d3142;">
                    <button onclick="volverAMesas()" style="background: #667eea; color: white; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-size: 14px; width: auto; min-width: auto; transition: all 0.15s;" onmouseover="this.style.background='#5568d3';" onmouseout="this.style.background='#667eea';">← Mesas</button>
                    <h3 style="margin: 0; flex: 1; text-align: center; color: #e8eaf0;">📋 Historial</h3>
                    <div style="width: 75px;"></div>
                </div>
                <div style="padding: 16px;">${historialHTML}</div>
            </div>
        `;
    } catch (error) {
        console.error('Error cargando historial:', error);
        modalBody.innerHTML = '<div style="padding: 40px; text-align: center; background: #1f2230; min-height: 400px; display: flex; flex-direction: column; align-items: center; justify-content: center;"><p style="color: #ef4444;">Error al cargar el historial</p><button onclick="volverAMesas()" style="margin-top: 20px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer; transition: all 0.15s;" onmouseover="this.style.background=\'#5568d3\';" onmouseout="this.style.background=\'#667eea\';">← Volver a Mesas</button></div>';
    }
}

// ==============================================
// DESLIZAMIENTO MÓVIL
// ==============================================

let startY = 0;
let currentY = 0;
let isDragging = false;
let panelDerecho = null;

function inicializarDeslizamientoMovil() {
    // Solo en móvil (pantallas menores a 1024px)
    if (window.innerWidth >= 1024) return;

    panelDerecho = document.getElementById('panelDetalleMesa');
    if (!panelDerecho) return;

    // Añadir clase inicial
    panelDerecho.classList.add('oculto');

    // Touch events
    panelDerecho.addEventListener('touchstart', handleTouchStartDrag, { passive: false });
    panelDerecho.addEventListener('touchmove', handleTouchMoveDrag, { passive: false });
    panelDerecho.addEventListener('touchend', handleTouchEndDrag);

    // Click en el handle para alternar
    panelDerecho.addEventListener('click', (e) => {
        const rect = panelDerecho.getBoundingClientRect();
        // Si el click es en los primeros 40px (zona del handle)
        if (e.clientY - rect.top < 40) {
            panelDerecho.classList.toggle('oculto');
        }
    });
}

function handleTouchStartDrag(e) {
    if (window.innerWidth >= 1024) return;

    const touch = e.touches[0];
    const rect = panelDerecho.getBoundingClientRect();

    // Solo permitir arrastre desde los primeros 40px (zona del handle)
    if (touch.clientY - rect.top <= 40) {
        startY = touch.clientY;
        isDragging = true;
        panelDerecho.classList.add('dragging');
        panelDerecho.style.transition = 'none';
    }
}

function handleTouchMoveDrag(e) {
    if (!isDragging || window.innerWidth >= 1024) return;

    e.preventDefault();
    const touch = e.touches[0];
    currentY = touch.clientY;

    const deltaY = currentY - startY;

    // Solo permitir deslizar hacia abajo
    if (deltaY > 0) {
        const translateY = panelDerecho.classList.contains('oculto')
            ? `calc(100% - 60px + ${deltaY}px)`
            : `${deltaY}px`;
        panelDerecho.style.transform = `translateY(${translateY})`;
    }
}

function handleTouchEndDrag(e) {
    if (!isDragging || window.innerWidth >= 1024) return;

    isDragging = false;
    panelDerecho.classList.remove('dragging');
    panelDerecho.style.transition = '';
    panelDerecho.style.transform = '';

    const deltaY = currentY - startY;
    const overlay = document.getElementById('bottomSheetOverlay');

    // Si deslizó más de 80px hacia abajo, ocultar
    // Si deslizó más de 80px hacia arriba, mostrar
    if (deltaY > 80) {
        panelDerecho.classList.add('oculto');
        if (overlay) overlay.classList.remove('visible');
    } else if (deltaY < -80) {
        panelDerecho.classList.remove('oculto');
        if (overlay) overlay.classList.add('visible');
    }

    startY = 0;
    currentY = 0;
}

function volverAMesas() {
    const modalBody = document.getElementById('modalBodyMesas');
    renderizarMesas(modalBody);

    // Reinicializar deslizamiento si estamos en móvil
    setTimeout(() => {
        inicializarDeslizamientoMovil();
    }, 100);
}