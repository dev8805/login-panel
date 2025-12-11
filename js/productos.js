/**
 * ===========================================
 * PRODUCTOS - CREAR Y EDITAR
 * ===========================================
 */

/**
 * ===========================================
 * AGREGAR ESTO EN js/productos.js
 * ===========================================
 */

// Inicializar variable global para los apodos
window.apodosCrearProducto = [];

function cargarFormularioProducto() {
    const modal = document.getElementById('modalCrearProducto');
    const modalBody = document.getElementById('modalBody');

    // 1. Inyectar el nuevo HTML con diseño Layout A Premium
    modalBody.innerHTML = `
    <div class="form-crear-producto-container">
        <div id="successMsg" class="form-message success"></div>
        <form id="formCrearProducto" onsubmit="submitProducto(event)">
            <div id="errorMsgModal" class="form-message error"></div>
            
            <div class="form-card">
                <div class="form-card-body">
                    <!-- Sección: Tipo de Producto -->
                    <div class="form-section">
                        <label class="form-section-label">Tipo de producto <span class="required-star">*</span></label>
                        <div class="tipo-producto-cards">
                            <label class="tipo-producto-card selected" onclick="seleccionarTipoProducto('simple', this)">
                                <input type="radio" name="tipoProducto" id="tipoSimple" value="simple" checked>
                                <div class="card-content">
                                    <span class="card-icon">📦</span>
                                    <span>Producto Simple</span>
                                </div>
                                <span class="card-description">Se vende directamente</span>
                                <span class="check-icon">✓</span>
                            </label>
                            
                            <label class="tipo-producto-card" onclick="seleccionarTipoProducto('procesado', this)">
                                <input type="radio" name="tipoProducto" id="tipoProcesado" value="procesado">
                                <div class="card-content">
                                    <span class="card-icon">🍴</span>
                                    <span>Producto Procesado</span>
                                </div>
                                <span class="card-description">Tiene receta con ingredientes</span>
                                <span class="check-icon">✓</span>
                            </label>
                        </div>
                    </div>
                    
                    <!-- Sección: Foto del Producto -->
                    <div class="form-section">
                        <label class="form-section-label">Foto del producto</label>
                        <div class="foto-upload-area" onclick="document.getElementById('product_photo').click()">
                            <div class="foto-upload-content">
                                <div class="foto-upload-icon">☁️</div>
                                <div class="foto-upload-text">
                                    <span class="upload-link">Sube un archivo</span>
                                    <span> o arrastra y suelta</span>
                                </div>
                                <p class="foto-upload-hint">PNG, JPG, GIF hasta 10MB</p>
                            </div>
                        </div>
                        <input id="product_photo" name="product_photo" type="file" accept="image/*" style="display: none;">
                    </div>
                    
                    <!-- Sección: Campos principales -->
                    <div class="form-fields-grid">
                        <div class="form-field col-span-2">
                            <label for="productoNombre">Nombre del producto <span class="required-star">*</span></label>
                            <input class="form-input" id="productoNombre" type="text" required placeholder="Ej. Coca Cola 600ml">
                        </div>
                        
                        <div class="form-field">
                            <label for="tipoVenta">Tipo de venta <span class="required-star">*</span></label>
                            <select class="form-select" id="tipoVenta" required onchange="updateFormByType()">
                                <option value="">Seleccionar...</option>
                                <option value="unidad">Unidad</option>
                                <option value="peso">Peso</option>
                                <option value="medida">Medida</option>
                            </select>
                        </div>
                    </div>
                    
                    <!-- Campos dinámicos según tipo de venta -->
                    <div id="camposDinamicos"></div>
                    
                    <!-- Sección: Receta (solo para productos procesados) -->
                    <div id="seccionReceta" class="receta-section-premium">
                        <h3 class="section-title"><span class="icon">📝</span> Receta del Producto</h3>
                        
                        <div class="receta-info-alert">
                            <span>ℹ️</span>
                            <span><strong>Información:</strong> Define los ingredientes necesarios para producir 1 unidad de este producto.</span>
                        </div>
                        
                        <div id="listaIngredientes" class="receta-lista-ingredientes">
                            <div class="receta-empty">No hay ingredientes agregados aún</div>
                        </div>
                        
                        <div class="ingrediente-form-premium">
                            <h4 class="form-title">Agregar Ingrediente</h4>
                            <div class="ingrediente-form-grid">
                                <div class="form-field">
                                    <label>📦 Ingrediente</label>
                                    <select class="form-select" id="selectIngrediente">
                                        <option value="">Cargando...</option>
                                    </select>
                                </div>
                                <div class="form-field">
                                    <label>🔢 Cantidad</label>
                                    <input class="form-input" type="number" id="cantidadIngrediente" step="0.01" min="0.01" placeholder="50">
                                </div>
                                <div class="form-field">
                                    <label>⚖️ Unidad</label>
                                    <select class="form-select" id="unidadIngrediente">
                                        <option value="">Selecciona ingrediente primero</option>
                                    </select>
                                </div>
                                <div class="form-field">
                                    <label>Acción</label>
                                    <button type="button" class="btn-add-ingrediente" onclick="agregarIngredienteReceta()">➕</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Sección: Apodos -->
                    <div class="apodos-section">
                        <h3 class="apodos-section-header">
                            <span class="icon">🏷️</span>
                            Apodos del producto
                        </h3>
                        
                        <div class="apodos-container">
                            <div class="apodos-grid">
                                <div class="apodos-input-group">
                                    <label>Agregar nuevo apodo</label>
                                    <div class="apodos-input-row">
                                        <input 
                                            class="form-input" 
                                            type="text" 
                                            id="nuevoApodoCrear" 
                                            placeholder="Escribe un apodo..."
                                            onkeypress="if(event.key === 'Enter') { event.preventDefault(); agregarApodoCrear(); }"
                                        >
                                        <button type="button" class="btn-add-apodo" onclick="agregarApodoCrear()">➕</button>
                                    </div>
                                    <p class="apodos-hint">El nombre del producto se agregará automáticamente como apodo</p>
                                </div>
                                
                                <div class="apodos-input-group">
                                    <label>Apodos agregados</label>
                                    <div id="listaApodosCrear" class="apodos-list-container empty">
                                        <div id="apodosItemsCrear">No hay apodos agregados aún</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Footer con botones -->
                <div class="form-card-footer">
                    <button type="button" class="btn-cancel" onclick="closeModal()">Cancelar</button>
                    <button type="submit" class="btn-submit-premium" id="btnSubmit">Crear Producto</button>
                </div>
            </div>
            
            <input type="hidden" id="apodos" value="">
            <input type="hidden" id="ingredientesReceta" value="">
        </form>
    </div>
    `;

    // 2. Restaurar la lógica de inicialización
    window.apodosCrearProducto = [];
    ingredientesReceta = [];

    // Listener para cuando cambia el nombre del producto (Auto-apodo)
    document.getElementById('productoNombre').addEventListener('blur', function () {
        const nombreProducto = this.value.trim().toLowerCase();
        if (nombreProducto && !window.apodosCrearProducto.includes(nombreProducto)) {
            window.apodosCrearProducto.push(nombreProducto);
            renderizarApodosCrear();
        }
    });

    // 3. Abrir el modal
    modal.classList.add('show');
}

// Nueva función para cargar formulario en content-area (desktop)
function cargarFormularioProductoEnArea(modalBody) {
    // Usar el mismo HTML premium pero sin abrir modal
    modalBody.innerHTML = `
    <div class="form-crear-producto-container">
        <div id="successMsg" class="form-message success"></div>
        <form id="formCrearProducto" onsubmit="submitProducto(event)">
            <div id="errorMsgModal" class="form-message error"></div>
            
            <div class="form-card">
                <div class="form-card-body">
                    <!-- Sección: Tipo de Producto -->
                    <div class="form-section">
                        <label class="form-section-label">Tipo de producto <span class="required-star">*</span></label>
                        <div class="tipo-producto-cards">
                            <label class="tipo-producto-card selected" onclick="seleccionarTipoProducto('simple', this)">
                                <input type="radio" name="tipoProducto" id="tipoSimple" value="simple" checked>
                                <div class="card-content">
                                    <span class="card-icon">📦</span>
                                    <span>Producto Simple</span>
                                </div>
                                <span class="card-description">Se vende directamente</span>
                                <span class="check-icon">✓</span>
                            </label>
                            
                            <label class="tipo-producto-card" onclick="seleccionarTipoProducto('procesado', this)">
                                <input type="radio" name="tipoProducto" id="tipoProcesado" value="procesado">
                                <div class="card-content">
                                    <span class="card-icon">🍴</span>
                                    <span>Producto Procesado</span>
                                </div>
                                <span class="card-description">Tiene receta con ingredientes</span>
                                <span class="check-icon">✓</span>
                            </label>
                        </div>
                    </div>
                    
                    <!-- Sección: Foto del Producto -->
                    <div class="form-section">
                        <label class="form-section-label">Foto del producto</label>
                        <div class="foto-upload-area" onclick="document.getElementById('product_photo').click()">
                            <div class="foto-upload-content">
                                <div class="foto-upload-icon">☁️</div>
                                <div class="foto-upload-text">
                                    <span class="upload-link">Sube un archivo</span>
                                    <span> o arrastra y suelta</span>
                                </div>
                                <p class="foto-upload-hint">PNG, JPG, GIF hasta 10MB</p>
                            </div>
                        </div>
                        <input id="product_photo" name="product_photo" type="file" accept="image/*" style="display: none;">
                    </div>
                    
                    <!-- Sección: Campos principales -->
                    <div class="form-fields-grid">
                        <div class="form-field col-span-2">
                            <label for="productoNombre">Nombre del producto <span class="required-star">*</span></label>
                            <input class="form-input" id="productoNombre" type="text" required placeholder="Ej. Coca Cola 600ml">
                        </div>
                        
                        <div class="form-field">
                            <label for="tipoVenta">Tipo de venta <span class="required-star">*</span></label>
                            <select class="form-select" id="tipoVenta" required onchange="updateFormByType()">
                                <option value="">Seleccionar...</option>
                                <option value="unidad">Unidad</option>
                                <option value="peso">Peso</option>
                                <option value="medida">Medida</option>
                            </select>
                        </div>
                    </div>
                    
                    <!-- Campos dinámicos según tipo de venta -->
                    <div id="camposDinamicos"></div>
                    
                    <!-- Sección: Receta (solo para productos procesados) -->
                    <div id="seccionReceta" class="receta-section-premium">
                        <h3 class="section-title"><span class="icon">📝</span> Receta del Producto</h3>
                        
                        <div class="receta-info-alert">
                            <span>ℹ️</span>
                            <span><strong>Información:</strong> Define los ingredientes necesarios para producir 1 unidad de este producto.</span>
                        </div>
                        
                        <div id="listaIngredientes" class="receta-lista-ingredientes">
                            <div class="receta-empty">No hay ingredientes agregados aún</div>
                        </div>
                        
                        <div class="ingrediente-form-premium">
                            <h4 class="form-title">Agregar Ingrediente</h4>
                            <div class="ingrediente-form-grid">
                                <div class="form-field">
                                    <label>📦 Ingrediente</label>
                                    <select class="form-select" id="selectIngrediente">
                                        <option value="">Cargando...</option>
                                    </select>
                                </div>
                                <div class="form-field">
                                    <label>🔢 Cantidad</label>
                                    <input class="form-input" type="number" id="cantidadIngrediente" step="0.01" min="0.01" placeholder="50">
                                </div>
                                <div class="form-field">
                                    <label>⚖️ Unidad</label>
                                    <select class="form-select" id="unidadIngrediente">
                                        <option value="">Selecciona ingrediente primero</option>
                                    </select>
                                </div>
                                <div class="form-field">
                                    <label>Acción</label>
                                    <button type="button" class="btn-add-ingrediente" onclick="agregarIngredienteReceta()">➕</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Sección: Apodos -->
                    <div class="apodos-section">
                        <h3 class="apodos-section-header">
                            <span class="icon">🏷️</span>
                            Apodos del producto
                        </h3>
                        
                        <div class="apodos-container">
                            <div class="apodos-grid">
                                <div class="apodos-input-group">
                                    <label>Agregar nuevo apodo</label>
                                    <div class="apodos-input-row">
                                        <input 
                                            class="form-input" 
                                            type="text" 
                                            id="nuevoApodoCrear" 
                                            placeholder="Escribe un apodo..."
                                            onkeypress="if(event.key === 'Enter') { event.preventDefault(); agregarApodoCrear(); }"
                                        >
                                        <button type="button" class="btn-add-apodo" onclick="agregarApodoCrear()">➕</button>
                                    </div>
                                    <p class="apodos-hint">El nombre del producto se agregará automáticamente como apodo</p>
                                </div>
                                
                                <div class="apodos-input-group">
                                    <label>Apodos agregados</label>
                                    <div id="listaApodosCrear" class="apodos-list-container empty">
                                        <div id="apodosItemsCrear">No hay apodos agregados aún</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Footer con botones -->
                <div class="form-card-footer">
                    <button type="button" class="btn-cancel" onclick="cerrarContentArea()">Cancelar</button>
                    <button type="submit" class="btn-submit-premium" id="btnSubmit">Crear Producto</button>
                </div>
            </div>
            
            <input type="hidden" id="apodos" value="">
            <input type="hidden" id="ingredientesReceta" value="">
        </form>
    </div>
    `;

    // Inicializar
    window.apodosCrearProducto = [];
    ingredientesReceta = [];

    // Listener para auto-apodo
    document.getElementById('productoNombre').addEventListener('blur', function () {
        const nombreProducto = this.value.trim().toLowerCase();
        if (nombreProducto && !window.apodosCrearProducto.includes(nombreProducto)) {
            window.apodosCrearProducto.push(nombreProducto);
            renderizarApodosCrear();
        }
    });
}

// Variables globales
let ingredientesReceta = [];

// Seleccionar tipo de producto
function seleccionarTipoProducto(tipo, elemento) {
    // Remover clase selected de todos (soporte para ambos formatos)
    document.querySelectorAll('.tipo-producto-option, .tipo-producto-card').forEach(el => {
        el.classList.remove('selected');
    });

    // Agregar clase al seleccionado
    elemento.classList.add('selected');

    // Marcar el radio
    document.getElementById(tipo === 'simple' ? 'tipoSimple' : 'tipoProcesado').checked = true;

    // Mostrar/ocultar sección de receta
    const seccionReceta = document.getElementById('seccionReceta');
    if (tipo === 'procesado') {
        seccionReceta.classList.add('active');
        cargarProductosParaReceta();
    } else {
        seccionReceta.classList.remove('active');
        ingredientesReceta = [];
    }
}

// Cargar productos disponibles para la receta
async function cargarProductosParaReceta() {
    try {
        const { data: productos, error } = await supabase
            .from('productos')
            .select('producto_id, codigo, producto, tipo_venta, unidad_venta')
            .eq('tenant_id', userData.tenant_id)
            .eq('activo', true)
            .order('producto');

        if (error) throw error;

        const select = document.getElementById('selectIngrediente');
        select.innerHTML = '<option value="">Seleccionar ingrediente...</option>';

        productos.forEach(p => {
            const option = document.createElement('option');
            option.value = p.producto_id;
            option.textContent = `[${p.codigo}] ${p.producto}`;
            option.dataset.unidad = p.unidad_venta || 'unidades';
            option.dataset.tipoVenta = p.tipo_venta;
            option.dataset.codigo = p.codigo;
            option.dataset.nombre = p.producto;
            select.appendChild(option);
        });

        // Listener para actualizar opciones de unidad
        select.addEventListener('change', function () {
            const selectedOption = this.options[this.selectedIndex];
            const selectUnidad = document.getElementById('unidadIngrediente');

            if (selectedOption.value) {
                const tipoVenta = selectedOption.dataset.tipoVenta;
                const unidadBase = selectedOption.dataset.unidad;

                selectUnidad.innerHTML = '';

                if (tipoVenta === 'peso') {
                    selectUnidad.innerHTML = `
                        <option value="gramos">Gramos</option>
                        <option value="kilogramos">Kilogramos</option>
                        <option value="libras" selected>Libras</option>
                        <option value="onzas">Onzas</option>
                    `;
                } else if (tipoVenta === 'medida') {
                    selectUnidad.innerHTML = `
                        <option value="milimetros">Milímetros</option>
                        <option value="centimetros">Centímetros</option>
                        <option value="metros" selected>Metros</option>
                    `;
                } else {
                    selectUnidad.innerHTML = `
                        <option value="unidades" selected>Unidades</option>
                    `;
                }
            } else {
                selectUnidad.innerHTML = '<option value="">Selecciona ingrediente primero</option>';
            }
        });

    } catch (error) {
        console.error('Error cargando productos:', error);
        alert('Error al cargar ingredientes disponibles');
    }
}

// Agregar ingrediente a la receta
function agregarIngredienteReceta() {
    const select = document.getElementById('selectIngrediente');
    const cantidad = document.getElementById('cantidadIngrediente');
    const unidad = document.getElementById('unidadIngrediente');

    if (!select.value) {
        alert('Selecciona un ingrediente');
        return;
    }

    if (!cantidad.value || parseFloat(cantidad.value) <= 0) {
        alert('Ingresa una cantidad válida');
        return;
    }

    const selectedOption = select.options[select.selectedIndex];

    // Verificar si ya existe
    if (ingredientesReceta.find(i => i.ingrediente_id === select.value)) {
        alert('Este ingrediente ya está en la receta');
        return;
    }

    // Agregar al array
    ingredientesReceta.push({
        ingrediente_id: select.value,
        codigo: selectedOption.dataset.codigo,
        nombre: selectedOption.dataset.nombre,
        cantidad: parseFloat(cantidad.value),
        unidad: unidad.value
    });

    // Limpiar campos
    select.value = '';
    cantidad.value = '';
    unidad.value = '';

    // Renderizar lista
    renderizarIngredientesReceta();
}

// Renderizar lista de ingredientes
function renderizarIngredientesReceta() {
    const container = document.getElementById('listaIngredientes');

    if (ingredientesReceta.length === 0) {
        container.innerHTML = '<div class="empty-receta">No hay ingredientes agregados aún</div>';
        document.getElementById('ingredientesReceta').value = '';
        return;
    }

    container.innerHTML = ingredientesReceta.map((ing, index) => `
        <div class="ingrediente-item">
            <div class="ingrediente-info">
                <div class="ingrediente-nombre">[${ing.codigo}] ${ing.nombre}</div>
                <div class="ingrediente-cantidad">${ing.cantidad} ${ing.unidad}</div>
            </div>
            <button type="button" class="btn-remove-ingrediente" onclick="eliminarIngredienteReceta(${index})">
                🗑️ Eliminar
            </button>
        </div>
    `).join('');

    // Actualizar input oculto
    document.getElementById('ingredientesReceta').value = JSON.stringify(ingredientesReceta);
}

// Eliminar ingrediente de la receta
function eliminarIngredienteReceta(index) {
    ingredientesReceta.splice(index, 1);
    renderizarIngredientesReceta();
}

// Actualizar campos según tipo de venta
function updateFormByType() {
    const tipo = document.getElementById('tipoVenta').value;
    const container = document.getElementById('camposDinamicos');

    let html = '';

    if (tipo === 'unidad') {
        html = `
            <div class="campos-dinamicos-grid">
                <div class="form-field">
                    <label>Unidad de compra <span class="required-star">*</span></label>
                    <select class="form-select" id="unidadCompra" required onchange="toggleUnidadCompraPersonalizada()">
                        <option value="">Seleccionar...</option>
                        <option value="CAJA">CAJA</option>
                        <option value="PACA">PACA</option>
                        <option value="UNIDAD">UNIDAD</option>
                        <option value="PAQUETE">PAQUETE</option>
                        <option value="BOLSA">BOLSA</option>
                        <option value="OTRA">OTRA (Especificar)</option>
                    </select>
                </div>
                <div class="form-field" id="campoUnidadPersonalizada" style="display: none;">
                    <label>Especificar unidad de compra <span class="required-star">*</span></label>
                    <input class="form-input" type="text" id="unidadCompraPersonalizada" placeholder="Ej: BOTELLA, GARRAFA, etc.">
                </div>
                <div class="form-field">
                    <label id="labelFactorUnidad">Factor <span class="required-star">*</span></label>
                    <input class="form-input" type="number" id="factor" required min="1" step="1" value="1">
                </div>
                <div class="form-field">
                    <label>Stock inicial (unidades) <span class="required-star">*</span></label>
                    <input class="form-input" type="number" id="stock" required min="0" step="0.01" placeholder="0">
                </div>
                <div class="form-field">
                    <label>Precio unitario <span class="required-star">*</span></label>
                    <div class="input-with-prefix">
                        <span class="prefix">$</span>
                        <input class="form-input" type="number" id="precio" required min="0" step="0.01" placeholder="0.00">
                    </div>
                </div>
                <div class="form-field">
                    <label>Costo unitario <span class="required-star">*</span></label>
                    <div class="input-with-prefix">
                        <span class="prefix">$</span>
                        <input class="form-input" type="number" id="costo" required min="0" step="0.01" placeholder="0.00">
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;

        // Listeners para UNIDAD
        setTimeout(() => {
            const unidadCompraSelect = document.getElementById('unidadCompra');
            const labelFactor = document.getElementById('labelFactorUnidad');

            function actualizarLabelFactorUnidad() {
                let unidadCompra;
                if (unidadCompraSelect.value === 'OTRA') {
                    const unidadPersonalizada = document.getElementById('unidadCompraPersonalizada').value.trim().toUpperCase();
                    unidadCompra = unidadPersonalizada || 'unidad de compra';
                } else {
                    unidadCompra = unidadCompraSelect.value || 'unidad de compra';
                }
                labelFactor.innerHTML = `¿Cuántas unidades tiene 1 ${unidadCompra}? <span class="required-star">*</span>`;
            }

            unidadCompraSelect.addEventListener('change', actualizarLabelFactorUnidad);
            const unidadPersonalizadaInput = document.getElementById('unidadCompraPersonalizada');
            unidadPersonalizadaInput.addEventListener('input', actualizarLabelFactorUnidad);
        }, 0);

    } else if (tipo === 'peso') {
        html = `
            <div class="campos-dinamicos-grid">
                <div class="form-field">
                    <label>Unidad de venta <span class="required-star">*</span></label>
                    <select class="form-select" id="unidadVenta" required>
                        <option value="">Seleccionar...</option>
                        <option value="libras">Libras</option>
                        <option value="kilogramos">Kilogramos</option>
                        <option value="gramos">Gramos</option>
                    </select>
                </div>
                <div class="form-field">
                    <label>Unidad de compra <span class="required-star">*</span></label>
                    <select class="form-select" id="unidadCompra" required onchange="toggleUnidadCompraPersonalizada()">
                        <option value="">Seleccionar...</option>
                        <option value="BULTO">BULTO</option>
                        <option value="LIBRA">LIBRA</option>
                        <option value="KILO">KILO</option>
                        <option value="ARROBA">ARROBA</option>
                        <option value="OTRA">OTRA (Especificar)</option>
                    </select>
                </div>
                <div class="form-field" id="campoUnidadPersonalizada" style="display: none;">
                    <label>Especificar unidad de compra <span class="required-star">*</span></label>
                    <input class="form-input" type="text" id="unidadCompraPersonalizada" placeholder="Ej: BOTELLA, GARRAFA, etc." style="text-transform: uppercase;">
                </div>
                <div class="form-field">
                    <label id="labelFactorPeso">Factor <span class="required-star">*</span></label>
                    <input class="form-input" type="number" id="factor" required min="0.01" step="0.01">
                </div>
                <div class="form-field">
                    <label id="labelStockPeso">Stock inicial <span class="required-star">*</span></label>
                    <input class="form-input" type="number" id="stock" required min="0" step="0.01" placeholder="0">
                </div>
                <div class="form-field">
                    <label id="labelPrecioPeso">Precio por unidad de venta <span class="required-star">*</span></label>
                    <div class="input-with-prefix">
                        <span class="prefix">$</span>
                        <input class="form-input" type="number" id="precio" required min="0" step="0.01" placeholder="0.00">
                    </div>
                </div>
                <div class="form-field">
                    <label id="labelCostoPeso">Costo por unidad de venta <span class="required-star">*</span></label>
                    <div class="input-with-prefix">
                        <span class="prefix">$</span>
                        <input class="form-input" type="number" id="costo" required min="0" step="0.01" placeholder="0.00">
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;

        // Listeners para PESO
        setTimeout(() => {
            const labelStockPeso = document.getElementById('labelStockPeso');
            const unidadVentaSelect = document.getElementById('unidadVenta');
            const unidadCompraSelect = document.getElementById('unidadCompra');
            const labelFactor = document.getElementById('labelFactorPeso');
            const labelPrecio = document.getElementById('labelPrecioPeso');
            const labelCosto = document.getElementById('labelCostoPeso');

            function actualizarLabelStockPeso() {
                const unidadVenta = unidadVentaSelect.value || 'unidad de venta';
                labelStockPeso.innerHTML = `Stock inicial (en ${unidadVenta}) <span class="required-star">*</span>`;
            }

            function actualizarLabelFactorPeso() {
                const unidadVenta = unidadVentaSelect.value || 'unidad de venta';
                let unidadCompra;
                if (unidadCompraSelect.value === 'OTRA') {
                    const unidadPersonalizada = document.getElementById('unidadCompraPersonalizada').value.trim().toUpperCase();
                    unidadCompra = unidadPersonalizada || 'unidad de compra';
                } else {
                    unidadCompra = unidadCompraSelect.value || 'unidad de compra';
                }
                labelFactor.innerHTML = `¿Cuántas ${unidadVenta} tiene 1 ${unidadCompra}? <span class="required-star">*</span>`;
            }

            function actualizarLabelsPrecioCostoPeso() {
                const unidadVenta = unidadVentaSelect.value || 'unidad de venta';
                labelPrecio.innerHTML = `Precio por ${unidadVenta} <span class="required-star">*</span>`;
                labelCosto.innerHTML = `Costo por ${unidadVenta} <span class="required-star">*</span>`;
            }

            unidadVentaSelect.addEventListener('change', () => {
                actualizarLabelFactorPeso();
                actualizarLabelsPrecioCostoPeso();
                actualizarLabelStockPeso();
            });
            unidadCompraSelect.addEventListener('change', actualizarLabelFactorPeso);
            const unidadPersonalizadaInput = document.getElementById('unidadCompraPersonalizada');
            unidadPersonalizadaInput.addEventListener('input', actualizarLabelFactorPeso);
        }, 0);

    } else if (tipo === 'medida') {
        html = `
            <div class="campos-dinamicos-grid">
                <div class="form-field">
                    <label>Unidad de venta <span class="required-star">*</span></label>
                    <select class="form-select" id="unidadVenta" required>
                        <option value="">Seleccionar...</option>
                        <option value="metros">Metros</option>
                        <option value="centimetros">Centímetros</option>
                        <option value="milimetros">Milímetros</option>
                    </select>
                </div>
                <div class="form-field">
                    <label>Unidad de compra <span class="required-star">*</span></label>
                    <select class="form-select" id="unidadCompra" required onchange="toggleUnidadCompraPersonalizada()">
                        <option value="">Seleccionar...</option>
                        <option value="ROLLO">ROLLO</option>
                        <option value="LAMINA">LAMINA</option>
                        <option value="BOBINA">BOBINA</option>
                        <option value="METRO">METRO</option>
                        <option value="OTRA">OTRA (Especificar)</option>
                    </select>
                </div>
                <div class="form-field" id="campoUnidadPersonalizada" style="display: none;">
                    <label>Especificar unidad de compra <span class="required-star">*</span></label>
                    <input class="form-input" type="text" id="unidadCompraPersonalizada" placeholder="Ej: PLIEGO, HOJA, etc." style="text-transform: uppercase;">
                </div>
                <div class="form-field">
                    <label id="labelFactorMedida">Factor <span class="required-star">*</span></label>
                    <input class="form-input" type="number" id="factor" required min="0.01" step="0.01">
                </div>
                <div class="form-field">
                    <label id="labelStockMedida">Stock inicial <span class="required-star">*</span></label>
                    <input class="form-input" type="number" id="stock" required min="0" step="0.01" placeholder="0">
                </div>
                <div class="form-field">
                    <label id="labelPrecioMedida">Precio por unidad de venta <span class="required-star">*</span></label>
                    <div class="input-with-prefix">
                        <span class="prefix">$</span>
                        <input class="form-input" type="number" id="precio" required min="0" step="0.01" placeholder="0.00">
                    </div>
                </div>
                <div class="form-field">
                    <label id="labelCostoMedida">Costo por unidad de venta <span class="required-star">*</span></label>
                    <div class="input-with-prefix">
                        <span class="prefix">$</span>
                        <input class="form-input" type="number" id="costo" required min="0" step="0.01" placeholder="0.00">
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;

        // Listeners para MEDIDA
        setTimeout(() => {
            const labelStockMedida = document.getElementById('labelStockMedida');
            const unidadVentaSelect = document.getElementById('unidadVenta');
            const unidadCompraSelect = document.getElementById('unidadCompra');
            const labelFactor = document.getElementById('labelFactorMedida');
            const labelPrecio = document.getElementById('labelPrecioMedida');
            const labelCosto = document.getElementById('labelCostoMedida');

            function actualizarLabelStockMedida() {
                const unidadVenta = unidadVentaSelect.value || 'unidad de venta';
                labelStockMedida.innerHTML = `Stock inicial (en ${unidadVenta}) <span class="required-star">*</span>`;
            }

            function actualizarLabelFactorMedida() {
                const unidadVenta = unidadVentaSelect.value || 'unidad de venta';
                let unidadCompra;
                if (unidadCompraSelect.value === 'OTRA') {
                    const unidadPersonalizada = document.getElementById('unidadCompraPersonalizada').value.trim().toUpperCase();
                    unidadCompra = unidadPersonalizada || 'unidad de compra';
                } else {
                    unidadCompra = unidadCompraSelect.value || 'unidad de compra';
                }
                labelFactor.innerHTML = `¿Cuántos ${unidadVenta} tiene 1 ${unidadCompra}? <span class="required-star">*</span>`;
            }

            function actualizarLabelsPrecioCostoMedida() {
                const unidadVenta = unidadVentaSelect.value || 'unidad de venta';
                labelPrecio.innerHTML = `Precio por ${unidadVenta} <span class="required-star">*</span>`;
                labelCosto.innerHTML = `Costo por ${unidadVenta} <span class="required-star">*</span>`;
            }

            unidadVentaSelect.addEventListener('change', () => {
                actualizarLabelFactorMedida();
                actualizarLabelsPrecioCostoMedida();
                actualizarLabelStockMedida();
            });
            unidadCompraSelect.addEventListener('change', actualizarLabelFactorMedida);
            const unidadPersonalizadaInput = document.getElementById('unidadCompraPersonalizada');
            unidadPersonalizadaInput.addEventListener('input', actualizarLabelFactorMedida);
        }, 0);
    }
}

// Función para agregar apodo en crear producto
function agregarApodoCrear() {
    const input = document.getElementById('nuevoApodoCrear');
    const apodo = input.value.trim().toLowerCase();

    if (!apodo) {
        alert('Debes escribir un apodo');
        return;
    }

    // Validar que no exista ya
    if (window.apodosCrearProducto.includes(apodo)) {
        alert('Este apodo ya está agregado');
        input.value = '';
        return;
    }

    // Agregar al array
    window.apodosCrearProducto.push(apodo);

    // Limpiar input
    input.value = '';

    // Renderizar lista
    renderizarApodosCrear();
}

// Función para eliminar apodo en crear producto
function eliminarApodoCrear(apodo) {
    // Obtener el nombre del producto actual
    const nombreProducto = document.getElementById('productoNombre').value.trim().toLowerCase();

    // Verificar si el apodo a eliminar es el nombre del producto
    if (apodo === nombreProducto) {
        alert('No puedes eliminar el nombre del producto de los apodos');
        return;
    }

    const index = window.apodosCrearProducto.indexOf(apodo);
    if (index > -1) {
        window.apodosCrearProducto.splice(index, 1);
        renderizarApodosCrear();
    }
}

// Función para renderizar la lista de apodos
function renderizarApodosCrear() {
    const container = document.getElementById('apodosItemsCrear');
    const containerParent = document.getElementById('listaApodosCrear');

    if (window.apodosCrearProducto.length === 0) {
        container.innerHTML = 'No hay apodos agregados aún';
        if (containerParent) containerParent.classList.add('empty');
    } else {
        if (containerParent) containerParent.classList.remove('empty');
        container.innerHTML = `<div class="apodos-tags">${window.apodosCrearProducto.map(apodo => `
            <span class="apodo-tag">
                🏷️ ${apodo}
                <button type="button" class="remove-apodo" onclick="eliminarApodoCrear('${apodo}')">×</button>
            </span>
        `).join('')}</div>`;
    }

    // Actualizar input oculto
    document.getElementById('apodos').value = window.apodosCrearProducto.join(',');
}

// Enviar formulario
async function submitProducto(event) {
    event.preventDefault();
    console.log('📤 Enviando formulario...');

    const btnSubmit = document.getElementById('btnSubmit');
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Creando...';

    try {
        // Asegurar que el nombre del producto esté en los apodos
        const nombreProducto = document.getElementById('productoNombre').value.trim().toLowerCase();
        if (nombreProducto && !window.apodosCrearProducto.includes(nombreProducto)) {
            window.apodosCrearProducto.push(nombreProducto);
        }

        // Obtener tipo de producto
        const tipoProducto = document.querySelector('input[name="tipoProducto"]:checked').value;
        const esProcesado = tipoProducto === 'procesado';

        // Validar receta si es procesado
        if (esProcesado && ingredientesReceta.length === 0) {
            throw new Error('Los productos procesados deben tener al menos 1 ingrediente en la receta');
        }

        // Capturar unidad de compra (normal o personalizada)
        let unidadCompra = document.getElementById('unidadCompra').value;
        if (unidadCompra === 'OTRA') {
            const unidadPersonalizada = document.getElementById('unidadCompraPersonalizada').value.trim().toUpperCase();
            if (!unidadPersonalizada) {
                throw new Error('Debes especificar la unidad de compra personalizada');
            }
            unidadCompra = unidadPersonalizada;
        }

        const formData = {
            producto: document.getElementById('productoNombre').value,
            tipo_venta: document.getElementById('tipoVenta').value,
            unidad_compra: unidadCompra,
            factor: parseFloat(document.getElementById('factor').value),
            stock: parseFloat(document.getElementById('stock').value),
            precio: parseFloat(document.getElementById('precio').value),
            costo: parseFloat(document.getElementById('costo').value),
            apodos: window.apodosCrearProducto.join(','),
            unidad_venta: document.getElementById('unidadVenta')?.value || 'unidades',
            tenant_id: userData.tenant_id,
            tenant_user_id: userData.tenant_user_id || null,
            es_procesado: esProcesado,
            tiene_receta: esProcesado
        };

        console.log('📦 Datos a enviar:', formData);

        // Insertar producto usando RPC
        const { data: producto, error: errorProducto } = await supabase
            .rpc('crear_producto_panel', {
                p_tenant_id: formData.tenant_id,
                p_producto: formData.producto,
                p_precio_venta: formData.precio,
                p_costo: formData.costo,
                p_factor_unidades: formData.factor,
                p_apodos_input: formData.apodos || '',
                p_tipo_venta: formData.tipo_venta,
                p_unidad_venta: formData.unidad_venta,
                p_unidad_compra: formData.unidad_compra,
                p_stock_actual: formData.stock,
                p_stock_inicial: formData.stock,
                p_updated_by: formData.tenant_user_id
            });

        if (errorProducto) {
            console.error('❌ Error insertando producto:', errorProducto);
            throw new Error(errorProducto.message || 'Error al crear producto');
        }

        if (!producto || producto.length === 0) {
            throw new Error('No se recibió respuesta del servidor');
        }

        const productoCreado = Array.isArray(producto) ? producto[0] : producto;
        console.log('✅ Producto insertado:', productoCreado);

        if (!productoCreado.codigo) {
            throw new Error('El producto se creó pero no se recibió el código');
        }

        // Actualizar campos es_procesado y tiene_receta
        if (esProcesado) {
            const { error: errorUpdate } = await supabase
                .from('productos')
                .update({
                    es_procesado: true,
                    tiene_receta: true,
                    updated_at: getTimestampTenant(),
                    updated_by: formData.tenant_user_id
                })
                .eq('producto_id', productoCreado.producto_id);

            if (errorUpdate) {
                console.error('⚠️ Error actualizando flags:', errorUpdate);
            }
        }

        // Procesar e insertar apodos
        let apodosInsertados = [];
        if (formData.apodos && formData.apodos.trim() !== '') {
            const apodosArray = formData.apodos
                .split(',')
                .map(a => a.trim())
                .filter(a => a !== '')
                .map(apodo => ({
                    tenant_id: formData.tenant_id,
                    producto_id: productoCreado.producto_id,
                    apodo: apodo.toLowerCase(),
                    producto: productoCreado.producto
                }));

            if (apodosArray.length > 0) {
                const { data: apodos, error: errorApodos } = await supabase
                    .from('productos_apodos')
                    .insert(apodosArray)
                    .select();

                if (errorApodos) throw errorApodos;
                apodosInsertados = apodos;
                console.log('✅ Apodos insertados:', apodosInsertados);
            }
        }

        // Insertar receta si es procesado
        let recetaInsertada = [];
        if (esProcesado && ingredientesReceta.length > 0) {
            console.log('🍴 Insertando receta con', ingredientesReceta.length, 'ingredientes');

            const recetaArray = ingredientesReceta.map((ing, index) => ({
                tenant_id: formData.tenant_id,
                producto_procesado_id: productoCreado.producto_id,
                ingrediente_id: ing.ingrediente_id,
                cantidad_requerida: ing.cantidad,
                unidad_medida: ing.unidad,
                orden_ingrediente: index + 1,
                created_by: formData.tenant_user_id
            }));

            const { data: receta, error: errorReceta } = await supabase
                .from('productos_recetas')
                .insert(recetaArray)
                .select();

            if (errorReceta) {
                console.error('❌ Error insertando receta:', errorReceta);
                throw new Error('Error al guardar la receta: ' + errorReceta.message);
            }

            recetaInsertada = receta;
            console.log('✅ Receta insertada:', recetaInsertada);
        }

        // Generar mensaje de confirmación
        const mensaje = generarMensajeConfirmacion(productoCreado, apodosInsertados, formData, recetaInsertada);

        // Mostrar mensaje de éxito
        const successDiv = document.getElementById('successMsg');
        const formDiv = document.getElementById('formCrearProducto');

        successDiv.innerHTML = mensaje;
        successDiv.classList.add('show');
        formDiv.style.display = 'none';

        console.log('✅ Producto creado exitosamente');

        // Agregar botón para cerrar
        setTimeout(() => {
            const btnCerrar = document.createElement('button');
            btnCerrar.textContent = 'Cerrar';
            btnCerrar.style.marginTop = '20px';
            btnCerrar.onclick = () => closeModal();
            successDiv.appendChild(btnCerrar);
        }, 100);

    } catch (error) {
        console.error('❌ Error:', error);
        showError(error.message || 'Error al crear producto');
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Crear Producto';
    }
}

// Generar mensaje de confirmación
function generarMensajeConfirmacion(producto, apodos, formData, receta = []) {
    const abreviaturaUnidad = formData.unidad_venta === 'libras' ? 'lbs' :
        formData.unidad_venta === 'kilogramos' ? 'kg' :
            formData.unidad_venta === 'gramos' ? 'g' :
                formData.unidad_venta;
    let listaApodos = '';
    if (apodos.length > 0) {
        listaApodos = apodos.map(a => `  • ${a.apodo} (${a.apodo_id})`).join('\n');
    } else {
        listaApodos = '  _Sin apodos_';
    }

    let lineaUnidad, lineaStock, lineaPrecio;

    if (formData.tipo_venta === 'peso') {
        lineaUnidad = `📏 Unidad de compra: ${formData.unidad_compra} (x${formData.factor} ${abreviaturaUnidad})\n📏 Unidad de venta: ${formData.unidad_venta}`;
        lineaStock = `📊 Stock inicial: ${producto.stock_actual} ${formData.unidad_venta}`;
        lineaPrecio = `💰 Precio por ${formData.unidad_venta}: $${parseFloat(producto.precio_venta).toLocaleString('es-CO')}`;
    } else if (formData.tipo_venta === 'medida') {
        lineaUnidad = `📏 Unidad de compra: ${formData.unidad_compra} (x${formData.factor} ${abreviaturaUnidad})\n📏 Unidad de venta: ${formData.unidad_venta}`;
        lineaStock = `📊 Stock inicial: ${producto.stock_actual} ${formData.unidad_venta}`;
        lineaPrecio = `💰 Precio por ${formData.unidad_venta}: $${parseFloat(producto.precio_venta).toLocaleString('es-CO')}`;
    } else {
        lineaUnidad = `📏 Unidad de compra: ${formData.unidad_compra} (x${formData.factor} unidades)`;
        lineaStock = `📊 Stock inicial: ${producto.stock_actual} unidades`;
        lineaPrecio = `💰 Precio unitario: $${parseFloat(producto.precio_venta).toLocaleString('es-CO')}`;
    }

    // Agregar información de receta si es procesado
    let seccionReceta = '';
    if (formData.es_procesado && receta.length > 0) {
        seccionReceta = '\n\n🍴 Receta (ingredientes por unidad):';
        ingredientesReceta.forEach(ing => {
            seccionReceta += `\n  • [${ing.codigo}] ${ing.nombre}: ${ing.cantidad} ${ing.unidad}`;
        });
    }

    return `✅ ¡Producto creado exitosamente!${formData.es_procesado ? ' 🍴' : ''}
📦 Producto: producto.producto{producto.producto}
producto.producto{formData.es_procesado ? ' (Procesado)' : ''}
🔢 Código: ${producto.codigo}
${lineaUnidad}
${lineaPrecio}
💵 Costo: $${parseFloat(producto.costo || 0).toLocaleString('es-CO')}
${lineaStock}
🏷️ Apodos registrados:
listaApodos{listaApodos}
listaApodos{seccionReceta}
👤 Creado por: ${userData.nombre}
🏪 Negocio: ${userData.tenants.nombre_negocio}

El producto ya está disponible para ventas.`;
}
