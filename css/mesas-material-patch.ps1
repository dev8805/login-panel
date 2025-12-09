# Script para aplicar cambios de Google Material Design al archivo mesas.css
# Mantiene intacto el Panel de Pago

$cssFile = "css\mesas.css"
$content = Get-Content $cssFile -Encoding UTF8 -Raw

# 1. Agregar variables CSS de Google Material al inicio
$googleVars = @"
/* ==========================================
   GOOGLE MATERIAL MINIMAL - VARIABLES
   ========================================== */

:root {
    /* Google Material Colors */
    --google-blue: #1a73e8;
    --google-blue-light: #e8f0fe;
    --google-green: #0F9D58;
    --google-yellow: #F4B400;
    --google-red: #d93025;
    
    /* Backgrounds */
    --google-grey-bg: #f1f3f4;
    --google-surface: #ffffff;
    --google-background: #eef2f6;
    
    /* Text */
    --text-primary: #202124;
    --text-secondary: #5f6368;
    
    /* Shadows */
    --shadow-subtle: 0 1px 2px rgba(60, 64, 67, 0.3);
    --shadow-medium: 0 2px 6px rgba(60, 64, 67, 0.15);
    --shadow-focus: 0 1px 3px rgba(60, 64, 67, 0.3), 0 4px 8px rgba(60, 64, 67, 0.15);
}

"@

# Insertar variables al inicio del archivo
$content = $googleVars + $content

# 2. Reemplazar estilos de .modal-mesas-grid .mesa-card
$oldCardStyle = @'
.modal-mesas-grid .mesa-card {
    border: 2px solid #e2e8f0;
    padding: 12px;
    min-height: 95px;
    display: flex;
    flex-direction: column;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    background: #ffffff;
    border-radius: 12px;
    overflow: hidden;
    gap: 6px;
}
'@

$newCardStyle = @'
.modal-mesas-grid .mesa-card {
    background: var(--google-surface);
    border: none;
    border-radius: 8px;
    padding: 16px;
    min-height: 95px;
    display: flex;
    flex-direction: column;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: visible;
    gap: 8px;
    box-shadow: var(--shadow-subtle);
}
'@

$content = $content -replace [regex]::Escape($oldCardStyle), $newCardStyle

# 3. Reemplazar estilos de borde superior (::before)
$oldBefore = @'
/* Barra superior animada en hover */
.modal-mesas-grid .mesa-card::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: transparent;
    transition: background 0.3s ease;
}
'@

$newBefore = @'
/* Barra superior animada en hover */
.modal-mesas-grid .mesa-card::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: var(--google-green);
    border-radius: 8px 8px 0 0;
    transition: background 0.2s ease;
}
'@

$content = $content -replace [regex]::Escape($oldBefore), $newBefore

# Guardar el archivo modificado
$content | Out-File $cssFile -Encoding UTF8 -NoNewline

Write-Host "✅ Cambios aplicados exitosamente a mesas.css" -ForegroundColor Green
