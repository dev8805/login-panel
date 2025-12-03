# Panel POS WhatsApp

Aplicación web estática para administrar productos, mesas y ventas integradas con Supabase.

## Requisitos
- Node.js 18 o superior
- npm
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/) para publicar en Cloudflare Pages (`npm install -g wrangler` o `npx wrangler`)

## Configuración de Supabase
1. Abre `js/config.js` y reemplaza `SUPABASE_URL` y `SUPABASE_KEY` por las credenciales de tu proyecto de Supabase.
2. Verifica que las tablas y RPCs esperadas existen en tu base de datos (mesas, productos, usuarios, etc.).

## Previsualizar localmente
```bash
# Desde la raíz del proyecto
npx wrangler pages dev .
```
Esto inicia un servidor local con hot reload en `http://localhost:8788` usando la misma configuración que Cloudflare Pages.

## Desplegar a Cloudflare Pages
1. Autentícate con tu cuenta de Cloudflare (solo la primera vez):
   ```bash
   npx wrangler login
   ```
2. Lanza el despliegue estático usando la configuración de `wrangler.jsonc`:
   ```bash
   npx wrangler pages deploy .
   ```
   - `wrangler.jsonc` ya declara el directorio de assets (`./`) y la fecha de compatibilidad.
   - El comando subirá los archivos estáticos (HTML, CSS, JS, íconos y `manifest.json`) y creará la versión de producción.

## Estructura rápida
- `index.html`: layout principal, modales y contenedores.
- `css/`: estilos del panel, modales, chat y mesas.
- `js/`: lógica de autenticación, productos, mesas, chat y estadísticas.
- `manifest.json`: configuración PWA.
- `wrangler.jsonc`: definición del proyecto para Cloudflare Pages.

## Notas
- Al ser un frontend estático, no se requiere backend propio; todo el acceso a datos ocurre vía Supabase.
- Para otros proveedores de hosting estático (Vercel, Netlify, Firebase Hosting), basta con publicar el contenido del directorio raíz.
