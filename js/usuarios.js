/**
 * ===========================================
 * USUARIOS - GESTIÓN Y CREACIÓN
 * ===========================================
 */

// Cargar formulario de usuario
async function cargarFormularioUsuario(modalBody) {
    // Mostrar loading
    modalBody.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <p>Cargando formulario...</p>
        </div>
    `;
    try {
        // Cargar roles disponibles directamente de la tabla
        console.log('🔍 Iniciando carga de roles...');
        const { data: roles, error: errorRoles } = await supabase
            .from('roles_templates')
            .select('*')
            .order('rol');
        
        console.log('📊 Respuesta cruda de roles_templates:', roles);
        console.log('❌ Error en consulta:', errorRoles);
        
        if (errorRoles) {
            console.error('❌ Error cargando roles:', errorRoles);
            throw new Error('Error al cargar roles: ' + errorRoles.message);
        }
        
        console.log('📋 Roles cargados:', roles);
        
        // Verificar que todos los roles tengan permisos
        const rolesValidos = roles.filter(r => r.permisos && typeof r.permisos === 'object');
        console.log('📋 Roles cargados completos:', roles);
        console.log('📋 Roles válidos con permisos:', rolesValidos);
        
        // Si no hay roles válidos, intentar usar todos los roles disponibles
        const rolesAUsar = rolesValidos.length > 0 ? rolesValidos : roles;
        
        if (rolesAUsar.length === 0) {
            throw new Error('No se encontraron roles en la base de datos');
        }
        
        console.log('📋 Roles a usar en el formulario:', rolesAUsar);
        
       // Generar opciones de roles
        const opcionesRoles = rolesAUsar.map(rol => 
            `<option value="${rol.rol}">${rol.nombre_display}${rol.descripcion ? ' - ' + rol.descripcion : ''}</option>`
        ).join('');
        
        // Cargar formulario con roles
        modalBody.innerHTML = `
            <div id="successUsuario" class="success-message"></div>
            <div id="errorUsuario" class="error"></div>
            
            <form id="formCrearUsuario" onsubmit="submitUsuario(event)">
                <div class="form-group">
                    <label for="nombreUsuario" class="required">Nombre completo</label>
                    <input 
                        type="text" 
                        id="nombreUsuario" 
                        placeholder="Nombre del usuario" 
                        required
                    >
                </div>
                
                <div class="form-group">
                    <label for="emailUsuario" class="required">Correo Electrónico</label>
                    <input 
                        type="email" 
                        id="emailUsuario" 
                        placeholder="usuario@ejemplo.com" 
                        required
                    >
                </div>
                
                <div class="form-group">
                    <label for="rolUsuario" class="required">Rol del usuario</label>
                    <select id="rolUsuario" required>
                        <option value="">Seleccionar rol...</option>
                        ${opcionesRoles}
                    </select>
                </div>
                
                <button type="submit" id="btnSubmitUsuario">Crear Usuario</button>
            </form>
        `;
    } catch (error) {
        console.error('❌ Error cargando formulario:', error);
        modalBody.innerHTML = `
            <div class="error show">
                Error al cargar el formulario: ${error.message}
            </div>
        `;
    }
}

// Enviar formulario de usuario
async function submitUsuario(event) {
    event.preventDefault();
    
    const btnSubmit = document.getElementById('btnSubmitUsuario');
    const nombreInput = document.getElementById('nombreUsuario');
    const emailInput = document.getElementById('emailUsuario'); 
    const rolSelect = document.getElementById('rolUsuario');
    
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Creando...';
    
    try {
        const nombre = nombreInput.value.trim();
        const email = emailInput.value.trim(); 
        const rolSeleccionado = rolSelect.value;
        
        // Validar campos
        if (!nombre) throw new Error('El nombre es requerido');
        if (!email) throw new Error('El correo es requerido');
        if (!rolSeleccionado) throw new Error('Debes seleccionar un rol');
        
        console.log('📝 Creando usuario:', { nombre, email, rol: rolSeleccionado });

        // Obtener información del rol directamente de roles_templates
        const { data: rolInfo, error: errorRol } = await supabase
            .from('roles_templates')
            .select('rol, nombre_display, descripcion, permisos')
            .eq('rol', rolSeleccionado)
            .eq('activo', true)
            .single();
        
        if (errorRol) {
            console.error('❌ Error obteniendo rol:', errorRol);
            throw new Error('Error al obtener información del rol: ' + errorRol.message);
        }

        console.log('📋 Respuesta roles_templates:', rolInfo);
        if (!rolInfo) {
            throw new Error('No se encontró información del rol');
        }

        // Validar que los permisos existan y sean un objeto válido
        if (!rolInfo.permisos || typeof rolInfo.permisos !== 'object') {
            throw new Error('El rol no tiene permisos válidos definidos');
        }

        console.log('📋 Info del rol completa:', rolInfo);
        console.log('🔑 Permisos del rol (tipo):', typeof rolInfo.permisos);
        console.log('🔑 Permisos del rol (contenido):', JSON.stringify(rolInfo.permisos, null, 2));
        
        // Preparar datos para insertar - IMPORTANTE: permisos debe ser el objeto JSON directo
        const permisosParaInsertar = typeof rolInfo.permisos === 'string' 
            ? JSON.parse(rolInfo.permisos) 
            : rolInfo.permisos;

        console.log('🔐 Permisos procesados:', JSON.stringify(permisosParaInsertar, null, 2));
        
        const datosUsuario = {
            tenant_id: userData.tenant_id,
            email: email, 
            nombre: nombre,
            rol: rolSeleccionado,
            activo: true,
            permisos: permisosParaInsertar
        };
        
        console.log('📝 Datos a insertar:', datosUsuario);
        console.log('🔑 Tipo de permisos:', typeof datosUsuario.permisos);
        console.log('🔑 Permisos JSON:', JSON.stringify(datosUsuario.permisos, null, 2));
        
        // Insertar usuario en tenant_users
        const { data: nuevoUsuario, error: errorUsuario } = await supabase
            .from('tenant_users')
            .insert(datosUsuario)
            .select('*, permisos')  
            .single();
        
        if (errorUsuario) {
            console.error('❌ Error insertando usuario:', errorUsuario);
            console.error('❌ Detalle del error:', JSON.stringify(errorUsuario, null, 2));
            throw new Error('Error al crear usuario: ' + errorUsuario.message);
        }
        
        console.log('✅ Usuario creado:', nuevoUsuario);
        console.log('✅ Permisos guardados:', nuevoUsuario.permisos);
        
        // Verificar que los permisos se guardaron correctamente
        if (!nuevoUsuario.permisos) {
            console.warn('⚠️ ADVERTENCIA: El usuario se creó pero los permisos están vacíos');
        }
        
        // Mostrar mensaje de éxito
        const mensajeExito = `✅ ¡Usuario creado exitosamente!
👤 Nombre: ${nuevoUsuario.nombre}
📧 Email: ${nuevoUsuario.email}
👔 Rol: ${rolInfo.nombre_display}
🏪 Negocio: ${userData.tenants.nombre_negocio}

El usuario ya puede acceder al sistema.`;
        
        mostrarExitoUsuario(mensajeExito);
        
        // Ocultar formulario
        document.getElementById('formCrearUsuario').style.display = 'none';
        
        console.log('✅ Usuario registrado exitosamente');
        
    } catch (error) {
        console.error('❌ Error:', error);
        mostrarErrorUsuario(error.message || 'Error al crear usuario');
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Crear Usuario';
    }
}

// Mostrar error en usuario
function mostrarErrorUsuario(mensaje) {
    const errorDiv = document.getElementById('errorUsuario');
    const successDiv = document.getElementById('successUsuario');
    
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

// Mostrar éxito en usuario
function mostrarExitoUsuario(mensaje) {
    const successDiv = document.getElementById('successUsuario');
    const errorDiv = document.getElementById('errorUsuario');
    
    if (successDiv) {
        successDiv.textContent = mensaje;
        successDiv.classList.add('show');
    }
    if (errorDiv) {
        errorDiv.classList.remove('show');
    }
    
    // Agregar botón para cerrar
    setTimeout(() => {
        const btnCerrar = document.createElement('button');
        btnCerrar.textContent = 'Cerrar';
        btnCerrar.style.marginTop = '20px';
        btnCerrar.onclick = () => closeModalUsuario();
        successDiv.appendChild(btnCerrar);
    }, 100);
}
