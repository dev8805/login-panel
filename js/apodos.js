/**
 * ===========================================
 * APODOS - EDITAR Y GESTIONAR
 * ===========================================
 */

let productoActualApodos = null;

// =====================================================
// FUNCIONES PARA EDITAR PRODUCTO (NOMBRE)
// =====================================================

async function cargarFormularioEditarProducto(modalBody) {
    // Mostrar loading
    modalBody.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <p>Cargando productos...</p>
        </div>
    `;
    try {
        // Cargar productos
        const { data: productos, error } = await supabase
            .from('productos')
            .select('producto_id, codigo, producto')
            .eq('tenant_id', userData.tenant_id)
            .eq('activo', true)
            .order('codigo');
        if (error) throw error;
        
        modalBody.innerHTML = `
            <div id="successEditProducto" class="success-message"></div>
            <div id="errorEditProducto" class="error"></div>
            
            <div class="form-group">
                <label for="buscarProductoEdit">Buscar producto</label>
                <input 
                    type="text" 
                    id="buscarProductoEdit" 
                    placeholder="Buscar por código o nombre..."
                    onkeyup="filtrarProductosEdit()"
                >
            </div>
            
            <div style="max-height: 400px; overflow-y: auto;">
                <table class="productos-table" id="tablaProductosEdit">
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Nombre</th>
                            <th>Acción</th>
                        </tr>
                    </thead>
                    <tbody id="bodyProductosEdit">
                        ${productos.map(p => `
                            <tr data-producto-id="${p.producto_id}">
                                <td><strong>${p.codigo}</strong></td>
                                <td id="nombre-${p.producto_id}">${p.producto}</td>
                                <td>
                                    <button 
                                        onclick="editarNombreProducto('${p.producto_id}', '${p.codigo}')"
                                        style="padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;"
                                    >
                                        ✏️ Editar
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
    } catch (error) {
        console.error('Error cargando productos:', error);
        modalBody.innerHTML = `
            <div class="error show">
                Error al cargar productos: ${error.message}
            </div>
        `;
    }
}

// Filtrar productos en la tabla
function filtrarProductosEdit() {
    const input = document.getElementById('buscarProductoEdit');
    const filter = input.value.toLowerCase();
    const tbody = document.getElementById('bodyProductosEdit');
    const rows = tbody.getElementsByTagName('tr');
    
    for (let i = 0; i < rows.length; i++) {
        const codigo = rows[i].cells[0].textContent.toLowerCase();
        const nombre = rows[i].cells[1].textContent.toLowerCase();
        if (codigo.includes(filter) || nombre.includes(filter)) {
            rows[i].style.display = '';
        } else {
            rows[i].style.display = 'none';
        }
    }
}

// Editar nombre de producto
async function editarNombreProducto(productoId, codigo) {
    const nombreActual = document.getElementById(`nombre-${productoId}`).textContent;
    const nuevoNombre = prompt(`Editar nombre del producto [${codigo}]:\n\nNombre actual: ${nombreActual}\n\nIngresa el nuevo nombre:`, nombreActual);
    if (!nuevoNombre || nuevoNombre.trim() === '') {
        return;
    }
    
    if (nuevoNombre.trim() === nombreActual) {
        alert('El nombre no ha cambiado');
        return;
    }
    
    try {
        const { error } = await supabase
            .from('productos')
            .update({
                producto: nuevoNombre.trim(),
                updated_at: new Date().toISOString(),
                updated_by: userData.user_id
            })
            .eq('producto_id', productoId);
        if (error) throw error;
        
        // Actualizar en la tabla
        document.getElementById(`nombre-${productoId}`).textContent = nuevoNombre.trim();
        mostrarExitoEditProducto(`✅ Producto actualizado correctamente\n\n[${codigo}] ${nuevoNombre.trim()}`);
        
    } catch (error) {
        console.error('Error actualizando producto:', error);
        mostrarErrorEditProducto('Error al actualizar el producto: ' + error.message);
    }
}

function mostrarErrorEditProducto(mensaje) {
    const errorDiv = document.getElementById('errorEditProducto');
    const successDiv = document.getElementById('successEditProducto');
    
    if (errorDiv) {
        errorDiv.textContent = mensaje;
        errorDiv.classList.add('show');
    }
    if (successDiv) {
        successDiv.classList.remove('show');
    }
    
    setTimeout(() => {
        if (errorDiv) errorDiv.classList.remove('show');
    }, 5000);
}

function mostrarExitoEditProducto(mensaje) {
    const successDiv = document.getElementById('successEditProducto');
    const errorDiv = document.getElementById('errorEditProducto');
    if (successDiv) {
        successDiv.textContent = mensaje;
        successDiv.classList.add('show');
    }
    if (errorDiv) {
        errorDiv.classList.remove('show');
    }
    
    setTimeout(() => {
        if (successDiv) successDiv.classList.remove('show');
    }, 3000);
}

// =====================================================
// FUNCIONES PARA EDITAR APODOS
// =====================================================

async function cargarFormularioEditarApodos(modalBody) {
    modalBody.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <p>Cargando productos...</p>
        </div>
    `;
    try {
        // Cargar productos con sus apodos
        const { data: productos, error } = await supabase
            .from('productos')
            .select(`
                producto_id,
                codigo,
                producto
            `)
            .eq('tenant_id', userData.tenant_id)
            .eq('activo', true)
            .order('codigo');
        if (error) throw error;
        
        modalBody.innerHTML = `
            <div id="successEditApodos" class="success-message"></div>
            <div id="errorEditApodos" class="error"></div>
            
            <div class="form-group">
                <label for="buscarProductoApodos">Buscar producto</label>
                <input 
                    type="text" 
                    id="buscarProductoApodos" 
                    placeholder="Buscar por código o nombre..."
                    onkeyup="filtrarProductosApodos()"
                >
            </div>
            
            <div style="max-height: 400px; overflow-y: auto;">
                <table class="productos-table" id="tablaProductosApodos">
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Producto</th>
                            <th>Acción</th>
                        </tr>
                    </thead>
                    <tbody id="bodyProductosApodos">
                        ${productos.map(p => `
                            <tr>
                                <td><strong>${p.codigo}</strong></td>
                                <td>${p.producto}</td>
                                <td>
                                    <button 
                                        onclick="abrirEditorApodos('${p.producto_id}', '${p.codigo}', \`${p.producto}\`)"
                                        style="padding: 6px 16px; background: white; color: #667eea; border: 2px solid #667eea; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 700; transition: all 0.2s;"
                                        onmouseover="this.style.background='#f5f7ff'"
                                        onmouseout="this.style.background='white'"
                                    >
                                        Editar
                                    </button>  
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <div id="modalEditorApodos" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="tituloModalEditorApodos">🏷️ Editar Apodos</h3>
                        <button class="modal-close" onclick="cerrarModalEditorApodos()">×</button>
                    </div>
                    <div class="modal-body" id="modalBodyEditorApodos">
                        </div>
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Error cargando productos:', error);
        modalBody.innerHTML = `
            <div class="error show">
                Error al cargar productos: ${error.message}
            </div>
        `;
    }
}

// Filtrar productos en la tabla
function filtrarProductosApodos() {
    const input = document.getElementById('buscarProductoApodos');
    const filter = input.value.toLowerCase();
    const tbody = document.getElementById('bodyProductosApodos');
    const rows = tbody.getElementsByTagName('tr');
    
    for (let i = 0; i < rows.length; i++) {
        const codigo = rows[i].cells[0].textContent.toLowerCase();
        const producto = rows[i].cells[1].textContent.toLowerCase();
        
        if (codigo.includes(filter) || producto.includes(filter)) {
            rows[i].style.display = '';
        } else {
            rows[i].style.display = 'none';
        }
    }
}

async function abrirEditorApodos(productoId, codigo, producto) {
    productoActualApodos = { producto_id: productoId, codigo: codigo, producto: producto };
    // Actualizar título del modal
    document.getElementById('tituloModalEditorApodos').textContent = `🏷️ [${codigo}] ${producto}`;
    // Abrir el nuevo modal
    const modal = document.getElementById('modalEditorApodos');
    const modalBody = document.getElementById('modalBodyEditorApodos');
    // Mostrar loading
    modalBody.innerHTML = '<p style="text-align: center; padding: 40px;">Cargando apodos...</p>';
    
    modal.classList.add('show');
    // Cargar contenido del editor
    await cargarContenidoEditorApodos(productoId);
}

async function cargarContenidoEditorApodos(productoId) {
    const modalBody = document.getElementById('modalBodyEditorApodos');
    try {
        const { data: apodos, error } = await supabase
            .from('productos_apodos')
            .select('apodo_id, apodo')
            .eq('producto_id', productoId)
            .eq('tenant_id', userData.tenant_id)
            .is('deleted_at', null)
            .order('apodo');
        if (error) throw error;
        
        let listaApodosHTML = '';
        
        if (apodos.length === 0) {
            listaApodosHTML = `
                <div style="text-align: center; padding: 20px; background: #f9f9f9; border-radius: 8px; color: #999; margin-bottom: 20px;">
                    No hay apodos registrados para este producto
                </div>
            `;
        } else {
            listaApodosHTML = `
                <div style="background: #fff; border: 2px solid #e0e0e0; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 15px 0; color: #333;">Apodos actuales:</h4>
                    <div id="apodosItems">
                        ${apodos.map(a => `
                            <div id="apodo-item-${a.apodo_id}" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f5f7ff; border-radius: 6px; margin-bottom: 8px;">
                                <span style="font-weight: 500; color: #333;">🏷️ ${a.apodo}</span>
                                <button 
                                    onclick="eliminarApodoEditor('${a.apodo_id}', '${a.apodo}')"
                                    style="padding: 6px 10px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 10px; min-width: auto; width: auto; flex-shrink: 0;"
                                >
                                    🗑️
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        modalBody.innerHTML = `
            <div id="successEditApodosModal" class="success-message"></div>
            <div id="errorEditApodosModal" class="error"></div>
            
            ${listaApodosHTML}
            
            <div style="background: #f5f7ff; padding: 15px; border-radius: 8px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">Agregar nuevo apodo</label>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <input 
                        type="text" 
                        id="nuevoApodoModal" 
                        placeholder="Escribe el nuevo apodo..."
                        style="flex: 1; padding: 10px 12px; max-width: 70%;"
                        onkeypress="if(event.key === 'Enter') agregarNuevoApodoModal()"
                    >
                    <button 
                        onclick="agregarNuevoApodoModal()"
                        style="padding: 10px 12px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px; min-width: auto; width: auto; flex-shrink: 0;"
                    >
                        ➕
                    </button>
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Error cargando apodos:', error);
        modalBody.innerHTML = `
            <div class="error show">
                Error al cargar apodos: ${error.message}
            </div>
        `;
    }
}

// Agregar nuevo apodo
async function agregarNuevoApodoModal() {
    const input = document.getElementById('nuevoApodoModal');
    const apodo = input.value.trim();
    
    if (!apodo) {
        mostrarErrorEditApodosModal('Debes escribir un apodo');
        return;
    }
    
    if (!productoActualApodos) {
        mostrarErrorEditApodosModal('No hay producto seleccionado');
        return;
    }
    
    try {
        // Insertar nuevo apodo
        const { data, error } = await supabase
            .from('productos_apodos')
            .insert({
                tenant_id: userData.tenant_id,
                producto_id: productoActualApodos.producto_id,
                apodo: apodo.toLowerCase(),
                producto: productoActualApodos.producto
            })
            .select()
            .single();
        if (error) throw error;
        
        // Limpiar input
        input.value = '';
        // Recargar lista de apodos
        await cargarContenidoEditorApodos(productoActualApodos.producto_id);
        
        mostrarExitoEditApodosModal(`✅ Apodo "${apodo}" agregado correctamente`);
    } catch (error) {
        console.error('Error agregando apodo:', error);
        mostrarErrorEditApodosModal('Error al agregar apodo: ' + error.message);
    }
}

// Eliminar apodo desde el editor
async function eliminarApodoEditor(apodoId, apodo) {
    if (!confirm(`¿Seguro que deseas eliminar el apodo "${apodo}"?`)) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('productos_apodos')
            .delete()
            .eq('apodo_id', apodoId);
        if (error) throw error;
        
        // Eliminar visualmente
        const item = document.getElementById(`apodo-item-${apodoId}`);
        if (item) item.remove();
        
        // Si ya no quedan apodos, recargar para mostrar mensaje
        const apodosItems = document.getElementById('apodosItems');
        if (apodosItems && apodosItems.children.length === 0) {
            await cargarContenidoEditorApodos(productoActualApodos.producto_id);
        }
        
        mostrarExitoEditApodosModal(`✅ Apodo "${apodo}" eliminado correctamente`);
    } catch (error) {
        console.error('Error eliminando apodo:', error);
        mostrarErrorEditApodosModal('Error al eliminar apodo: ' + error.message);
    }
}

// Cerrar editor de apodos
function cerrarModalEditorApodos() {
    document.getElementById('modalEditorApodos').classList.remove('show');
    productoActualApodos = null;
}

function mostrarErrorEditApodosModal(mensaje) {
    const errorDiv = document.getElementById('errorEditApodosModal');
    const successDiv = document.getElementById('successEditApodosModal');
    if (errorDiv) {
        errorDiv.textContent = mensaje;
        errorDiv.classList.add('show');
    }
    if (successDiv) {
        successDiv.classList.remove('show');
    }
    
    setTimeout(() => {
        if (errorDiv) errorDiv.classList.remove('show');
    }, 5000);
}

function mostrarExitoEditApodosModal(mensaje) {
    const successDiv = document.getElementById('successEditApodosModal');
    const errorDiv = document.getElementById('errorEditApodosModal');
    if (successDiv) {
        successDiv.textContent = mensaje;
        successDiv.classList.add('show');
    }
    if (errorDiv) {
        errorDiv.classList.remove('show');
    }
    
    setTimeout(() => {
        if (successDiv) successDiv.classList.remove('show');
    }, 3000);
}
