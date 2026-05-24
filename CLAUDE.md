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

### Grid (2 filas — el ticker vive DENTRO del topbar)
```
┌─────────────────────────────────┐
│ SIDEBAR (260px) │   TOPBAR      │  ← row 1: 56px
│                 │  [⌘K] ticker  │     (3 cols: kbd | ticker scroll | widgets)
│                 │─────────────── │
│                 │   CONTENT     │  ← row 2: flex-1
└─────────────────────────────────┘
```
CSS grid: `grid-template-columns: var(--sidebar-w) 1fr` · `grid-template-rows: var(--topbar-h) 1fr`. El topbar es un grid de 3 columnas (`auto 1fr auto`): chips de teclado | ticker scrollable | widgets.

### Componentes del shell
| Archivo | Descripción |
|---------|-------------|
| `components/shell/Topbar.tsx` | Barra superior 3-col: chips `⌘K ⌘J ⌘.` · ticker scrollable con métricas reales (MRR/GPA/hábitos/racha) · widgets CDMX/Silencio/Ajustes/campana. El ticker se fusionó aquí (ya no hay `Ticker.tsx` separado) |
| `components/shell/Sidebar.tsx` | Nav lateral: brand serif `VALLE·`, search, secciones colapsables, footer con avatar |
| `components/shell/LockScreen.tsx` | PIN 4 dígitos (SHA-256 → localStorage) + WebAuthn biométrico |
| `components/shell/CmdK.tsx` | Paleta de comandos (⌘K) — usa `cmdk` |
| `components/shell/CaptureModal.tsx` | Modal de captura rápida (⌘J) |
| `components/shell/CierreFlow.tsx` | Flujo de cierre nocturno (⌘.) |
| `components/shell/AjustesDrawer.tsx` | Drawer de ajustes — temas, fuente, acento |
| `components/shell/AmbientBG.tsx` | Fondo: un solo `<div className="ambient">` con gradientes radiales CSS + grano (`::after`), animado con `ambient-drift`. Sin blobs |
| `components/shell/FocusBanner.tsx` | Banner de modo foco (barra dorada) |
| `components/shell/OrbFloating.tsx` | Botón flotante de Shadow — renderiza `<Orb>` (orb-jarvis) |
| `components/shell/ShadowOrb.tsx` | Presencia limpia de Shadow: orb grande + aura difuminada (idle dorado / thinking morado) |
| `components/Orb.tsx` | Orb reutilizable estilo Jarvis (clase `.orb-jarvis`, `--orb-size`), estados `idle`/`thinking` |
| `components/Modal.tsx` | Modal + `Field` reutilizables. Patrón de islas: modal → insert a Supabase → `router.refresh()` |

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
10 Salud       11 Gym        12 Lectura   13 Tiempo   14 Páginas
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
--line, --line-2                           /* bordes sutiles (topbar, sidebar, modales, cards) */
```

### Clases útiles nuevas
- `.orb-jarvis` — orb premium (gradiente con luz + halo), tamaño vía `--orb-size`
- `.modal-backdrop` / `.modal-card` / `.modal-field` — modales (ver `components/Modal.tsx`)
- `.hb-*` — tracker de Hábitos v2 (stats, calendario heatmap, toggles, strips)
- `.kpi-strip` / `.kpi-cell` — tira de métricas (Brief)
- `.tool-chip` — chips de acciones de Shadow (running/ok/err)
- `.mm-*` — mapa muscular anatómico SVG (`components/gym/MuscleMap.tsx`)
- `.gym-*` — dashboard de Gym (barras de volumen, filas de series, lista de ejercicios)
- `.re-*` — editor de rutina (`RoutineEditor.tsx`): chips de rutina, días, chips de músculo, filas de ejercicio
- `.seg` / `.seg-btn` — control segmentado (toggle Semana/Mes)
- `.modal-card-wide` — modal ancho (720px); `Modal` acepta prop `wide`. `.modal-body` ahora hace scroll (max-height 80vh)

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

## Shadow — Agente Personal (Jarvis con manos)
- **Ruta**: `app/(os)/shadow/page.tsx` — layout 2 columnas: presencia (orb limpio + waveform + telemetría en pills + tags) | conversación (chat con historial en dropdown). Prompts rápidos abajo
- **API**: `app/api/shadow/route.ts` — loop agéntico con **tool use** de Anthropic. Streaming **NDJSON** (un JSON por línea): eventos `{type:"conv"|"text"|"tool"|"tool_result"|"error"|"done"}`
- **Modelo**: `claude-sonnet-4-6`
- **Herramientas** (`lib/shadow/tools.ts` → `SHADOW_TOOLS` + `executeTool`): Shadow EJECUTA acciones reales en Supabase. 11 tools: `consultar_estado` (incluye resumen de gym), `crear_nota`, `agregar_prioridad`, `completar_prioridad`, `crear_habito`, `completar_habito`, `registrar_finanza`, `consultar_rutina`, `registrar_entrenamiento`, `recordar`, `crear_evento` (Google Calendar). Cada una devuelve `{ok, summary}` que se muestra como chip en vivo y se manda como `tool_result` a Claude
- **Memoria**: tabla `shadow_memory` → se inyecta en system prompt como `## Memoria persistente`. El tool `recordar` escribe aquí
- **Mensajes guardados**: `shadow_messages.parts` = `[{text}, {tool}...]` (texto + resúmenes de acciones). El cliente parsea NDJSON y reconstruye texto + chips al recargar
- **Brief del día**: `app/api/shadow/brief/route.ts` (POST) — genera el brief analizando datos del día, lo cachea en `shadow_cache` key `brief:{YYYY-MM-DD}`. Se dispara desde el botón en Brief

---

## Gym — Entrenamiento (módulo 11)
- **Ruta**: `app/(os)/gym/page.tsx` (server: carga rutinas/días/ejercicios/sesiones/series de los últimos 120d) → `GymClient.tsx` (dashboard cliente que computa todo y persiste vía islas)
- **Modelo de datos** (5 tablas): `workout_routines` (rutinas, una `active`) → `workout_days` (días con `muscle_groups[]`, `day_order` define el ciclo) → `workout_exercises` (plantilla: `target_sets`/`target_reps`/`muscle_group`). Lo registrado: `workout_sessions` (un entrenamiento, guarda `day_name` denormalizado) → `workout_sets` (peso×reps por serie, `exercise_name`/`muscle_group` denormalizados para sobrevivir ediciones)
- **Catálogo de músculos**: `lib/gym/muscles.ts` — 13 keys canónicas (`pecho`, `espalda`, `hombros`, `biceps`, `triceps`, `antebrazo`, `abdomen`, `trapecio`, `cuadriceps`, `isquios`, `gluteos`, `pantorrillas`, `lumbar`) + `normalizeMuscle()` (sinónimos) + `muscleLabel()`
- **Mapa muscular**: `components/gym/MuscleMap.tsx` — figuras SVG frente/espalda; cada grupo es un `<path>` coloreado por intensidad (series del período / máx). Heatmap dorado→ámbar. Hover muestra el músculo + series
- **Dashboard** (`GymClient`): stats strip (sesiones, volumen, Δ vs período previo, series, PRs del mes) · card "Hoy toca" (día sugerido = siguiente en el ciclo tras la última sesión) · mapa muscular con toggle Semana/Mes · barras de volumen por músculo · sparklines de progresión (peso máx top 4 ejercicios) · volumen semanal 8 semanas · historial
- **Interactivo desde la app** (no desde el chat): `LogSession.tsx` registra una sesión (elige día → prefilla ejercicios → captura series peso×reps; permite ejercicio libre). `RoutineEditor.tsx` (modal `wide`) gestiona rutinas/días/ejercicios con copia local de trabajo + persistencia inmediata, `router.refresh()` al cerrar
- **Conexión con Shadow**: tools `consultar_rutina` y `registrar_entrenamiento`; `consultar_estado` incluye resumen de gym. Shadow consulta y registra sesiones — André edita la rutina en la app

---

## Supabase — Tipos
Archivo: `lib/supabase/types.ts`

**CRÍTICO**: Toda tabla debe incluir `Relationships: []` o las queries retornan `never` en TypeScript (bug de supabase-js v2.106+).

Para joins anidados con `.select("*, otra_tabla(campo)")`, usar cast doble:
```ts
const data = result.data as unknown as MiTipo[];
```

Tablas principales: `user_preferences`, `habits`, `habit_completions`, `financial_entries`, `bank_accounts`, `credit_cards`, `investments`, `flouvia_clients`, `flouvia_projects`, `shadow_conversations`, `shadow_messages`, `shadow_memory`, `shadow_cache`, `brain_notes`, `goals`, `goal_milestones`, `capital_goals`, `health_entries`, `reading_items`, `custom_pages`, `time_logs`, `academic_courses`, `assignments`, `semesters`, `priorities`, `daily_notes`, `workout_routines`, `workout_days`, `workout_exercises`, `workout_sessions`, `workout_sets`.

Schema completo en `supabase/schema.sql` — correr en Supabase SQL Editor para crear/recrear tablas. Migración aditiva de gym (sin borrar datos): `supabase/gym.sql`.

---

## Calendario
- API route: `app/api/calendar/route.ts`
- Usa `googleapis` con OAuth2 y refresh token (env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`)
- El cliente (`app/(os)/calendario/page.tsx`) fetcha `/api/calendar?days=30`

---

## Páginas — server shell + islas cliente
Patrón: la página es **server component** (SSR, carga datos) y las acciones interactivas son **islas cliente** (`"use client"`) que escriben a Supabase y llaman `router.refresh()`. Ejemplos de islas: `finanzas/AddEntry`, `flouvia/AddClient`, `metas/AddGoal`+`GoalProgress`, `salud/LogHealth`, `lectura/AddReading`+`ReadingStatus`, `tiempo/LogTime`, `panamericana/AddCourse`+`AddAssignment`.

| Server (con islas cliente) | Client components completos |
|---|---|
| finanzas, flouvia, metas, panamericana, salud, lectura, tiempo, centro | brief (`BriefClient`), shadow, habitos, brain, paginas, config, calendario, gym (`GymClient` + islas `LogSession`/`RoutineEditor`) |

**Qué guarda cada página** (todo persiste a Supabase):
- **Brief**: prioridades (check/agregar/borrar), intención editable, toggle de hábitos, brief generado por Shadow, agenda del día
- **Hábitos v2**: tracker diario con check-off satisfactorio (anillo de progreso), calendario heatmap mensual (perfecto/parcial/fallado), stats de racha actual/mejor/% del mes/días perfectos, y strip de 30 días por hábito. Permite backfill clickeando días pasados del calendario
- **Finanzas/Flouvia/Metas/Salud/Lectura/Tiempo/Panamericana**: crear registros + acciones (progreso de metas, ciclo de estado en lectura)
- **Gym**: dashboard interactivo de entrenamiento (ver sección Gym abajo)

El **ticker** del topbar (en `Topbar.tsx`) fetcha al montar: MRR (`flouvia_clients.monthly_value` activos), hábitos del día, racha 7d, GPA (`academic_courses.grade`), sesiones de gym de la semana (`workout_sessions`). CDMX es placeholder estático.

---

## Convenciones de código
- Sin comentarios salvo que el WHY sea no obvio
- Sin imports innecesarios
- Server components para datos estáticos/SSR; client components para interactividad
- Estilos: mezcla de clases CSS globales (`.card`, `.eyebrow`, `.btn-*`) e inline styles — preferir clases globales cuando existen
- No usar `className` de Tailwind directamente si ya existe una clase CSS equivalente en `globals.css`
