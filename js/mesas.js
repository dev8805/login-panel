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

// Inicializar mesas desde Supabase
async function inicializarMesas() {
    try {
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
            updated_at: new Date().toISOString()
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

// Suscribirse a cambios en tiempo real (CON ACTUALIZACIÓN INTELIGENTE)
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
                // ID de la mesa afectada
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
                    
                    const detalleExpandido = document.getElementById(`detalle-${mesaModificadaId}`);
                    const estaExpandida = detalleExpandido?.classList.contains('expanded');

                    if (estaExpandida) {
                        const mesa = mesasData[mesaModificadaId];
                        if (mesa) {
                            // --- LÓGICA INTELIGENTE PARA NO CERRAR TECLADO ---
                            const listaExistente = detalleExpandido.querySelector('.productos-list');
                            const botonTotal = detalleExpandido.querySelector('.btn-registrar-venta-mesa');
                            const inputBuscador = document.getElementById(`buscar-${mesaModificadaId}`);
                            const teniaFoco = (document.activeElement === inputBuscador);

                            if (listaExistente && botonTotal && inputBuscador) {
                                // Regenerar solo items
                                const productosHTML = generarHTMLProductos(mesa);
                                listaExistente.innerHTML = productosHTML;
                                
                                // Actualizar total
                                const total = mesa.productos.reduce((sum, p) => sum + ((p.precio_unitario || p.precio || 0) * p.cantidad), 0);
                                botonTotal.innerText = `Registrar venta • $${total.toLocaleString('es-CO')}`;
                                
                                // Restaurar foco si es necesario
                                if(teniaFoco) {
                                    setTimeout(() => inputBuscador.focus(), 0);
                                }
                            } else {
                                // Fallback: Renderizado completo
                                detalleExpandido.innerHTML = renderizarDetalleMesa(mesa);
                                if(teniaFoco) {
                                    setTimeout(() => {
                                        const nuevoInput = document.getElementById(`buscar-${mesaModificadaId}`);
                                        if(nuevoInput) nuevoInput.focus();
                                    }, 10);
                                }
                            }
                            
                            actualizarPreviewMesa(mesaModificadaId, mesa);
                        }
                    } else {
                        const mesa = mesasData[mesaModificadaId];
                        if (mesa) actualizarPreviewMesa(mesaModificadaId, mesa);
                    }
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
        } catch (error) {}
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
            const enHistorial = modalBody && modalBody.innerHTML.includes('📋 Historial');
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

    suscribirseACambiosMesas();
    setTimeout(() => {
        if (!canalMesas || canalMesas.state !== 'joined') {
            iniciarPollingMesas();
        }
    }, 5000);
}

function closeModalMesas() {
    document.getElementById('modalMesas').classList.remove('show');
    if (canalMesas) {
        try { canalMesas.unsubscribe(); } catch (e) {}
        canalMesas = null;
    }
    detenerPollingMesas();
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}

function actualizarIndicadorEstado() {
    const indicador = document.querySelector('.mesas-header > div:first-child');
    if (!indicador) return;
    const estaConectado = canalMesas && canalMesas.state === 'joined';
    const estaPolling = !!pollingInterval;
    
    let background, border, color, texto;
    if (estaConectado) {
        background = '#10b98115'; border = '#10b981'; color = '#10b981'; texto = '🟢 Tiempo Real Activo';
    } else if (estaPolling) {
        background = '#f59e0b15'; border = '#f59e0b'; color = '#f59e0b'; texto = '🟡 Modo Polling (3s)';
    } else {
        background = '#ef444415'; border = '#ef4444'; color = '#ef4444'; texto = '🔴 Desconectado';
    }
    
    indicador.style.background = background;
    indicador.style.borderColor = border;
    indicador.style.color = color;
    indicador.textContent = texto;
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

    const tarjetaNuevaMesa = `
        <div class="mesa-card" style="background: white; border: 2px dashed #667eea; border-radius: 12px; cursor: pointer; transition: all 0.3s; margin-bottom: 12px; overflow: hidden; min-height: 95px;"
            onclick="crearNuevaMesa()" onmouseover="this.style.borderColor='#764ba2'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(102, 126, 234, 0.2)';"
            onmouseout="this.style.borderColor='#667eea'; this.style.transform='translateY(0)'; this.style.boxShadow='none';">
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; min-height: 95px;">
                <div style="font-size: 48px; color: #667eea;">+</div>
            </div>
        </div>
    `;
    const mesasHTML = mesasArray.map(mesa => {
        const estaOcupada = mesa.totalProductos > 0;
        const productosPreview = mesa.productos && mesa.productos.length > 0 ? 
            mesa.productos.map(p => `${p.cantidad} ${p.nombre}`).slice(0, 2).join(', ') + (mesa.productos.length > 2 ? '...' : '') : 'Vacía';
        
        return `
            <div class="mesa-card ${estaOcupada ? 'ocupada' : ''}" style="background: white; border: 2px solid ${estaOcupada ? '#10b981' : '#e0e0e0'}; border-radius: 12px; margin-bottom: 12px; overflow: hidden;">
                <div class="mesa-header-row" onclick="toggleMesa('${mesa.id}')" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; cursor: pointer; background: #f9fafb;">
                    <div class="mesa-info" style="flex: 1; min-width: 0;">
                        <div class="mesa-nombre-row">
                            <div class="mesa-nombre" style="font-size: 16px; font-weight: 700; color: #333;">${mesa.nombre}</div>
                            <div class="mesa-descripcion-chip mesa-descripcion-${mesa.id} ${mesa.descripcion ? '' : 'is-empty'}">${mesa.descripcion || ''}</div>
                            <button onclick="event.stopPropagation(); editarDescripcionMesa('${mesa.id}')" class="mesa-edit-btn mesa-edit-btn-${mesa.id}" data-mesa-id="${mesa.id}" title="Editar descripción" aria-label="Editar descripción de ${mesa.nombre}">✏️</button>
                        </div>
                        <div class="mesa-productos-preview mesa-preview-${mesa.id}" style="font-size: 12px; color: #666; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${productosPreview}</div>
                        <div class="mesa-resumen mesa-resumen-${mesa.id}" style="display: flex; gap: 10px; font-size: 12px; color: #888;">
                            <span>${mesa.totalProductos} items</span>
                            <span style="color: #10b981; font-weight: 600;">$${mesa.totalMonto.toLocaleString('es-CO')}</span>
                        </div>
                    </div>
                    <div class="mesa-actions" style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                        <div class="mesa-estado ${estaOcupada ? 'ocupada' : 'libre'}" style="font-weight: 600; font-size: 12px; color: ${estaOcupada ? '#10b981' : '#9ca3af'};">
                            ${estaOcupada ? '🟢' : '⚪'}
                        </div>
                        ${!estaOcupada ? `<button onclick="event.stopPropagation(); eliminarMesa('${mesa.id}')" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 20px; padding: 4px; display: flex; align-items: center; justify-content: center; min-width: auto; width: auto;">×</button>` : ''}
                        <span style="font-size: 18px; color: #999;">➜</span>
                    </div>
                </div>
                <div class="mesa-detalle" id="detalle-${mesa.id}" style="padding: 4px; border-top: 1px solid #e5e7eb; display: none;">
                    ${renderizarDetalleMesa(mesa)}
                </div>
            </div>
        `;
    }).join('') + tarjetaNuevaMesa;
    
    modalBody.innerHTML = `
        <div class="mesas-container" style="padding: 16px; max-width: 100%; margin: 0 auto;">
            <div class="mesas-header" style="display: flex; justify-content: flex-end; align-items: center; margin-bottom: 16px; gap: 12px; background: #f8fafc; padding: 10px; border-radius: 10px; border: 1px solid #e2e8f0;">
                <div style="display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: ${canalMesas && canalMesas.state === 'joined' ? '#10b98115' : pollingInterval ? '#f59e0b15' : '#ef444415'}; border: 1px solid ${canalMesas && canalMesas.state === 'joined' ? '#10b981' : pollingInterval ? '#f59e0b' : '#ef4444'}; border-radius: 20px; font-size: 11px; font-weight: 600; color: ${canalMesas && canalMesas.state === 'joined' ? '#10b981' : pollingInterval ? '#f59e0b' : '#ef4444'};">
                    ${canalMesas && canalMesas.state === 'joined' ? '🟢 Tiempo Real Activo' : pollingInterval ? '🟡 Modo Polling (3s)' : '🔴 Desconectado'}
                </div>
                <button onclick="abrirHistorialMesas()" style="background: transparent; color: #667eea; border: 2px solid #667eea; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 700; white-space: nowrap; width: auto; transition: all 0.2s;">
                    📋 Historial
                </button>
            </div>
            <div class="mesa-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px;">
                ${mesasHTML}
            </div>
        </div>
    `;
    setTimeout(() => { actualizarIndicadorEstado(); }, 100);
}

// Helper para generar solo los items (Usado en actualizaciones inteligentes)
function generarHTMLProductos(mesa) {
    if (!mesa.productos || mesa.productos.length === 0) return '';
    
    return mesa.productos.map((p, index) => `
        <div class="producto-item" style="display: flex; align-items: center; border-bottom: 1px solid #f3f4f6; padding: 0 8px; height: 32px; background: white;">
            <div class="producto-controls" style="display: flex; align-items: center; border: 1px solid #e5e7eb; border-radius: 4px; height: 22px; margin-right: 8px; overflow: hidden; flex-shrink: 0; background: white;">
                <div onmousedown="event.preventDefault()" onclick="event.stopPropagation(); ajustarCantidad('${mesa.id}', ${index}, -1)" class="qty-btn" style="width: 20px; height: 100%; border-right: 1px solid #f3f4f6; background: #f9fafb; cursor: pointer; font-size: 10px; color: #666; display: flex; align-items: center; justify-content: center; user-select: none;">−</div>
                <div class="qty-display" style="min-width: 20px; padding: 0 4px; height: 100%; text-align: center; font-weight: 600; font-size: 11px; display: flex; align-items: center; justify-content: center; color: #374151;">${p.cantidad}</div>
                <div onmousedown="event.preventDefault()" onclick="event.stopPropagation(); ajustarCantidad('${mesa.id}', ${index}, 1)" class="qty-btn" style="width: 20px; height: 100%; border-left: 1px solid #f3f4f6; background: #f9fafb; cursor: pointer; font-size: 10px; color: #666; display: flex; align-items: center; justify-content: center; user-select: none;">+</div>
            </div>
            <div class="producto-info" style="flex: 1; display: flex; align-items: center; min-width: 0; padding-right: 8px;">
                <span class="producto-nombre" style="font-size: 11px; color: #374151; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                   ${p.unidad && p.unidad !== 'und' ? `<span style="color:#9ca3af; margin-right:2px; font-size:10px;">${p.unidad}</span>` : ''} ${p.nombre}
                </span>
            </div>
            <div style="font-weight: 600; font-size: 11px; color: #10b981; white-space: nowrap; margin-right: 8px;">
                $${((p.precio_unitario || p.precio || 0) * p.cantidad).toLocaleString('es-CO')}
            </div>
            <button onmousedown="event.preventDefault()" onclick="event.stopPropagation(); eliminarProductoMesa('${mesa.id}', ${index})" class="delete-btn" style="width: 20px; height: 20px; flex-shrink: 0; background: transparent; border: none; color: #9ca3af; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px; padding: 0; box-shadow: none;">🗑️</button>
        </div>
    `).join('');
}

// Renderizar el detalle de la mesa completo
function renderizarDetalleMesa(mesa) {
    if (!mesa.productos || mesa.productos.length === 0) {
        return `
            <div style="padding: 8px;">
                <div style="padding: 20px; text-align: center; color: #999; margin-bottom: 12px;">Mesa vacía - Agrega productos</div>
                ${renderizarBuscadorMesa(mesa)}
            </div>
        `;
    }
    
    const productosHTML = generarHTMLProductos(mesa);
    
    const contenedorStyle = 'max-height: 40vh; overflow-y: auto; margin-top: 4px; margin-bottom: 10px; border: 1px solid #e5e7eb; border-radius: 8px; background: white;';
    
    return `
        <div class="productos-list" style="${contenedorStyle}">
            ${productosHTML}
        </div>
        ${renderizarBuscadorMesa(mesa)}
        <div style="text-align: center; margin-top: 10px; padding-bottom: 5px;">
            <button class="btn-registrar-venta-mesa" onclick="registrarVentaMesa('${mesa.id}')" style="background: #10b981; color: white; border: none; padding: 10px 24px; border-radius: 20px; font-weight: 600; width: auto; min-width: 60%; cursor: pointer; font-size: 14px; box-shadow: 0 2px 5px rgba(16, 185, 129, 0.3);">
                Registrar venta • $${(mesa.productos?.reduce((sum, p) => sum + ((p.precio_unitario || p.precio || 0) * p.cantidad), 0) || 0).toLocaleString('es-CO')}
            </button>
        </div>
    `;
}

function renderizarBuscadorMesa(mesa) {
    // IMPORTANTE: onmousedown="event.preventDefault()" en los botones evita que el input pierda el foco
    return `
        <div class="buscador-mesa-wrapper" style="position: relative; margin-bottom: 8px;">
            <div id="resultados-busqueda-${mesa.id}" class="resultados-busqueda-flotante" style="display: none;"></div>
            
            <div style="display: flex; gap: 8px; align-items: center;">
                <div class="buscar-producto" style="flex: 1; display: flex; gap: 4px; align-items: center; background: #f9fafb; padding: 4px 8px; border: 1px solid #e5e7eb; border-radius: 8px; height: 36px;">
                    <div class="producto-controls" style="display: flex; align-items: center; border: 1px solid #e5e7eb; border-radius: 4px; height: 22px; background: white; flex-shrink: 0;">
                        <div onmousedown="event.preventDefault()" onclick="ajustarCantidadBusqueda('${mesa.id}', -1)" class="qty-btn" style="width: 20px; height: 100%; border-right: 1px solid #f3f4f6; cursor: pointer; font-size: 10px; color: #666; display: flex; align-items: center; justify-content: center; user-select: none;">−</div>
                        
                        <input type="number" class="cantidad-input" id="cantidad-buscar-${mesa.id}" value="1" min="1" style="width: 24px; height: 100%; text-align: center; padding: 0; border: none; font-size: 11px; font-weight: 600; outline: none; -moz-appearance: textfield; background: transparent;" onchange="validarCantidadBusqueda('${mesa.id}')">
                        
                        <div onmousedown="event.preventDefault()" onclick="ajustarCantidadBusqueda('${mesa.id}', 1)" class="qty-btn" style="width: 20px; height: 100%; border-left: 1px solid #f3f4f6; cursor: pointer; font-size: 10px; color: #666; display: flex; align-items: center; justify-content: center; user-select: none;">+</div>
                    </div>
                    
                    <input type="text" class="buscar-input input-producto-buscar" id="buscar-${mesa.id}" placeholder="Buscar producto..." 
                        onkeyup="buscarProductoMesa('${mesa.id}')" 
                        style="flex: 1; padding: 0 8px; height: 24px; border: none; background: transparent; font-size: 11px; font-weight: 500; outline: none;">
                </div>
                
                <button onmousedown="iniciarGrabacionMesa('${mesa.id}')" onmouseup="detenerGrabacionMesa()" onmouseleave="if(estaGrabandoMesa) detenerGrabacionMesa()" ontouchstart="event.preventDefault(); iniciarGrabacionMesa('${mesa.id}')" ontouchend="event.preventDefault(); detenerGrabacionMesa()" class="btn btn-icon" style="background: transparent; border: none; cursor: pointer; padding: 0; display: flex; align-items: center; justify-content: center; color: #667eea; width: 36px; height: 36px; border-radius: 8px;">
                    <span style="font-size: 20px;">🎤</span>
                </button>
            </div>
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
    const previewElement = document.querySelector(`.mesa-preview-${mesaId}`);
    if (previewElement) {
        const productosPreview = mesa.productos && mesa.productos.length > 0 ?
            mesa.productos.map(p => `${p.cantidad} ${p.nombre}`).slice(0, 2).join(', ') + (mesa.productos.length > 2 ? '...' : '') : 'Vacía';
        previewElement.textContent = productosPreview;
    }
    const resumenElement = document.querySelector(`.mesa-resumen-${mesaId}`);
    if (resumenElement) {
        resumenElement.innerHTML = `<span>${mesa.totalProductos} items</span><span style="color: #10b981; font-weight: 600;">$${mesa.totalMonto.toLocaleString('es-CO')}</span>`;
    }
}

function toggleMesa(mesaId) {
    const detalle = document.getElementById(`detalle-${mesaId}`);
    if (!detalle) return;
    
    const estaExpandida = detalle.classList.contains('expanded');
    const esDesktop = window.innerWidth >= 768;
    
    if (!esDesktop) {
        document.querySelectorAll('.mesa-detalle').forEach(d => {
            if (d.id !== `detalle-${mesaId}`) {
                const otroMesaId = d.id.replace('detalle-', '');
                d.classList.remove('expanded');
                d.style.display = 'none';
                const otroPreview = document.querySelector(`.mesa-preview-${otroMesaId}`);
                const otroResumen = document.querySelector(`.mesa-resumen-${otroMesaId}`);
                if (otroPreview) otroPreview.style.display = 'block';
                if (otroResumen) otroResumen.style.display = 'flex';
            }
        });
    }
    
    if (!estaExpandida) {
        detalle.classList.add('expanded');
        detalle.style.display = 'block';
        const preview = document.querySelector(`.mesa-preview-${mesaId}`);
        const resumen = document.querySelector(`.mesa-resumen-${mesaId}`);
        if (preview) preview.style.display = 'none';
        if (resumen) resumen.style.display = 'none';
    } else {
        detalle.classList.remove('expanded');
        detalle.style.display = 'none';
        const preview = document.querySelector(`.mesa-preview-${mesaId}`);
        const resumen = document.querySelector(`.mesa-resumen-${mesaId}`);
        if (preview) preview.style.display = 'block';
        if (resumen) resumen.style.display = 'flex';
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
        createdAt: new Date().toISOString()
    };
    
    window.mesaRecienCreada = mesaId;
    const modalBody = document.getElementById('modalBodyMesas');
    renderizarMesas(modalBody);
    setTimeout(() => {
        toggleMesa(mesaId);
        setTimeout(() => { window.mesaRecienCreada = null; }, 2000);
    }, 50);
    await guardarMesas();
}

async function eliminarMesa(mesaId) {
    if (!confirm('¿Seguro que deseas eliminar esta mesa?')) return;
    try {
        const { error } = await supabase.from('mesas_activas').delete().eq('tenant_id', userData.tenant_id).eq('mesa_id', mesaId);
        if (error) throw error;
        delete mesasData[mesaId];
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

    chip.dataset.editing = 'true';
    chip.classList.remove('is-empty');
    chip.style.background = '#eef2ff';
    chip.style.border = '1px solid #c7d2fe';
    chip.style.padding = '8px';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = mesa.descripcion || '';
    input.placeholder = 'Descripción de la mesa';
    input.style.width = '100%';
    input.style.padding = '6px 8px';
    input.style.border = '1px solid #cbd5e1';
    input.style.borderRadius = '8px';
    input.style.fontSize = '12px';
    input.style.boxSizing = 'border-box';

    const acciones = document.createElement('div');
    acciones.style.display = 'flex';
    acciones.style.gap = '8px';
    acciones.style.marginTop = '8px';
    acciones.style.justifyContent = 'flex-end';

    const btnCancelar = document.createElement('button');
    btnCancelar.textContent = 'Cancelar';
    btnCancelar.style.background = '#f3f4f6';
    btnCancelar.style.border = '1px solid #e5e7eb';
    btnCancelar.style.borderRadius = '6px';
    btnCancelar.style.padding = '6px 10px';
    btnCancelar.style.fontSize = '12px';
    btnCancelar.style.cursor = 'pointer';

    const btnGuardar = document.createElement('button');
    btnGuardar.textContent = 'Guardar';
    btnGuardar.style.background = '#4f46e5';
    btnGuardar.style.color = '#fff';
    btnGuardar.style.border = 'none';
    btnGuardar.style.borderRadius = '6px';
    btnGuardar.style.padding = '6px 10px';
    btnGuardar.style.fontSize = '12px';
    btnGuardar.style.cursor = 'pointer';

    const restaurarChip = () => {
        chip.dataset.editing = 'false';
        chip.style.background = '';
        chip.style.border = '';
        chip.style.padding = '';
        if (botonLapiz) {
            botonLapiz.style.display = '';
        }
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
    
    // Referencia para el foco
    const inputBuscador = document.getElementById(`buscar-${mesaId}`);
    const teniaFoco = (document.activeElement === inputBuscador);

    // 1. Actualizar datos
    mesa.productos[productoIndex].cantidad += delta;
    if (mesa.productos[productoIndex].cantidad <= 0) {
        mesa.productos.splice(productoIndex, 1);
    }
    guardarMesas();
    
    // 2. Actualizar DOM de forma inteligente
    const detalle = document.getElementById(`detalle-${mesaId}`);
    if (detalle) {
        const listaExistente = detalle.querySelector('.productos-list');
        const botonTotal = detalle.querySelector('.btn-registrar-venta-mesa');
        
        if (listaExistente && botonTotal && mesa.productos.length > 0) {
            const productosHTML = generarHTMLProductos(mesa);
            listaExistente.innerHTML = productosHTML;
            
            const total = mesa.productos.reduce((sum, p) => sum + ((p.precio_unitario || p.precio || 0) * p.cantidad), 0);
            botonTotal.innerText = `Registrar venta • $${total.toLocaleString('es-CO')}`;
        } else {
            // Fallback si se vacía la mesa
            detalle.innerHTML = renderizarDetalleMesa(mesa);
        }
    }
    
    actualizarPreviewMesa(mesaId, mesa);
    
    // 3. Restaurar foco si es necesario
    if (teniaFoco && inputBuscador) {
        setTimeout(() => inputBuscador.focus(), 0);
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

    // Importante: Devolver el foco al buscador para no cerrar teclado
    if (inputSearch) {
        inputSearch.focus();
    }
}

function eliminarProductoMesa(mesaId, productoIndex) {
    const mesa = mesasData[mesaId];
    if (!mesa || !mesa.productos[productoIndex]) return;
    
    // Referencia para el foco
    const inputBuscador = document.getElementById(`buscar-${mesaId}`);
    const teniaFoco = (document.activeElement === inputBuscador);

    // 1. Eliminar
    mesa.productos.splice(productoIndex, 1);
    guardarMesas();
    
    // 2. Actualizar DOM
    const detalle = document.getElementById(`detalle-${mesaId}`);
    if (detalle) {
        const listaExistente = detalle.querySelector('.productos-list');
        const botonTotal = detalle.querySelector('.btn-registrar-venta-mesa');
        
        if (listaExistente && botonTotal && mesa.productos.length > 0) {
            const productosHTML = generarHTMLProductos(mesa);
            listaExistente.innerHTML = productosHTML;
            
            const total = mesa.productos.reduce((sum, p) => sum + ((p.precio_unitario || p.precio || 0) * p.cantidad), 0);
            botonTotal.innerText = `Registrar venta • $${total.toLocaleString('es-CO')}`;
        } else {
            // Fallback: si la lista queda vacía
            detalle.innerHTML = renderizarDetalleMesa(mesa);
            // Intentar restaurar foco (con timeout por si el DOM cambia mucho)
            if(teniaFoco) setTimeout(() => { 
                const input = document.getElementById(`buscar-${mesaId}`);
                if(input) input.focus();
            }, 10);
        }
    }
    actualizarPreviewMesa(mesaId, mesa);
}

// Variables para grabación por presión en mesas
async function iniciarGrabacionMesa(mesaId) {
    if (estaGrabandoMesa) return;
    const btn = event.target;
    btn.style.transform = 'scale(0.9)';
    btn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    btn.innerHTML = '⏹️';
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

function detenerGrabacionMesa() {
    if (!estaGrabandoMesa) return;
    const btn = event.target;
    if (mediaRecorderMesa && mediaRecorderMesa.state === 'recording') {
        mediaRecorderMesa.stop();
    }
    estaGrabandoMesa = false;
    btn.style.transform = 'scale(1)';
    btn.style.background = '#667eea';
    btn.innerHTML = '🎤';
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
                // Agregar productos de voz a la mesa
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
                    const detalle = document.getElementById(`detalle-${mesaId}`);
                    if (detalle) {
                        detalle.innerHTML = renderizarDetalleMesa(mesa);
                        detalle.style.display = 'block';
                        detalle.classList.add('expanded');
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
    
    // Limpiar input visualmente pero NO perder foco
    const input = document.getElementById(`buscar-${mesaId}`);
    const resultadosDiv = document.getElementById(`resultados-busqueda-${mesaId}`);
    
    if (resultadosDiv) resultadosDiv.style.display = 'none';
    if (input) {
        input.value = '';
        // Mantenemos el foco activo explícitamente
        input.focus();
    }
    if (inputCantidad) inputCantidad.value = '1';
    
    // Actualización inteligente del DOM para no cerrar el teclado
    const detalle = document.getElementById(`detalle-${mesaId}`);
    if (detalle) {
        const listaExistente = detalle.querySelector('.productos-list');
        const botonTotal = detalle.querySelector('.btn-registrar-venta-mesa');
        
        // CASO 1: Ya existe la estructura (lista y botón), actualizamos SOLO eso
        if (listaExistente && botonTotal) {
            const productosHTML = generarHTMLProductos(mesa);
            listaExistente.innerHTML = productosHTML;
            listaExistente.scrollTop = listaExistente.scrollHeight;
            
            const total = mesa.productos.reduce((sum, p) => sum + ((p.precio_unitario || p.precio || 0) * p.cantidad), 0);
            botonTotal.innerText = `Registrar venta • $${total.toLocaleString('es-CO')}`;
            
        } else {
            // CASO 2: La mesa estaba vacía (aquí sí cambia la estructura radicalmente, el parpadeo es inevitable solo la primera vez)
            detalle.innerHTML = renderizarDetalleMesa(mesa);
            // Re-capturamos el input porque el anterior fue destruido
            setTimeout(() => {
                const nuevoInput = document.getElementById(`buscar-${mesaId}`);
                if(nuevoInput) {
                    nuevoInput.focus();
                    nuevoInput.value = ''; 
                }
            }, 50);
        }
        
        detalle.style.display = 'block';
        detalle.classList.add('expanded');
    }
    
    // Actualizamos la tarjeta pequeña (resumen)
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
            
            // Vaciar mesa
            mesa.productos = [];
            mesa.descripcion = mesa.descripcion || '';
            await guardarMesas();
            
            const detalle = document.getElementById(`detalle-${mesaId}`);
            if (detalle) {
                detalle.innerHTML = renderizarDetalleMesa(mesa);
                detalle.style.display = 'block';
                detalle.classList.add('expanded');
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

async function buscarProductoMesa(mesaId) {
    const input = document.getElementById(`buscar-${mesaId}`);
    const resultadosDiv = document.getElementById(`resultados-busqueda-${mesaId}`);
    const termino = input.value.trim().toLowerCase();
    
    if (termino.length < 2) {
        resultadosDiv.style.display = 'none';
        return;
    }
    
    try {
        const { data: productos, error } = await supabase
            .from('productos')
            .select('producto_id, codigo, producto, precio_venta, tipo_venta, unidad_venta, apodos_input')
            .eq('tenant_id', userData.tenant_id)
            .eq('activo', true)
            .or(`producto.ilike.%${termino}%,apodos_input.ilike.%${termino}%,codigo.ilike.%${termino}%`)
            .limit(5);
        
        if (error) throw error;
        if (!productos || productos.length === 0) {
            resultadosDiv.style.display = 'none';
            return;
        }
        
        // IMPORTANTE: onmousedown="event.preventDefault()" evita que el input pierda el foco al hacer click
        resultadosDiv.innerHTML = productos.map(p => `
            <div style="padding: 12px; border-bottom: 1px solid #e5e7eb; cursor: pointer; background: white; transition: background 0.2s;" 
                 onmouseover="this.style.background='#f3f4f6'" 
                 onmouseout="this.style.background='white'"
                 onmousedown="event.preventDefault()"
                 onclick="seleccionarProductoMesa('${mesaId}', ${JSON.stringify(p).replace(/"/g, '&quot;')})">
                <div style="font-weight: 600; font-size: 13px; color: #1f2937;">[${p.codigo}] ${p.producto}</div>
                <div style="font-size: 12px; color: #10b981; font-weight: 600; margin-top: 2px;">${parseFloat(p.precio_venta).toLocaleString('es-CO')}</div>
            </div>
        `).join('');
        resultadosDiv.style.display = 'block';
    } catch (error) { console.error(error); }
}

function validarCantidadBusqueda(mesaId) {
    const input = document.getElementById(`cantidad-buscar-${mesaId}`);
    if (!input) return;
    let cantidad = parseInt(input.value) || 1;
    if (cantidad < 1) cantidad = 1;
    input.value = cantidad;
}

// FUNCIÓN ELIMINADA - Está duplicada arriba

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
                <div style="padding: 40px; text-align: center;">
                    <p style="font-size: 48px; margin-bottom: 10px;">📋</p>
                    <p style="color: #666;">No hay historial de ventas</p>
                    <button onclick="volverAMesas()" style="margin-top: 20px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">← Volver a Mesas</button>
                </div>
            `;
            return;
        }
        
        const historialHTML = historial.map(registro => {
            const fecha = new Date(registro.created_at).toLocaleString('es-CO');
            const abreviarUnidad = (unidad) => {
                const abreviaturas = { 'unidades': 'und', 'unidad': 'und', 'libras': 'lbs', 'kilogramos': 'kg', 'gramos': 'g', 'metros': 'm', 'centimetros': 'cm', 'milimetros': 'mm', 'litros': 'L', 'mililitros': 'ml' };
                return abreviaturas[unidad?.toLowerCase()] || unidad || 'und';
            };
            const productosTexto = registro.productos.map(p => `${p.cantidad} ${abreviarUnidad(p.unidad)} ${p.nombre}`).join(', ');
            
            return `
                <div style="background: white; border: 2px solid #e0e0e0; border-radius: 12px; padding: 16px; margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                        <div>
                            <div style="font-weight: 700; font-size: 16px;">${registro.mesa_nombre}</div>
                            <div style="font-size: 12px; color: #666;">${fecha}</div>
                        </div>
                        <div style="font-weight: 700; font-size: 18px; color: #10b981;">$${parseFloat(registro.total).toLocaleString('es-CO')}</div>
                    </div>
                    <div style="font-size: 13px; color: #666; margin-bottom: 4px;">${productosTexto}</div>
                    <div style="font-size: 12px; color: #888;">${registro.productos.length} items • ${registro.usuario || 'Usuario'}</div>
                </div>
            `;
        }).join('');
        
        modalBody.innerHTML = `
            <div class="mesas-container">
                <div class="mesas-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <button onclick="volverAMesas()" style="background: #667eea; color: white; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-size: 14px; width: auto; min-width: auto;">← Mesas</button>
                    <h3 style="margin: 0; flex: 1; text-align: center;">📋 Historial</h3>
                    <div style="width: 75px;"></div>
                </div>
                <div style="padding: 16px;">${historialHTML}</div>
            </div>
        `;
    } catch (error) {
        console.error('Error cargando historial:', error);
        modalBody.innerHTML = '<div style="padding: 40px; text-align: center;"><p style="color: #ef4444;">Error al cargar el historial</p><button onclick="volverAMesas()" style="margin-top: 20px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">← Volver a Mesas</button></div>';
    }
}

function volverAMesas() {
    const modalBody = document.getElementById('modalBodyMesas');
    renderizarMesas(modalBody);
}
