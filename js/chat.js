/**
 * ===========================================
 * CHAT ASISTENTE CON AUDIO
 * ===========================================
 */

let mediaRecorder = null;
let audioChunks = [];
let estaGrabando = false;

// Abrir modal de chat
function abrirModalChat() {
    const modal = document.getElementById('modalChatAsistente');
    const chatMessages = document.getElementById('chatMessages');
    // Limpiar mensajes anteriores
    chatMessages.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #999;">
            <p style="font-size: 48px; margin-bottom: 10px;">💬</p>
            <p>¡Hola! Soy tu asistente virtual.</p>
            <p style="font-size: 12px;">Envía un mensaje de texto o presiona el micrófono para hablar.</p>
        </div>
    `;
    modal.classList.add('show');

    // Configurar botón de micrófono después de abrir el modal
    setTimeout(() => {
        const btnMicrofono = document.getElementById('btnGrabarVoz');
        if (btnMicrofono) {
            configurarBotonMicrofono(btnMicrofono);
        }
    }, 100);
}

// Cerrar modal
function closeModalChat() {
    if (estaGrabando) {
        detenerGrabacionPresionado();
    }
    document.getElementById('modalChatAsistente').classList.remove('show');

    // Volver a mostrar el botón flotante
    const fab = document.getElementById('fabChat');
    if(fab) fab.style.display = 'flex';
}

// Alternar entre botón micrófono y enviar
function toggleInputButtons() {
    const input = document.getElementById('inputMensajeChat');
    const btnMicrofono = document.getElementById('btnGrabarVoz');
    const btnEnviar = document.getElementById('btnEnviarMensaje');
    
    if (input.value.trim().length > 0) {
        btnMicrofono.style.display = 'none';
        btnEnviar.style.display = 'flex';
    } else {
        btnMicrofono.style.display = 'flex';
        btnEnviar.style.display = 'none';
    }
}

// Enviar mensaje de texto
async function enviarMensajeChat() {
    const input = document.getElementById('inputMensajeChat');
    const mensaje = input.value.trim();
    if (!mensaje) return;
    
    // Limpiar input
    input.value = '';
    toggleInputButtons();
    // Mostrar mensaje del usuario
    agregarMensaje(mensaje, 'usuario');
    
    // Mostrar indicador de escritura
    mostrarIndicadorEscritura();
    try {
        // Enviar al webhook
        console.log('📤 Enviando al webhook...');
        const response = await fetch('https://n8n-n8n.aa7tej.easypanel.host/webhook/chat-panel', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                mensaje: mensaje,
                tipo: 'texto',
                usuario: userData.nombre,
                tenant_id: userData.tenant_id,
                user_id: userData.user_id,
                sessionid: `panel_${userData.user_id}`
            })
        });

        console.log('📥 Response status:', response.status);
        console.log('📥 Response ok:', response.ok);
        // Verificar si hay contenido antes de parsear
        const responseText = await response.text();
        console.log('📥 Response text:', responseText);

        let data;
        if (responseText) {
            try {
                data = JSON.parse(responseText);
                console.log('📥 Data parseada:', data);
            } catch (e) {
                console.error('❌ Error parseando JSON:', e);
                throw new Error('Respuesta inválida del servidor');
            }
        } else {
            console.error('❌ Respuesta vacía del servidor');
            throw new Error('El servidor no devolvió ninguna respuesta');
        }
        
        // Quitar indicador de escritura
        quitarIndicadorEscritura();
        
        // Mostrar respuesta. Si devuelve un array, tomar el primer elemento
        const respuestaFinal = Array.isArray(data) ? data[0] : data;

        if (respuestaFinal.mensaje) {
            agregarMensaje(respuestaFinal.mensaje, 'asistente');
        } else {
            agregarMensaje('Lo siento, no pude procesar tu mensaje.', 'asistente');
        }
        
    } catch (error) {
        console.error('Error enviando mensaje:', error);
        quitarIndicadorEscritura();
        agregarMensaje('Error al enviar el mensaje. Intenta nuevamente.', 'asistente');
    }
}

// Agregar mensaje al chat
function agregarMensaje(texto, tipo) {
    const chatMessages = document.getElementById('chatMessages');
    // Eliminar mensaje de bienvenida si existe
    const bienvenida = chatMessages.querySelector('[style*="text-align: center"]');
    if (bienvenida) bienvenida.remove();
    const timestamp = new Date().toLocaleTimeString('es-CO', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    // Formatear el texto si es del asistente
    let textoFormateado = texto;
    if (tipo === 'asistente') {
        // Detectar si es un mensaje de confirmación de venta
        if (texto.includes('Registro de ventas') || texto.includes('✅ Registro de ventas')) {
            textoFormateado = formatearMensajeVenta(texto);
        } else {
            // Mensaje normal: solo saltos de línea
            textoFormateado = texto.replace(/\n/g, '<br>');
        }
    }
    
    const mensajeDiv = document.createElement('div');
    mensajeDiv.className = `mensaje-chat mensaje-${tipo}`;
    mensajeDiv.innerHTML = `
        <div class="mensaje-contenido">
            ${textoFormateado}
            <div class="mensaje-timestamp">${timestamp}</div>
        </div>
    `;
    chatMessages.appendChild(mensajeDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Formatear mensaje de venta estilo WhatsApp
function formatearMensajeVenta(texto) {
    let html = '';
    const lineas = texto.split('\n');
    
    lineas.forEach((linea, index) => {
        linea = linea.trim();
        if (!linea) return;
        
        // Primera línea: Etiqueta verde
        if (linea.includes('Registro de ventas')) {
            html += '<span class="etiqueta-registro">Registro de ventas</span><br>';
            return;
        }
    
        // Fecha/hora
        if (linea.match(/\d{2}\/\d{2}\/\d{4}/)) {
            html += `<div style="font-size: 12px; color: #666; margin-bottom: 8px;">${linea}</div>`;
            return;
        }
        
        // Líneas de productos [V036]
        if (linea.match(/\[V\d+\]/)) {
            const codigoMatch = linea.match(/(\[V\d+\])/);
            const restoDeLaLinea = linea.replace(codigoMatch[0], '').trim();
            html += `<div class="linea-venta"><span class="codigo-producto">${codigoMatch[0]}</span> ${restoDeLaLinea}</div>`;
            return;
        }
        
        // Ingredientes descontados
        if (linea.includes('Ingredientes descontados:')) {
            html += '<div class="seccion-ingredientes">📦 Ingredientes descontados:</div>';
            return;
        }
        
        // Items de ingredientes
        if (linea.match(/^[•·-]/)) {
            html += `<div style="font-size: 12px; color: #666; margin-left: 8px;">${linea}</div>`;
            return;
        }
        
        // Total de la venta
        if (linea.includes('Total de la venta:')) {
            const precioMatch = linea.match(/\$[\d.,]+/);
            if (precioMatch) {
                html += `<div style="margin-top: 10px; font-weight: 600;">💰 Total: <span class="precio-total">${precioMatch[0]}</span></div>`;
            }
            return;
        }
        
        // Caja esperada
        if (linea.includes('Caja esperada:')) {
            const precioMatch = linea.match(/\$[\d.,]+/);
            if (precioMatch) {
                html += `<div style="font-weight: 600;">💼 Caja: <span class="precio-total">${precioMatch[0]}</span></div>`;
            }
            return;
        }
        
        // Cualquier otra línea
        html += `<div>${linea}</div>`;
    });
    
    return html;
}

// Mostrar indicador de escritura
function mostrarIndicadorEscritura() {
    const chatMessages = document.getElementById('chatMessages');
    const indicador = document.createElement('div');
    indicador.id = 'typingIndicator';
    indicador.className = 'mensaje-chat mensaje-asistente';
    indicador.innerHTML = `
        <div class="mensaje-contenido">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;
    chatMessages.appendChild(indicador);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Quitar indicador de escritura
function quitarIndicadorEscritura() {
    const indicador = document.getElementById('typingIndicator');
    if (indicador) indicador.remove();
}

// Manejar carga de imagen
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        if (file.size > 5 * 1024 * 1024) { // 5MB límite
            alert('La imagen es muy grande. Máximo 5MB.');
            return;
        }
        enviarImagenChat(file);
        event.target.value = '';
    }
}

// Variables para grabación por presión
let grabacionTimer = null;
let grabacionIniciada = false;

function configurarBotonMicrofono(btn) {
    // Touch events para móvil
    btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        iniciarGrabacionPresionado();
    }, { passive: false });
    btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        detenerGrabacionPresionado();
    }, { passive: false });
    btn.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        detenerGrabacionPresionado();
    }, { passive: false });
    // Mouse events para desktop
    btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        iniciarGrabacionPresionado();
    });
    btn.addEventListener('mouseup', (e) => {
        e.preventDefault();
        detenerGrabacionPresionado();
    });
    btn.addEventListener('mouseleave', (e) => {
        if (estaGrabando) {
            detenerGrabacionPresionado();
        }
    });
}

// Iniciar grabación al presionar
async function iniciarGrabacionPresionado() {
    if (estaGrabando) return;
    
    const btn = document.getElementById('btnGrabarVoz');
    const estado = document.getElementById('estadoGrabacion');
    
    // Feedback visual inmediato
    btn.style.transform = 'scale(0.9)';
    btn.style.boxShadow = '0 1px 3px rgba(102, 126, 234, 0.3)';
    
    // Mostrar estado
    estado.style.display = 'block';
    estado.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    estado.style.color = 'white';
    estado.innerHTML = '🎤 Grabando... Suelta para enviar';
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = async () => {
            // Detener tracks
            stream.getTracks().forEach(track => track.stop());
            // Solo enviar si hay audio grabado
            if (audioChunks.length > 0) {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                // Solo enviar si la grabación duró más de 0.5 segundos
                if (audioBlob.size > 1000) {
                    await enviarAudioChat(audioBlob);
                }
            }
            
            audioChunks = [];
        };
        
        mediaRecorder.start();
        estaGrabando = true;
        grabacionIniciada = true;
        
        // Cambiar ícono
        btn.innerHTML = '⏹️';
        btn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        
    } catch (error) {
        console.error('Error accediendo al micrófono:', error);
        estado.style.display = 'block';
        estado.style.background = '#fee';
        estado.style.color = '#c33';
        estado.textContent = '❌ No se pudo acceder al micrófono';
        // Restaurar botón
        btn.style.transform = 'scale(1)';
        btn.innerHTML = '🎤';
        setTimeout(() => {
            estado.style.display = 'none';
        }, 3000);
    }
}

// Detener grabación al soltar
function detenerGrabacionPresionado() {
    if (!estaGrabando) return;
    
    const btn = document.getElementById('btnGrabarVoz');
    const estado = document.getElementById('estadoGrabacion');
    
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
    
    estaGrabando = false;
    grabacionIniciada = false;
    // Restaurar botón
    btn.style.transform = 'scale(1)';
    btn.style.boxShadow = '0 2px 5px rgba(102, 126, 234, 0.3)';
    btn.innerHTML = '🎤';
    btn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    // Ocultar estado
    setTimeout(() => {
        estado.style.display = 'none';
    }, 300);
}

// Enviar imagen al webhook
async function enviarImagenChat(imageFile) {
    agregarMensaje('🖼️ Imagen enviada', 'usuario');
    mostrarIndicadorEscritura();
    try {
        const reader = new FileReader();
        reader.readAsDataURL(imageFile);
        reader.onloadend = async () => {
            const base64Image = reader.result.split(',')[1];
            const response = await fetch('https://n8n-n8n.aa7tej.easypanel.host/webhook/chat-panel', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    imagen: base64Image,
                    tipo: 'imagen',
                    usuario: userData.nombre,
                    tenant_id: userData.tenant_id,
                    user_id: userData.user_id,
                    sessionid: `panel_${userData.user_id}`
                })
            });
            const data = await response.json();
            const respuestaFinal = Array.isArray(data) ? data[0] : data;
            
            quitarIndicadorEscritura();
            
            if (respuestaFinal.mensaje) {
                agregarMensaje(respuestaFinal.mensaje, 'asistente');
            } else {
                agregarMensaje('No pude procesar la imagen.', 'asistente');
            }
        };
        
    } catch (error) {
        console.error('Error enviando imagen:', error);
        quitarIndicadorEscritura();
        agregarMensaje('Error al procesar la imagen.', 'asistente');
    }
}

// Enviar audio al webhook
async function enviarAudioChat(audioBlob) {
    agregarMensaje('🎤 Audio enviado', 'usuario');
    mostrarIndicadorEscritura();
    
    try {
        // Convertir blob a base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        
        reader.onloadend = async () => {
            const base64Audio = reader.result.split(',')[1];
            const response = await fetch('https://n8n-n8n.aa7tej.easypanel.host/webhook/chat-panel', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    audio: base64Audio,
                    tipo: 'audio',
                    usuario: userData.nombre,
                    tenant_id: userData.tenant_id,
                    user_id: userData.user_id,
                    sessionid: `panel_${userData.user_id}`
                })
            });
            const data = await response.json();
            const respuestaFinal = Array.isArray(data) ? data[0] : data;

            quitarIndicadorEscritura();
            
            if (respuestaFinal.mensaje) {
                agregarMensaje(respuestaFinal.mensaje, 'asistente');
            } else {
                agregarMensaje('No pude procesar el audio.', 'asistente');
            }
        };
        
    } catch (error) {
        console.error('Error enviando audio:', error);
        quitarIndicadorEscritura();
        agregarMensaje('Error al procesar el audio.', 'asistente');
    }
}
