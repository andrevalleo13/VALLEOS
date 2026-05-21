@AGENTS.md

# Valle OS — Guía para Claude

## Qué es esto
Valle OS es el sistema operativo personal de André Valle Ortega. Next.js 16.2.6 App Router, PWA, dark mode por defecto. Todo en español.

## Stack
- **Framework**: Next.js 16.2.6 App Router · TypeScript
- **CSS**: Tailwind CSS v4 (config en `app/globals.css` vía `@import "tailwindcss"` + `@theme {}`)
- **DB**: Supabase (`@supabase/ssr` v0.10.3) — proyecto: `waxptyvzjitiscmcaxbz.supabase.co`
- **AI**: Anthropic SDK (`claude-sonnet-4-6`) — Shadow, el agente personal
- **Calendario**: Google Calendar API (`googleapis`) con OAuth2 refresh token
- **Estado**: Zustand con persist (`lib/store.ts`)
- **UI**: cmdk (command palette), sonner (toasts), framer-motion, lucide-react

## Build
```bash
node node_modules/next/dist/bin/next build   # build
node node_modules/next/dist/bin/next dev     # dev
```
El symlink `.bin/next` está roto en esta máquina — SIEMPRE usar la ruta directa.

## Middleware
El archivo se llama `proxy.ts` (no `middleware.ts`) — Next.js 16 renombró la convención.

---

## Shell — Arquitectura del layout

### Grid
```
┌─────────────────────────────────┐
│ SIDEBAR (260px) │   TOPBAR      │  ← row 1: 56px
│                 │─────────────── │
│                 │   TICKER      │  ← row 2: 36px
│                 │─────────────── │
│                 │   CONTENT     │  ← row 3: flex-1
└─────────────────────────────────┘
```
CSS grid: `grid-template-columns: var(--sidebar-w) 1fr` · `grid-template-rows: var(--topbar-h) var(--ticker-h) 1fr`

### Componentes del shell
| Archivo | Descripción |
|---------|-------------|
| `components/shell/Topbar.tsx` | Barra superior: chips ⌘K ⌘J ⌘., botones Silencio / Ajustes, campana |
| `components/shell/Sidebar.tsx` | Nav lateral: items numerados (00–13), search box, colapso por sección |
| `components/shell/Ticker.tsx` | Franja de métricas en vivo (MRR, hábitos, racha, GPA, CDMX) |
| `components/shell/LockScreen.tsx` | PIN 4 dígitos (SHA-256 → localStorage) + WebAuthn biométrico |
| `components/shell/CmdK.tsx` | Paleta de comandos (⌘K) — usa `cmdk` |
| `components/shell/CaptureModal.tsx` | Modal de captura rápida (⌘J) |
| `components/shell/CierreFlow.tsx` | Flujo de cierre nocturno (⌘.) |
| `components/shell/AjustesDrawer.tsx` | Drawer de ajustes — temas, fuente, acento |
| `components/shell/AmbientBG.tsx` | Blobs animados de fondo |
| `components/shell/FocusBanner.tsx` | Banner de modo foco (barra dorada) |
| `components/shell/OrbFloating.tsx` | Botón flotante de Shadow (mobile) |

### Shortcuts del Topbar
- `⌘K` → CmdK (búsqueda global)
- `⌘J` → CaptureModal (captura rápida)
- `⌘.` → CierreFlow (cierre nocturno)

### Sidebar — numeración de rutas
```
00 Brief       01 Centro     02 Shadow
03 Finanzas    04 Brain      05 Calendario
06 Hábitos     07 Metas
08 Flouvia     09 Panamericana
10 Salud       11 Lectura    12 Tiempo    13 Páginas
```

---

## Diseño — Convenciones

### Encabezado de página
Todas las páginas usan este patrón:
```tsx
<div className="page-header">
  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
    <div>
      <p className="eyebrow mb-2">NN · CATEGORÍA</p>    {/* "06 · SISTEMA" */}
      <h1 className="page-title">NombrePágina.</h1>     {/* con punto final */}
    </div>
    <div style={{ textAlign: "right", marginTop: 4 }}>
      {/* meta info opcional: fecha, contador, etc. */}
    </div>
  </div>
</div>
```

### Tipografía
- `.serif` → `Instrument Serif` (títulos grandes)
- `.eyebrow` → `Geist Mono`, 10px, uppercase, `var(--mute)` (etiquetas de sección)
- `.eyebrow-gold` → igual pero `var(--gold)`
- `.tick` → `Geist Mono`, 11px, `var(--mute-2)` (metadatos pequeños)
- `.mono` → `Geist Mono`

### Variables CSS clave
```css
--bg, --bg-deep, --bg-card, --bg-raised   /* superficies */
--bone, --bone-dim                          /* texto principal */
--mute, --mute-2                            /* texto secundario */
--gold, --gold-2, --gold-glow              /* acento dorado */
--green, --red, --blue, --violet           /* semánticos */
--glass-bg, --glass-bd                     /* glass morphism */
--glass-bg-2, --glass-bd-2                /* glass más denso */
```

### Temas disponibles
`oro-negro` (default) · `marea-fria` · `bosque` · `sangre` · `papel` · `cosmos`

---

## Auth — LockScreen
- Sin Supabase auth. Solo PIN local + WebAuthn biométrico.
- PIN: 4 dígitos → hash SHA-256 con prefijo `"valleos:"` → `localStorage` key `valleos-pin-hash`
- Biométrico: credential ID guardado en `localStorage` key `valleos-biometric-id`
- Sesión desbloqueada: `sessionStorage` key `valleos-unlocked = "1"` (se borra al cerrar tab)
- Al montar: si hay credencial biométrica + WebAuthn disponible → auto-trigger Touch ID / Face ID
- `proxy.ts` es pass-through (no verifica auth)

---

## Shadow — Agente Personal
- **Ruta**: `app/(os)/shadow/page.tsx` — chat de dos paneles: historial de conversaciones (220px) + chat
- **API**: `app/api/shadow/route.ts` — streaming con prefijo `\x00{convId}\x00` al inicio del stream
- **Modelo**: `claude-sonnet-4-6`
- **Memoria**: tabla `shadow_memory` en Supabase → se inyecta en system prompt como `## Memoria persistente`
- **Briefing cache**: tabla `shadow_cache`, key `brief:{YYYY-MM-DD}` → se muestra en Brief page
- **Streaming**: el cliente extrae el convId del prefijo y acumula el texto en el state

---

## Supabase — Tipos
Archivo: `lib/supabase/types.ts`

**CRÍTICO**: Toda tabla debe incluir `Relationships: []` o las queries retornan `never` en TypeScript (bug de supabase-js v2.106+).

Para joins anidados con `.select("*, otra_tabla(campo)")`, usar cast doble:
```ts
const data = result.data as unknown as MiTipo[];
```

Tablas principales: `user_preferences`, `habits`, `habit_completions`, `financial_entries`, `bank_accounts`, `credit_cards`, `investments`, `flouvia_clients`, `flouvia_projects`, `shadow_conversations`, `shadow_messages`, `shadow_memory`, `shadow_cache`, `brain_notes`, `goals`, `goal_milestones`, `capital_goals`, `health_entries`, `reading_items`, `custom_pages`, `time_logs`, `academic_courses`, `assignments`, `semesters`, `priorities`, `daily_notes`.

Schema completo en `supabase/schema.sql` — correr en Supabase SQL Editor para crear/recrear tablas.

---

## Calendario
- API route: `app/api/calendar/route.ts`
- Usa `googleapis` con OAuth2 y refresh token (env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`)
- El cliente (`app/(os)/calendario/page.tsx`) fetcha `/api/calendar?days=30`

---

## Páginas — Qué son server vs client
| Server components | Client components |
|---|---|
| brief, finanzas, flouvia, metas, panamericana, salud, lectura, tiempo, centro | shadow, habitos, brain, paginas, config, calendario |

---

## Ticker — Métricas en vivo
`components/shell/Ticker.tsx` fetcha de Supabase al montar:
- **MRR**: `flouvia_clients.monthly_value` donde `status = 'activo'`
- **Hábitos**: `habit_completions` del día vs total de `habits` activos
- **Racha**: max streak de los últimos 7 días
- **GPA**: promedio de `academic_courses.grade` donde grade no es null
- **CDMX**: placeholder estático (no hay API de clima conectada aún)

---

## Convenciones de código
- Sin comentarios salvo que el WHY sea no obvio
- Sin imports innecesarios
- Server components para datos estáticos/SSR; client components para interactividad
- Estilos: mezcla de clases CSS globales (`.card`, `.eyebrow`, `.btn-*`) e inline styles — preferir clases globales cuando existen
- No usar `className` de Tailwind directamente si ya existe una clase CSS equivalente en `globals.css`
