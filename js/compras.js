/**
 * ===========================================
 * COMPRAS - REGISTRO DE INVENTARIO
 * ===========================================
 */

// Cargar formulario de compra
async function cargarFormularioCompra(modalBody) {
    modalBody.innerHTML = `
        <div id="successCompra" class="success-message"></div>
        <div id="errorCompra" class="error"></div>
        
        <div id="compraForm">
            <!-- Producto con autocompletado -->
            <div class="form-group">
                <label for="productoCompra" class="required">Producto</label>
                <div class="input-wrapper">
                    <input 
                        type="text" 
                        id="productoCompra" 
                        placeholder="Escribe para buscar..." 
                        autocomplete="off"
                        required
                    >
                    <div class="autocomplete-list" id="autocompleteListCompra"></div>
                </div>
                <div class="info-stock" id="stockInfoCompra"></div>
            </div>
            
            <!-- Medida de Compra -->
            <div class="form-group">
                <label class="required">Medida de Compra</label>
                <div class="medida-options" id="medidaOptionsCompra">
                    <p style="color: #888;">Selecciona un producto primero</p>
                </div>
            </div>
            
            <!-- Cantidad -->
            <div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 12px; margin-bottom: 20px;">
                
                <div>
                    <label for="cantidadCompra" class="required" style="font-size: 13px; margin-bottom: 6px;">Cant.</label>
                    <input 
                        type="number" 
                        id="cantidadCompra" 
                        placeholder="0" 
                        step="0.01" 
                        required
                        style="padding: 8px 12px; font-size: 15px; text-align: center;"
                    >
                </div>
                
                <div>
                    <label for="valorTotalCompra" class="required" style="font-size: 13px; margin-bottom: 6px;">Valor Total</label>
                    <div class="input-wrapper">
                        <input 
                            type="number" 
                            id="valorTotalCompra" 
                            placeholder="$ 0" 
                            step="0.01"
                            required
                            style="padding: 8px 12px; font-size: 16px; font-weight: 700; color: #667eea; background: #f8fafc;"
                        >
                    </div>
                </div>

            </div>
            
            <div style="text-align: center; margin-top: 15px;">
                <button 
                    type="button" 
                    id="submitBtnCompra" 
                    style="width: auto; padding: 10px 30px; display: inline-block; font-size: 14px; border-radius: 20px;"
                >
                    Registrar Compra
                </button>
            </div>
        </div>
    `;

    // Inicializar funcionalidad del formulario
    await inicializarFormularioCompra();
}

// Generar opciones de medida para compra (ESTILO BOTONES)
function generarOpcionesMedidaCompra(producto, medidaElement) {
    medidaElement.innerHTML = '';

    // 1. Definir opciones evitando duplicados
    const opciones = [];
    const unidadesVistas = new Set();

    // Helper para abreviar unidades
    const abreviar = (u) => {
        if (!u) return '';
        u = u.toLowerCase();
        if (u.includes('unidad')) return 'und';
        if (u === 'libras') return 'lbs';
        if (u === 'kilogramos') return 'kg';
        if (u === 'gramos') return 'g';
        if (u === 'metros') return 'm';
        return u;
    };

    // Función helper para agregar opción
    const agregarOpcion = (valor, etiqueta, tipo, factor = 1) => {
        if (!valor) return;
        const valorNorm = valor.toUpperCase();

        // Personalizar etiqueta
        let etiquetaFinal = valorNorm;

        // Solo para COMPRA: Agregar factor si es mayor a 1
        if (tipo === 'Compra' && factor > 1) {
            const unidadBase = abreviar(producto.unidad_venta || 'und');
            etiquetaFinal = `${valorNorm} (x ${factor} ${unidadBase})`;
        }

        if (!unidadesVistas.has(valorNorm)) {
            opciones.push({ valor: valorNorm, etiqueta: etiquetaFinal });
            unidadesVistas.add(valorNorm);
        }
    };

    // Agregar unidad de VENTA (siempre disponible, sin factor mostrado)
    if (producto.unidad_venta) {
        agregarOpcion(producto.unidad_venta, producto.unidad_venta, 'Venta');
    }

    // Agregar unidad de COMPRA (con factor)
    if (producto.unidad_compra) {
        const factor = parseFloat(producto.factor_unidades) || 1;
        agregarOpcion(producto.unidad_compra, producto.unidad_compra, 'Compra', factor);
    }

    // Si no hay nada, fallback
    if (opciones.length === 0) {
        agregarOpcion('UNIDAD', 'UNIDAD', 'General');
    }

    // 2. Renderizar estilo "Chips/Botones"
    medidaElement.style.display = 'flex';
    medidaElement.style.gap = '10px';
    medidaElement.style.flexWrap = 'wrap';

    opciones.forEach((opcion, index) => {
        const wrapper = document.createElement('div');
        wrapper.style.flex = '1';
        wrapper.style.minWidth = '100px';
        wrapper.style.padding = '14px 10px';
        wrapper.style.border = '2px solid #e2e8f0';
        wrapper.style.borderRadius = '10px';
        wrapper.style.cursor = 'pointer';
        wrapper.style.textAlign = 'center';
        wrapper.style.transition = 'all 0.2s';
        wrapper.style.position = 'relative';
        wrapper.style.background = 'white';
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.justifyContent = 'center';

        // Input Radio Oculto
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'medidaCompra';
        radio.value = opcion.valor;
        radio.style.display = 'none';

        // Contenido Visual
        const label = document.createElement('div');
        label.textContent = opcion.etiqueta;
        label.style.fontWeight = '700';
        label.style.color = '#334155';
        label.style.fontSize = '13px';

        wrapper.appendChild(radio);
        wrapper.appendChild(label);

        // Lógica de Selección Visual
        wrapper.onclick = () => {
            // Resetear todos
            Array.from(medidaElement.children).forEach(child => {
                child.style.borderColor = '#e2e8f0';
                child.style.backgroundColor = 'white';
                const l = child.querySelector('div');
                if (l) l.style.color = '#334155';
            });

            // Activar este
            radio.checked = true;
            wrapper.style.borderColor = '#667eea';
            wrapper.style.backgroundColor = '#eff6ff';
            label.style.color = '#667eea';
        };

        // Seleccionar el primero por defecto
        if (index === 0) {
            radio.checked = true;
            wrapper.style.borderColor = '#667eea';
            wrapper.style.backgroundColor = '#eff6ff';
            label.style.color = '#667eea';
        }

        medidaElement.appendChild(wrapper);
    });
}

// Función para mostrar autocomplete
function mostrarAutocompleteCompra(productos, listElement, stockElement, medidaElement) {
    listElement.innerHTML = '';

    if (productos.length === 0) {
        const div = document.createElement('div');
        div.className = 'autocomplete-item';
        div.innerHTML = '<div class="autocomplete-item-nombre" style="color: #999;">No se encontraron productos</div>';
        listElement.appendChild(div);
        listElement.classList.add('active');
        return;
    }

    productos.forEach(prod => {
        const div = document.createElement('div');
        div.className = 'autocomplete-item';
        div.innerHTML = `
            <div class="autocomplete-item-nombre">${prod.producto}</div>
            <div class="autocomplete-item-codigo">Código: ${prod.codigo} | Stock: ${prod.stock_actual} ${prod.unidad_venta}</div>
        `;

        div.addEventListener('click', () => {
            window.productoSeleccionadoCompra = () => prod;
            document.getElementById('productoCompra').value = `${prod.producto} (${prod.codigo})`;
            listElement.classList.remove('active');

            stockElement.textContent = `Stock actual: ${prod.stock_actual} ${prod.unidad_venta}`;

            generarOpcionesMedidaCompra(prod, medidaElement);
        });

        listElement.appendChild(div);
    });

    listElement.classList.add('active');
}

// Calcular unidades ingresadas según tipo de venta
function calcularUnidadesIngresadasCompra(producto, cantidad, unidadMedida) {
    const stockActual = parseFloat(producto.stock_actual) || 0;
    const tipoVenta = producto.tipo_venta;
    const unidadVenta = producto.unidad_venta;
    const factor = parseFloat(producto.factor_unidades) || 1;

    let unidadesIngresadas;

    if (tipoVenta === 'peso') {
        const unidadMedidaNorm = unidadMedida.toLowerCase().replace(/s$/, '');
        const unidadVentaNorm = unidadVenta.toLowerCase().replace(/s$/, '');

        if (unidadMedidaNorm === unidadVentaNorm) {
            unidadesIngresadas = cantidad;
        } else {
            unidadesIngresadas = cantidad * factor;
        }
    } else if (tipoVenta === 'medida') {
        const unidadMedidaNorm = unidadMedida.toLowerCase().replace(/s$/, '');
        const unidadVentaNorm = unidadVenta.toLowerCase().replace(/s$/, '');

        if (unidadMedidaNorm === unidadVentaNorm) {
            unidadesIngresadas = cantidad;
        } else {
            unidadesIngresadas = cantidad * factor;
        }
    } else {
        if (unidadMedida === 'unidades' || unidadMedida === 'unidad') {
            unidadesIngresadas = cantidad;
        } else {
            unidadesIngresadas = cantidad * factor;
        }
    }

    const nuevoStock = stockActual + unidadesIngresadas;

    return {
        unidadesIngresadas,
        nuevoStock,
        stockAnterior: stockActual
    };
}

// Enviar compra desde el panel
async function enviarCompraPanel() {
    const productoSeleccionado = window.productoSeleccionadoCompra();
    const cantidadInput = document.getElementById('cantidadCompra');
    const valorTotalInput = document.getElementById('valorTotalCompra');
    const submitBtn = document.getElementById('submitBtnCompra');

    // Validar
    if (!productoSeleccionado) {
        mostrarErrorCompra('Debes seleccionar un producto');
        return;
    }

    if (!cantidadInput.value || parseFloat(cantidadInput.value) <= 0) {
        mostrarErrorCompra('La cantidad debe ser mayor a 0');
        return;
    }

    if (!valorTotalInput.value || parseFloat(valorTotalInput.value) <= 0) {
        mostrarErrorCompra('El valor total debe ser mayor a 0');
        return;
    }

    if (!document.querySelector('input[name="medidaCompra"]:checked')) {
        mostrarErrorCompra('Debes seleccionar una medida de compra');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Registrando...';

    try {
        const medidaSeleccionada = document.querySelector('input[name="medidaCompra"]:checked').value;
        const cantidad = parseFloat(cantidadInput.value);
        const valorTotal = parseFloat(valorTotalInput.value);

        console.log('🛒 Iniciando registro de compra...');

        // Obtener fecha actual del tenant (ya no necesitamos consultar zona_horaria)
        const fechaSQL = getFechaTenant();

        // Calcular unidades y nuevo stock
        const calculoStock = calcularUnidadesIngresadasCompra(
            productoSeleccionado,
            cantidad,
            medidaSeleccionada
        );

        const { unidadesIngresadas, nuevoStock, stockAnterior } = calculoStock;
        const nuevoCosto = unidadesIngresadas > 0 ? (valorTotal / unidadesIngresadas) : 0;

        console.log('📊 Cálculos:', {
            unidadesIngresadas,
            stockAnterior,
            nuevoStock,
            nuevoCosto
        });

        // Insertar movimiento de inventario
        const { data: movimiento, error: errorMovimiento } = await supabase
            .from('movimientos_inventario')
            .insert({
                tenant_id: userData.tenant_id,
                producto_id: productoSeleccionado.producto_id,
                codigo: productoSeleccionado.codigo,
                cantidad: unidadesIngresadas,
                tipo: 'entrada',
                costo_unitario: nuevoCosto,
                costo_total: valorTotal,
                razon: `Entrada de ${cantidad} ${medidaSeleccionada}`,
                user_id: userData.user_id,
                activo: true,
                created_at: getTimestampTenant()
            })
            .select()
            .single();

        if (errorMovimiento) throw errorMovimiento;
        console.log('✅ Movimiento registrado');

        // Actualizar stock y costo en productos
        const { error: errorProducto } = await supabase
            .from('productos')
            .update({
                stock_actual: nuevoStock,
                costo: nuevoCosto,
                updated_at: getTimestampTenant(),
                updated_by: userData.user_id
            })
            .eq('producto_id', productoSeleccionado.producto_id);

        if (errorProducto) throw errorProducto;
        console.log('✅ Stock actualizado');

        // Actualizar o crear caja diaria
        const { data: cajaHoyData } = await supabase
            .from('caja_diaria')
            .select('*')
            .eq('tenant_id', userData.tenant_id)
            .eq('fecha', fechaSQL);

        let cajaEsperada = 0;

        if (cajaHoyData && cajaHoyData.length > 0) {
            // Actualizar caja existente
            const cajaActual = cajaHoyData[0];
            const comprasActuales = parseFloat(cajaActual.compras_totales) || 0;
            const nuevasCompras = comprasActuales + valorTotal;

            const baseInicial = parseFloat(cajaActual.base_inicial) || 0;
            const ventasTotales = parseFloat(cajaActual.ventas_totales) || 0;
            const gastosTotales = parseFloat(cajaActual.gastos_totales) || 0;

            cajaEsperada = baseInicial + ventasTotales - gastosTotales - nuevasCompras;

            await supabase
                .from('caja_diaria')
                .update({
                    compras_totales: nuevasCompras,
                    caja_esperada: cajaEsperada,
                    updated_at: getTimestampTenant()
                })
                .eq('id', cajaActual.id);

            console.log('✅ Caja diaria actualizada');
        } else {
            // Crear nuevo registro de caja
            const { data: cajaAnteriorData } = await supabase
                .from('caja_diaria')
                .select('caja_esperada')
                .eq('tenant_id', userData.tenant_id)
                .lt('fecha', fechaSQL)
                .order('fecha', { ascending: false })
                .limit(1);

            const cajaAnterior = cajaAnteriorData && cajaAnteriorData.length > 0
                ? parseFloat(cajaAnteriorData[0].caja_esperada)
                : 0;

            cajaEsperada = cajaAnterior - valorTotal;

            await supabase
                .from('caja_diaria')
                .insert({
                    tenant_id: userData.tenant_id,
                    fecha: fechaSQL,
                    caja_dia_anterior: cajaAnterior,
                    base_agregada: 0,
                    base_inicial: cajaAnterior,
                    ventas_totales: 0,
                    gastos_totales: 0,
                    compras_totales: valorTotal,
                    consumos_totales: 0,
                    mermas_totales: 0,
                    caja_esperada: cajaEsperada,
                    created_at: getTimestampTenant(),
                    updated_at: getTimestampTenant()
                });

            console.log('✅ Caja diaria creada');
        }

        // Determinar unidad de stock según tipo de venta
        let unidadStock, stockFormateado;

        if (productoSeleccionado.tipo_venta === 'unidad') {
            unidadStock = 'und';
            stockFormateado = Math.round(nuevoStock);
        } else if (productoSeleccionado.tipo_venta === 'peso') {
            unidadStock = productoSeleccionado.unidad_venta || 'libras';
            stockFormateado = nuevoStock.toFixed(2);
        } else if (productoSeleccionado.tipo_venta === 'medida') {
            unidadStock = productoSeleccionado.unidad_venta || 'metros';
            stockFormateado = nuevoStock.toFixed(2);
        } else {
            unidadStock = 'und';
            stockFormateado = Math.round(nuevoStock);
        }

        const fechaActual = formatearFechaTenant(new Date().toISOString(), {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });

        const valorFormateado = `$${valorTotal.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
        const cajaFormateada = `$${cajaEsperada.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;

        const mensajeExito = `✅ Registro de entrada a Inventario
${fechaActual}

[${productoSeleccionado.codigo}] ${cantidad} ${medidaSeleccionada} ${productoSeleccionado.producto} - ${valorFormateado} / Stock: ${stockFormateado} ${unidadStock}

💰 Total de la COMPRA: ${valorFormateado}
💼 Caja esperada: ${cajaFormateada}`;

        mostrarExitoCompra(mensajeExito);

        // Ocultar formulario
        document.getElementById('compraForm').classList.add('hidden');
        submitBtn.classList.add('hidden');

        console.log('✅ Compra registrada exitosamente');

    } catch (error) {
        console.error('❌ Error:', error);
        mostrarErrorCompra('Error al registrar la compra: ' + error.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Registrar Compra';
    }
}

// Inicializar formulario de compra
async function inicializarFormularioCompra() {
    let productosData = [];
    let productoSeleccionado = null;

    // Cargar productos
    try {
        const { data, error } = await supabase
            .from('productos')
            .select('*')
            .eq('tenant_id', userData.tenant_id)
            .eq('activo', true);

        if (error) throw error;
        productosData = data;

        console.log('📦 Productos cargados para compra:', productosData.length);
    } catch (error) {
        console.error('Error cargando productos:', error);
        mostrarErrorCompra('Error cargando productos: ' + error.message);
        return;
    }

    // Elementos del DOM
    const productoInput = document.getElementById('productoCompra');
    const autocompleteList = document.getElementById('autocompleteListCompra');
    const stockInfo = document.getElementById('stockInfoCompra');
    const medidaOptionsDiv = document.getElementById('medidaOptionsCompra');
    const submitBtn = document.getElementById('submitBtnCompra');

    // Agregar event listener al botón
    submitBtn.addEventListener('click', enviarCompraPanel);

    // Autocompletado
    productoInput.addEventListener('input', (e) => {
        const valor = e.target.value.toLowerCase().trim();

        if (valor.length === 0) {
            autocompleteList.classList.remove('active');
            productoSeleccionado = null;
            stockInfo.textContent = '';
            medidaOptionsDiv.innerHTML = '<p style="color: #888;">Selecciona un producto primero</p>';
            return;
        }

        const filtrados = productosData.filter(p =>
            p.producto.toLowerCase().includes(valor) ||
            p.codigo.toLowerCase().includes(valor) ||
            (p.apodos_input && p.apodos_input.toLowerCase().includes(valor))
        );

        mostrarAutocompleteCompra(filtrados, autocompleteList, stockInfo, medidaOptionsDiv);
    });

    // Cerrar autocomplete al hacer click afuera
    document.addEventListener('click', (e) => {
        if (e.target !== productoInput && !autocompleteList.contains(e.target)) {
            autocompleteList.classList.remove('active');
        }
    });

    // Guardar referencia al producto seleccionado
    window.productoSeleccionadoCompra = () => productoSeleccionado;
}

// Mostrar error en compra
function mostrarErrorCompra(mensaje) {
    const errorDiv = document.getElementById('errorCompra');
    const successDiv = document.getElementById('successCompra');

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

// Mostrar éxito en compra
function mostrarExitoCompra(mensaje) {
    const successDiv = document.getElementById('successCompra');
    const errorDiv = document.getElementById('errorCompra');

    if (successDiv) {
        successDiv.textContent = mensaje;
        successDiv.classList.add('show');
    }
    if (errorDiv) {
        errorDiv.classList.remove('show');
    }
}
