/**
 * ===========================================
 * CONFIGURACIÓN GLOBAL
 * ===========================================
 */

// Configuración de Supabase
const SUPABASE_URL = 'https://fqujxgwresrdvvfkmdgv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxdWp4Z3dyZXNyZHZ2ZmttZGd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MDc2NzQsImV4cCI6MjA3MDA4MzY3NH0._XwIEgRXVzSYZI7Y6nNZ9jfmrjjIw6Dy1RTP7z0qKCI';

// Inicializar Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
console.log('✅ Supabase inicializado correctamente');

// Variables globales
let userData = null;
let draggedItem = null;

// Opciones del menú
const menuOptions = [
    {
        id: 'crear_producto',
        icon: '📦',
        title: 'Crear Producto',
        url: '#',
        permission: 'productos.crear',
        modal: true
    },
    {
        id: 'registrar_compra',
        icon: '🛒',
        title: 'Registrar Compra',
        url: '#',
        permission: 'inventario.modificar',
        modal: true
    },
    {
        id: 'crear_usuario',
        icon: '👤',
        title: 'Crear Usuario',
        url: '#',
        permission: 'usuarios.crear',
        modal: true
    },
    {
        id: 'informes',
        icon: '📊',
        title: 'Informes',
        url: '#',
        permission: 'informes.ver',
        modal: true
    },
    {
        id: 'editar_producto',
        icon: '✏️',
        title: 'Editar Producto',
        url: '#',
        permission: 'productos.editar',
        modal: true
    },
    {
        id: 'editar_apodos',
        icon: '🏷️',
        title: 'Editar Apodos',
        url: '#',
        permission: 'productos.editar',
        modal: true
    },
    {
        id: 'mesas',
        icon: '🍽️',
        title: 'Mesas',
        url: '#',
        permission: 'informes.ver',
        modal: true
    }
];
