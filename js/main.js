/**
 * ===========================================
 * LÓGICA PRINCIPAL Y MENÚ
 * ===========================================
 */

// Renderizar menú según permisos
function renderMenu() {
    const menuGrid = document.getElementById('menuGrid');
    menuGrid.innerHTML = '';
    
    const permisos = userData.permisos || {};
    
    const ordenGuardado = localStorage.getItem(`menu_orden_${userData.tenant_id}`);
    let opcionesOrdenadas = [...menuOptions];
    
    if (ordenGuardado) {
        const orden = JSON.parse(ordenGuardado);
        opcionesOrdenadas.sort((a, b) => {
            const indexA = orden.indexOf(a.id);
            const indexB = orden.indexOf(b.id);
            return indexA - indexB;
        });
    }
    
    opcionesOrdenadas.forEach(option => {
        const hasPermission = checkPermission(permisos, option.permission);
        
        const menuItem = document.createElement('a');
        menuItem.className = `menu-item ${!hasPermission ? 'disabled' : ''}`;
        menuItem.dataset.optionId = option.id;
        
        if (hasPermission) {
            menuItem.draggable = true;
            configurarDragAndDrop(menuItem, option);
        }
        
        if (option.modal) {
            menuItem.href = '#';
            menuItem.onclick = (e) => {
                e.preventDefault();
                if (hasPermission) openModal(option.id);
            };
        } else {
            menuItem.href = hasPermission ? `${option.url}?auth=true` : '#';
            menuItem.target = hasPermission ? '_blank' : '';
        }
        
        menuItem.innerHTML = `
            <div class="menu-item-icon">${option.icon}</div>
            <div class="menu-item-title">${option.title}</div>
        `;
        
        menuGrid.appendChild(menuItem);
    });
}

// Configurar drag and drop
function configurarDragAndDrop(menuItem, option) {
    let dragStarted = false;
    let startX, startY;
    
    menuItem.addEventListener('mousedown', (e) => {
        startX = e.clientX;
        startY = e.clientY;
        dragStarted = false;
    });
    
    menuItem.addEventListener('dragstart', (e) => {
        dragStarted = true;
        draggedItem = menuItem;
        menuItem.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', menuItem.dataset.optionId);
        
        setTimeout(() => {
            menuItem.style.opacity = '0.4';
        }, 0);
    });
    
    menuItem.addEventListener('dragend', (e) => {
        menuItem.classList.remove('dragging');
        menuItem.style.opacity = '1';
        
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('drag-over');
        });
        
        if (dragStarted) {
            guardarOrdenAutomatico();
        }
        
        draggedItem = null;
        dragStarted = false;
    });
    
    menuItem.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        if (draggedItem && draggedItem !== menuItem) {
            const menuGrid = document.getElementById('menuGrid');
            const afterElement = getDragAfterElement(menuGrid, e.clientX, e.clientY);
            
            if (afterElement == null) {
                menuGrid.appendChild(draggedItem);
            } else {
                menuGrid.insertBefore(draggedItem, afterElement);
            }
        }
    });
    
    menuItem.addEventListener('dragenter', (e) => {
        if (draggedItem && draggedItem !== menuItem) {
            menuItem.classList.add('drag-over');
        }
    });
    
    menuItem.addEventListener('dragleave', (e) => {
        menuItem.classList.remove('drag-over');
    });
    
    menuItem.addEventListener('drop', (e) => {
        e.preventDefault();
        menuItem.classList.remove('drag-over');
    });
}

function getDragAfterElement(container, x, y) {
    const draggableElements = [...container.querySelectorAll('.menu-item:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const centerX = box.left + box.width / 2;
        const centerY = box.top + box.height / 2;
        
        const offsetX = x - centerX;
        const offsetY = y - centerY;
        
        const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
        
        if (distance < closest.distance) {
            const insertBefore = (offsetY < 0) || (offsetY === 0 && offsetX < 0);
            return { distance: distance, element: insertBefore ? child : child.nextElementSibling };
        } else {
            return closest;
        }
    }, { distance: Number.POSITIVE_INFINITY }).element;
}

function guardarOrdenAutomatico() {
    const menuGrid = document.getElementById('menuGrid');
    const items = menuGrid.querySelectorAll('.menu-item');
    const nuevoOrden = Array.from(items).map(item => item.dataset.optionId);
    
    localStorage.setItem(`menu_orden_${userData.tenant_id}`, JSON.stringify(nuevoOrden));
    console.log('✅ Orden guardado automáticamente');
}

// Abrir modal
function openModal(modalId) {
    if (modalId === 'chat_asistente') {
        const fab = document.getElementById('fabChat');
        if (fab) fab.style.display = 'none';
        abrirModalChat();
        return;
    }
    
    console.log('🔓 Abriendo modal:', modalId);
    
    if (modalId === 'crear_producto') {
        cargarFormularioProducto();
    } else if (modalId === 'registrar_compra') {
        const modal = document.getElementById('modalRegistrarCompra');
        const modalBody = document.getElementById('modalBodyCompra');
        cargarFormularioCompra(modalBody);
        modal.classList.add('show');
    } else if (modalId === 'crear_usuario') {
        const modal = document.getElementById('modalCrearUsuario');
        const modalBody = document.getElementById('modalBodyUsuario');
        cargarFormularioUsuario(modalBody);
        modal.classList.add('show');
    } else if (modalId === 'informes') {
        const modal = document.getElementById('modalInformes');
        const modalBody = document.getElementById('modalBodyInformes');
        cargarInformes(modalBody);
        modal.classList.add('show');
    } else if (modalId === 'editar_producto') {
        const modal = document.getElementById('modalEditarProducto');
        const modalBody = document.getElementById('modalBodyEditarProducto');
        cargarFormularioEditarProducto(modalBody);
        modal.classList.add('show');
    } else if (modalId === 'editar_apodos') {
        const modal = document.getElementById('modalEditarApodos');
        const modalBody = document.getElementById('modalBodyEditarApodos');
        cargarFormularioEditarApodos(modalBody);
        modal.classList.add('show');
    } else if (modalId === 'mesas') {
        abrirModalMesas();
    }
}

// Cerrar modales
function closeModal() {
    document.getElementById('modalCrearProducto').classList.remove('show');
}

function closeModalCompra() {
    document.getElementById('modalRegistrarCompra').classList.remove('show');
}

function closeModalUsuario() {
    document.getElementById('modalCrearUsuario').classList.remove('show');
}

function closeModalInformes() {
    document.getElementById('modalInformes').classList.remove('show');
}

function closeModalEditarProducto() {
    document.getElementById('modalEditarProducto').classList.remove('show');
}

function closeModalEditarApodos() {
    document.getElementById('modalEditarApodos').classList.remove('show');
}
