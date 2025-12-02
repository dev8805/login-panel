/**
 * ===========================================
 * AUTENTICACIÓN Y SESIÓN
 * ===========================================
 */

// Verificar sesión al cargar
async function checkSession() {
    try {
        console.log('🔍 Verificando sesión...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        console.log('📝 Sesión encontrada:', session);
        
        if (session) {
            await loadUserData(session.user.id);
            showDashboard();
        } else {
            console.log('❌ No hay sesión activa');
            showLogin();
        }
    } catch (error) {
        console.error('Error checking session:', error);
        showLogin();
    }
}

// Cargar datos del usuario
async function loadUserData(authUserId) {
    try {
        console.log('👤 Cargando datos del usuario:', authUserId);
        
        const { data, error } = await supabase
            .rpc('get_user_with_tenant', { p_user_id: authUserId });
        
        console.log('📦 Respuesta RPC:', data, error);
        
        if (error) throw error;
        if (!data) throw new Error('Usuario no encontrado');
        
        userData = {
            user_id: data.user_id,
            tenant_user_id: data.user_id,
            nombre: data.nombre,
            rol: data.rol,
            permisos: data.permisos,
            tenant_id: data.tenant_id,
            telefono_whatsapp: data.telefono_whatsapp,
            tenants: data.tenants
        };

        console.log('✅ Usuario cargado correctamente:', userData);

    } catch (error) {
        console.error('❌ Error loading user:', error);
        showError('Error cargando datos del usuario: ' + error.message);
        await logout();
    }
}

// Login
async function login() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const loginBtn = document.getElementById('loginBtn');
    
    if (!email || !password) {
        showError('Por favor completa todos los campos');
        return;
    }
    
    loginBtn.disabled = true;
    loginBtn.textContent = 'Iniciando sesión...';
    hideError();
    console.log('🔐 Intentando login con:', email);
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
        console.log('✅ Login exitoso:', data);
        
        await loadUserData(data.user.id);
        showDashboard();
        
    } catch (error) {
        console.error('Login error:', error);
        showError(error.message || 'Error al iniciar sesión');
        loginBtn.disabled = false;
        loginBtn.textContent = 'Iniciar Sesión';
    }
}

// Logout
async function logout() {
    try {
        // Desuscribirse de cambios en tiempo real
        if (window.canalMesas) {
            window.canalMesas.unsubscribe();
            window.canalMesas = null;
        }
        
        // Detener polling
        if (typeof detenerPollingMesas === 'function') {
            detenerPollingMesas();
        }
        
        await supabase.auth.signOut();
        userData = null;
        showLogin();
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Mostrar login
function showLogin() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('fabChat').style.display = 'none';
    document.getElementById('email').value = '';
    document.getElementById('password').value = '';
}

// Mostrar dashboard
function showDashboard() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('fabChat').style.display = 'flex';
    
    document.getElementById('userName').textContent = `👋 Hola, ${userData.nombre}`;
    document.getElementById('userRole').textContent = `Rol: ${userData.rol}`;
    document.getElementById('businessName').textContent = `🏪 ${userData.tenants.nombre_negocio}`;
    
    renderMenu();
}

// Event listeners al cargar
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('email')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('password').focus();
    });
    
    document.getElementById('password')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') login();
    });
    
    checkSession();
});
