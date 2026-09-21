---
name: diseno-UI-milicic
description: Genera y refina interfaces web modernas, componentes desacoplados y sistemas visuales corporativos siguiendo la paleta de marca y diseño de Milicic (naranja constructora, gris pizarra, blanco y modo oscuro carbón/pizarra). Úsalo cuando diseñes UI, dashboards, formularios, tablas de datos o maquetas web.
---

# Skill: Modern Component Patterns (Milicic Design System)

## 1. Identidad Visual y Paleta Cromática (Milicic Brand)
El diseño debe transmitir solidez ingenieril, escala industrial y alta claridad operativa.

### A. Paleta Modo Claro (Light Mode)
- **Color Primario / Acento:** `#F39200` (Naranja Milicic oficial).
  - *Hover:* `#D98200` | *Active:* `#B56D00`
  - *Fondos sutiles:* `#FFF8EE` | *Bordes sutiles:* `#FCD69E`
  - *Uso:* Botones CTA principales, bordes de selección activa, barras de progreso, acentos en títulos y métricas clave.
- **Color Secundario / Cabeceras:** `#2A343D` (Gris Pizarra Milicic).
  - *Hover:* `#1E262D`
  - *Uso:* Barra de navegación superior (Header), pie de página, texto de títulos principales.
- **Superficies y Fondos:**
  - Fondo general de la página: `#F8F9FA`
  - Tarjetas (Cards) y Modales: `#FFFFFF`
  - Fondos sutiles / Insets: `#F1F3F5`
  - Cabecera de tablas: `#F8F9FA`
- **Bordes y Divisores:**
  - Borde base: `#E2E8F0` | Borde tenue: `#E5E7EB` | Borde extra-claro: `#EDF2F7`
- **Tipografía (Modo Claro):**
  - Texto principal / Títulos: `#1A2026`
  - Texto regular / Párrafos: `#4A5568`
  - Texto secundario / Labels: `#718096`
  - Placeholders: `#A0AEC0`

### B. Tokens Exactos de Modo Oscuro (Dark Mode: Carbón Profundo & Pizarra)
- **Fondo de página (Body):** `#0F141A` (Carbón profundo, no negro puro).
- **Superficies / Tarjetas / Modales:** `#1A222B` (Pizarra oscuro refinado).
- **Cabecera (Header en Dark Mode):** `#141A20` (Hover: `rgba(255, 255, 255, 0.08)`).
- **Fondos sutiles / Insets:** `#141B22`
- **Hover en filas y menús:** `#222C38`
- **Bordes en Modo Oscuro:**
  - Borde base: `#2D3742`
  - Borde tenue: `#242D36`
  - Borde divisorio interno: `#1E262F`
- **Tipografía (Modo Oscuro):**
  - Texto primario (alto contraste): `#F1F5F9`
  - Texto regular / Párrafos: `#CBD5E1`
  - Texto secundario / Muted: `#94A3B8`
  - Placeholders: `#64748B`
- **Acentos Naranja en Modo Oscuro:**
  - Elemento activo/borde: `#F39200`
  - Fondo de badges y pills translúcidos: `rgba(243, 146, 0, 0.16)`
  - Borde translúcido: `rgba(243, 146, 0, 0.4)`

### C. Colores Funcionales / Semánticos
- **Éxito (Success):** `#38A169` (Dark bg: `rgba(56, 161, 105, 0.16)`)
- **Alerta (Warning):** `#DD6B20` (Dark bg: `rgba(221, 107, 32, 0.16)`)
- **Peligro / Error (Danger):** `#E53E3E` (Dark bg: `rgba(229, 62, 62, 0.16)`)
- **Informativo (Info):** `#3182CE` (Dark bg: `rgba(49, 130, 206, 0.16)`)

---

## 2. Especificación y Uso del Logo Milicic

### A. Ubicación del Asset
- El archivo de marca se aloja en `public/milicic-logo.png`.

### B. Adaptabilidad Cromática (Modo Claro vs Modo Oscuro / Header Pizarra)
Para evitar que el logo pierda contraste en fondos oscuros (`#2A343D` o `#141A20`), se debe utilizar una clase o filtro CSS que invierta el logo a blanco puro con sombra sutil:

```css
/* Logo estándar sobre fondo claro */
.milicic-img {
  height: 28px; /* Altura estándar: 28px a 32px */
  width: auto;
  object-fit: contain;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.08));
}

/* Logo sobre cabecera pizarra #2A343D o en Dark Mode */
.milicic-img.white-logo,
[data-theme="dark"] .milicic-img {
  filter: brightness(0) invert(1) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
}
```

### C. Componente Reutilizable (React / Vue)
Crear siempre un componente reutilizable (`MilicicLogo.jsx` o `MilicicLogo.tsx`) que acepte propiedades `height` (default 28) y `white` (booleano) para insertarlo de manera consistente en la barra superior y pie de página.

---

## 3. Tipografía, Espaciado y Escala Numérica

- **Tipografía General:** `'Inter'`, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif.
- **Tipografía Técnica Monoespaciada (`font-mono`):**
  Obligatoria para direcciones IP, puertos de red (`:8080`, `:3389`), UUIDs, hashes, identificadores técnicos y código.
  Pila: `'JetBrains Mono'`, `'SFMono-Regular'`, Menlo, Monaco, Consolas, monospace.
- **Cuadrícula Matemática:** Múltiplos de 8px (Tailwind: `p-2` (8px), `p-4` (16px), `p-6` (24px), `gap-2`, `gap-4`).
- **Dimensiones de Cabecera y Navegación:**
  - Altura de Header: 56px (`--header-height: 56px`).
  - Radio de esquinas suave: `rounded-md` (6px) o `rounded-lg` (8px). Nunca bordes sobredimensionados ni estilo "píldora" excesivo en botones estructurales.

---

## 4. Estándar de Densidad y Consolas Enterprise

### A. Modularización Obligatoria
- **Límite de complejidad:** Ningún componente o SFC (`.vue`, `.jsx`, `.tsx`) debe superar las 400-500 líneas.
- **Desacoplamiento:** Dividir vistas en `*Table` (grilla), `*Modal` (formularios con tabs), `*Toolbar` / `*Dropdown` (acciones) y `*Toast` (notificaciones).
- La vista principal actúa como Orquestador de Estado.

### B. Tablas y Grillas de Datos
- Altura de fila controlada: 44-48px (estándar) o 36-40px (compacta).
- Truncado con Tooltip descriptivo en textos largos o URLs (`max-w-[220px] truncate`).
- Chips de conexión con copiado integrado en 1 clic (cambio de icono a check verde temporal sin bloquear al usuario).
- **Insignias Consolidadas:** En vez de llenar la fila de múltiples badges, agrupar el estado en una insignia concisa con popover al hover (ej: 🛡️ Hardened (7/8) o Estado (3/4)).

### C. Notificaciones y Modales
- **Cero `window.alert()`:** Reemplazar por notificaciones Toast flotantes en la esquina superior derecha (top-right), no bloqueantes, con duración de 3 a 3.5s.
- **Modales con Divulgación Progresiva:** Modales complejos deben estructurarse en Pestañas (Tabs) con altura máxima `max-h-[85vh]` y scrollbar estilizado (`scrollbar-thin scrollbar-thumb-[#2D3742]`).

---

## 5. Declaración de Variables CSS Base (style.css / index.css)

```css
:root {
  color-scheme: light dark;
  /* Milicic Brand */
  --milicic-orange: #F39200;
  --milicic-orange-hover: #D98200;
  --milicic-orange-light: #FFF8EE;
  --milicic-slate: #2A343D;
  --milicic-slate-hover: #1E262D;
  /* Fondos y Superficies (Light) */
  --bg-page: #F8F9FA;
  --bg-card: #FFFFFF;
  --bg-subtle: #F1F3F5;
  --header-bg: #2A343D;
  /* Bordes */
  --border-base: #E2E8F0;
  --border-light: #E5E7EB;
  /* Textos */
  --text-primary: #1A2026;
  --text-regular: #4A5568;
  --text-secondary: #718096;
}

:root[data-theme="dark"],
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --bg-page: #0F141A;
    --bg-card: #1A222B;
    --bg-subtle: #141B22;
    --header-bg: #141A20;
    --border-base: #2D3742;
    --border-light: #242D36;
    --text-primary: #F1F5F9;
    --text-regular: #CBD5E1;
    --text-secondary: #94A3B8;
    --milicic-orange-light: rgba(243, 146, 0, 0.16);
  }
}
```
