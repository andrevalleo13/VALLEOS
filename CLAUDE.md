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
| `components/shell/Topbar.tsx` | Barra superior 3-col: chips `⌘K ⌘J ⌘.` · ticker scrollable con métricas reales (MRR/GPA/hábitos/racha) · widgets CDMX/Silencio/Ajustes + `<NotifCenter>`. El ticker se fusionó aquí (ya no hay `Ticker.tsx` separado) |
| `components/shell/NotifCenter.tsx` | Centro de notificaciones (la campana, antes muerta). Ver sección Notificaciones |
| `components/shell/Sidebar.tsx` | Nav lateral: brand serif `VALLE·`, search, secciones colapsables, footer con avatar |
| `components/shell/LockScreen.tsx` | PIN 4 dígitos (SHA-256 → localStorage) + WebAuthn biométrico |
| `components/shell/BootSequence.tsx` | Animación de arranque (~1.5s): el orbe se forma desde un punto + anillos expandiéndose + wordmark `VALLE·`, luego fade-out y revela el LockScreen. Se renderiza **encima** del LockScreen en `layout.tsx`. Una vez por sesión (`sessionStorage valleos-booted`). Dispara `play("boot")`. Clases `.boot-*` |
| `components/shell/SoundLayer.tsx` | Capa de sonido (sin UI): sincroniza `ajustes.sounds && !focusMode` → `setSoundsEnabled()` y reproduce `play("click")` al cambiar de ruta (`usePathname`). Ver sección Sonidos |
| `components/shell/PageTransition.tsx` | Wrapper cliente (`key={pathname}`) que re-dispara la animación `page-in` (clase `.page-transition`) en cada navegación. Envuelve `{children}` dentro de `<main className="shell-content">` en el layout |
| `components/shell/CmdK.tsx` | Paleta de comandos (⌘K) — usa `cmdk`. Dos modos: **navegar** (15 páginas) y **acciones directas** (Captura rápida, Registrar gasto/ingreso, Log peso, Nueva meta, Log entrenamiento, Cierre nocturno). Las acciones de log usan `setQuickAction(key)` del store + `router.push(href)` → la isla de destino se auto-abre vía `useQuickAction`. Al escribir ≥2 caracteres carga resultados reales de Supabase (notas, metas, clientes, movimientos) agrupados |
| `components/shell/CaptureModal.tsx` | Modal de captura rápida (⌘J) — modo **Auto** (Shadow clasifica con Claude a nota/tarea/gasto/lectura), o manual (Nota/Tarea/Gasto). POST a `app/api/capture/route.ts` que clasifica con LLM e inserta en el módulo correcto (brain_notes, priorities, financial_entries, reading_items). Muestra card de confirmación con resumen e icono al guardar |
| `components/shell/CierreFlow.tsx` | Flujo de cierre con 3 modos seleccionables: **Nocturno** (journaling diario: revisión/gratitud/wins/aprendizajes/intención), **Semanal** y **Mensual** (cierre cross-module: lista rankeada de "qué necesita tu atención" + veredicto de Shadow + roll-up de 6 módulos). Los modos semanal/mensual llaman `POST /api/shadow/review`. Veredicto cacheado, items siempre recomputados. Clases `.cl-*` |
| `components/shell/AjustesDrawer.tsx` | Drawer de ajustes — temas base, personalización de colores (acento/fondo/texto), fuente, bordes, toggle de **Sonidos espaciales**. Incluye sección "Memoria de Claude" con botón de sync |
| `components/shell/AmbientBG.tsx` | Fondo: un solo `<div className="ambient">` con gradientes radiales CSS + grano (`::after`), animado con `ambient-drift`. Sin blobs |
| `components/shell/FocusBanner.tsx` | Banner de modo foco (barra dorada) |
| `components/shell/OrbFloating.tsx` | Botón flotante de Shadow — renderiza `<Orb>` (orb-jarvis) |
| `components/shell/ShadowOrb.tsx` | Presencia limpia de Shadow: orb grande + aura difuminada (idle dorado / thinking morado) |
| `components/Orb.tsx` | Orb reutilizable estilo Jarvis (clase `.orb-jarvis`, `--orb-size`), estados `idle`/`thinking` |
| `components/Modal.tsx` | Modal + `Field` reutilizables. Patrón de islas: modal → insert a Supabase → `router.refresh()` |
| `components/EmptyState.tsx` | Estado vacío con carácter: ícono (Lucide) en caja + título + hint + CTA opcional como `children`. Funciona en server y client. Clases `.empty-state*`. Usado en finanzas, salud, tiempo, metas, lectura, hábitos, flouvia, brain, panamericana |
| `components/Skeleton.tsx` | Esqueletos de carga: `<Skeleton w h r>` (bloque shimmer) y `<DashboardSkeleton>` (header + KPIs + charts). Reusa `@keyframes shimmer` + clase `.skeleton-block`. Importado por los `loading.tsx` de cada ruta SSR |

### Shortcuts del Topbar
- `⌘K` → CmdK (búsqueda global)
- `⌘J` → CaptureModal (captura rápida)
- `⌘.` → CierreFlow (cierre nocturno / semanal / mensual)

### Sonidos espaciales — `lib/sounds.ts`
Motor Web Audio sin dependencias (singleton `AudioContext`, lazy init, se reanuda en el primer gesto del usuario). API: `play(name)` y `setSoundsEnabled(bool)`. Sonidos: `click` (metálico, al cambiar de página), `think` (ping cuando Shadow procesa), `bass` (drop en evento exitoso), `alert` (error), `success`, `ping`, `boot` (sweep ascendente del arranque — ignora el flag de silencio). Cada sonido es uno o más osciladores con envolvente vía `tone()`.
- **Control**: `ajustes.sounds` (Zustand persist, default `true`). [`SoundLayer`](components/shell/SoundLayer.tsx) hace `setSoundsEnabled(sounds && !focusMode)` — el modo **Silencio** (focusMode) los apaga.
- **Wiring**: click por navegación → `SoundLayer`; `think`/`bass`/`alert` → `VoiceOrb` (en `send()` y el handler de `mood`); `boot` → `BootSequence`. El `chime` de wake-word de `VoiceOrb` es su propio oscilador (no pasa por el motor).
- **Nota navegador**: el audio no suena en la primerísima carga sin gesto del usuario (autoplay policy); arranca tras el primer tap (ej. el PIN del LockScreen).

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
- `.ac-*` — dashboard de Academia (`PanamericanaClient.tsx`): card de materia expandible, esquema de calificación con barra de peso + input inline, badges de dificultad, stepper de faltas, grid de horario semanal
- `.seg` / `.seg-btn` — control segmentado (toggle Semana/Mes)
- `.modal-card-wide` — modal ancho (720px); `Modal` acepta prop `wide`. `.modal-body` ahora hace scroll (max-height 80vh)
- `.mt-*` — Metas v2: tarjeta de meta, barra de progreso con marcador de ritmo, hitos, motor de hábitos
- `.tm-*` — Tiempo (módulo 13): KPIs grid, heatmap 13w, barras semanales, donut categorías, barras por cliente, ritmo del día
- `.empty-state` / `.empty-state-icon` / `.empty-state-title` / `.empty-state-hint` / `.empty-state-cta` — estado vacío con carácter (`components/EmptyState.tsx`)
- `.skeleton-block` — bloque shimmer para skeletons de carga (reusa `@keyframes shimmer`); `<DashboardSkeleton>` lo usa vía `components/Skeleton.tsx`
- `.page-transition` — wrapper de animación `page-in` (420ms blur+translate), re-disparado por `PageTransition` en cada navegación

### Color picker reutilizable
`components/ColorPicker.tsx` — chips de presets (10 colores) + botón `+` con `<input type="color">` nativo para color libre. Props: `value: string`, `onChange: (hex) => void`, `presets?: string[]`, `size?: number`. Usar en cualquier lugar donde el usuario elija color hex.

### Panel de análisis de Shadow reutilizable
`components/ShadowAnalysis.tsx` — el panel destacado **con el orbe** (idle dorado / thinking morado) + renderer `Markdownish` (bullets `·` + negritas) + botón de regenerar. Props: `endpoint` (POST que devuelve `{content}`), `cta`, `loadingText`, `emptyText`, `title?`, `initial`, `generatedAt`, `canRun?`. Lo usan los `Analysis.tsx` de **Finanzas, Flouvia y Salud** (Panamericana mantiene su panel propio inline pero idéntico en estética). Reusa la clase `.ac-analysis` + `.ac-md`.

### Temas disponibles
`oro-negro` (default) · `marea-fria` · `bosque` · `sangre` · `papel` · `cosmos`

### Personalización de temas
`lib/themes.ts` — `applyTheme(theme, customColors?)` aplica el tema base y encima sobreescribe variables CSS inline en `:root`. Las customizaciones se guardan en `ajustes.customColors: Record<string, string>` (Zustand persist). Variables personalizables: `--gold`, `--gold-2`, `--gold-glow`, `--bg`, `--bg-deep`, `--bone`, `--bone-dim`. `lib/colors.ts` — utilidades `darken()`, `lighten()`, `toRgba()` para derivar colores relacionados.

### Date inputs estilizados
Todos los `input[type="date"]`, `input[type="datetime-local"]`, etc. con clase `.input` usan `color-scheme: dark` para que el popup nativo del calendario sea oscuro y respete la estética. El tema `papel` usa `color-scheme: light`.

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
- **Herramientas** (`lib/shadow/tools.ts` → `SHADOW_TOOLS` + `executeTool`): Shadow EJECUTA acciones reales en Supabase y Google Calendar. Cada una devuelve `{ok, summary}` que se muestra como chip en vivo y se manda como `tool_result` a Claude. Grupos:
  - **Estado/notas**: `consultar_estado` (prioridades, hábitos, **plan cronológico del día** — clases/gym/estudio/entregas/eventos fusionados vía `buildDayPlan`, finanzas, gym, próximo examen, agenda 48h, salud y metas activas con próximo hito), `crear_nota`, `recordar` (memoria persistente)
  - **Prioridades/hábitos**: `agregar_prioridad`, `completar_prioridad`, `crear_habito`, `completar_habito`
  - **Finanzas**: `consultar_finanzas`, `registrar_finanza` (auto-categoriza)
  - **Gym**: `consultar_rutina`, `registrar_entrenamiento`
  - **Academia (Panamericana)**: `consultar_academia`, `agregar_componente`, `calificar_componente`, `registrar_falta`
  - **Salud (bienestar)**: `consultar_salud` (peso + tendencia, promedios 7d con cambio, deuda de sueño, correlaciones sueño↔ánimo/energía), `registrar_salud` (sueño/ánimo/energía/pasos/agua/ejercicio del día), `registrar_peso` (peso/grasa/músculo — el último registro es el peso actual)
  - **Metas (objetivos)**: `consultar_metas` (progreso, ritmo a-tiempo/atrasado, hitos pendientes y hábitos que sostienen cada meta), `crear_meta`, `actualizar_progreso_meta`, `agregar_hito`, `completar_hito`, `vincular_habito_meta`
  - **Calendario**: `crear_evento`, `consultar_eventos`, `editar_evento`, `eliminar_evento`, **`planear_dia`** (crea 1+ bloques de tiempo reales en el calendario — estudio/gym/deep work/descanso — sin encimar compromisos existentes; siempre llama `consultar_estado` primero para ver el plan del día)
  - **Notificaciones**: `crear_notificacion` (empuja a la campana / centro de notificaciones)
- **Memoria**: tabla `shadow_memory` → se inyecta en system prompt como `## Memoria persistente`. El tool `recordar` escribe aquí
- **Mensajes guardados**: `shadow_messages.parts` = `[{text}, {tool}...]` (texto + resúmenes de acciones). El cliente parsea NDJSON y reconstruye texto + chips al recargar
- **Brief del día**: `app/api/shadow/brief/route.ts` (POST) — genera el brief analizando datos del día, lo cachea en `shadow_cache` key `brief:{YYYY-MM-DD}`. Se dispara desde el botón en Brief
- **Proyección académica**: `app/api/shadow/academia/route.ts` (POST) — analiza materias/calificaciones/exámenes/faltas y genera panorama + materias en riesgo + plan de exámenes + foco. Cachea en `shadow_cache` key `academia:{YYYY-MM-DD}`. Se dispara desde el botón en Panamericana
- **Análisis financiero**: `app/api/shadow/finanzas/route.ts` (POST) — analiza patrimonio, distribución del gasto, tendencia vs. mes previo y próximos pagos; devuelve 3 bloques (**Lectura** · **En qué se va el dinero** · **Movimientos**). Cachea en `shadow_cache` key `finanzas:{YYYY-MM}`. Se dispara desde el botón en Finanzas
- **Análisis de negocio (Flouvia)**: `app/api/shadow/flouvia/route.ts` (POST) — analiza pipeline, MRR, conversión propuesta→activo, proyectos activos e ingresos de 6 meses; devuelve 3 bloques (**Lectura** · **Oportunidades** [upsell/cowork/sinergias] · **Movimientos**). Cachea en `shadow_cache` key `flouvia:{YYYY-MM}`. Se dispara desde el botón en Flouvia
- **Análisis de salud**: `app/api/shadow/salud/route.ts` (POST) — analiza peso/tendencia, sueño (promedios + deuda), ánimo/energía, actividad y correlaciones; devuelve 3 bloques (**Lectura** · **Patrones** · **Movimientos**). Cachea en `shadow_cache` key `salud:{YYYY-MM}`. Se dispara desde el botón en Salud
- **Patrones predictivos**: `app/api/shadow/patrones/route.ts` (POST) — analiza `time_logs` por día×hora y devuelve JSON de patrones con bloqueos de calendario sugeridos. Cachea en `shadow_cache` key `patrones:{lunesISO}`. Se dispara desde Tiempo (ver sección Tiempo)
- **Cierre semanal/mensual**: `app/api/shadow/review/route.ts` (POST `{period:"week"|"month", refresh?}`) — motor determinista en `lib/shadow/review.ts`: recolecta señales de los 7 módulos y rankea `AttentionItem[]` por `score = pesoMódulo × factorSeveridad × urgencia(díasRestantes)`. Pesos: Academia 1.0 · Finanzas 0.95 · Salud/Metas 0.85 · Hábitos 0.7 · Tiempo 0.6 · Flouvia 0.55 — un examen difícil el viernes supera siempre a un follow-up. Shadow escribe el veredicto en 3 bloques (**Qué necesita tu atención** · **El período** · **Movimientos**) respetando ese orden. Items siempre recomputados (DB barato); veredicto cacheado: `review:week:{lunesISO}` / `review:month:{YYYY-MM}`. Se dispara desde `CierreFlow` en modo Semanal o Mensual (⌘.)

---

## Memoria de Claude — Sync de contexto personal
Exporta los datos de Valle OS a los archivos de memoria de Claude para que tenga contexto real de la vida de André en futuras conversaciones.

- **Script**: `scripts/sync-memory.js` — CJS, corre con `node scripts/sync-memory.js` sin servidor. Lee `.env.local`, consulta Supabase con service role key y escribe los archivos directamente
- **API route**: `app/api/shadow/sync-memory/route.ts` (POST) — misma lógica en TypeScript, usa `fs` para escribir a disco. Responde `{ ok, files, syncedAt }`
- **Botón en Ajustes**: sección "Memoria de Claude" en `AjustesDrawer` — llama la API, muestra estado loading/ok/error con timeout de 3s
- **Directorio destino**: `~/.claude/projects/-Users-andrevalleortega-Desktop-ValleOS/memory/`

**Archivos que genera:**
| Archivo | Contenido |
|---|---|
| `personal_habits.md` | Hábitos activos, días de schedule, completados/programados 30d, racha actual |
| `goals_flouvia.md` | Metas con progreso %, hitos con fecha + estado, hábitos que sostienen cada meta, clientes Flouvia con MRR y proyectos |
| `academia_data.md` | Materias activas, calificaciones, componentes, próximos exámenes con días restantes |
| `gym_data.md` | Rutina Upper/Lower, ejercicios por día, sesiones recientes, PRs (90d) |
| `finance_data.md` | Patrimonio neto, cuentas, tarjetas, inversiones, gastos del mes, distribución 30d |
| `shadow_memory.md` | Hechos persistentes de `shadow_memory` (si existen), agrupados por categoría |

`MEMORY.md` se actualiza automáticamente con links a los archivos nuevos. Cálculos: streak cuenta hacia atrás desde hoy sobre días scheduled; PRs filtran `weight != null && weight > 0`.

---

## Finanzas — Dinero (módulo 03)
- **Ruta**: `app/(os)/finanzas/page.tsx` (server: carga cuentas/tarjetas/inversiones/cargos recurrentes + movimientos de los últimos 6 meses + análisis cacheado) → todo se computa server-side y la interactividad son islas
- **Modelo de datos**: `financial_entries` (movimiento: `category` enum de 6 [flouvia_ingreso/gasto_personal/gasto_flouvia/ahorro/inversion/**pago_tarjeta**], `amount`, `subcategory` = bucket canónico, `card_id`/`account_id`, `payment_method`, `recurring_id → recurring_charges` — null en movimientos manuales, presente en los materializados por el cron) · `bank_accounts` (cuentas débito/efectivo/digital) · `credit_cards` (`credit_limit`, `current_balance`, `statement_balance` = saldo al corte a pagar, `statement_day` corte, `due_day` pago, `apr`) · `investments` · `capital_goals` · `recurring_charges` (cargos fijos con `charge_day`) · `budgets` (presupuestos por categoría, con UI)
- **Saldos automáticos**: triggers en `financial_entries` (`supabase/finanzas-v2.sql`) ajustan saldos en cada insert/update/delete (desde la app o Shadow): ingreso sube la cuenta · gasto a crédito sube la deuda de la tarjeta / gasto en efectivo·débito baja la cuenta · ahorro/inversión bajan la cuenta de origen · **pago_tarjeta** baja la deuda de la tarjeta y baja la cuenta de origen. Función `fin_apply_balances(entry, sgn)` (sgn +1 aplica, −1 revierte) + trigger `fin_entry_balance_trigger()`. No hace backfill: los saldos actuales son el punto de partida
- **Automatización de cargos recurrentes**: `app/api/cron/recurring-charges/route.ts` — GET (auth `CRON_SECRET`). Corre diario a las 8am CDMX (14:00 UTC) vía Vercel cron. Para cada `recurring_charge` activo: materializa un `financial_entry` si `hoy >= charge_day` y no existe uno con ese `recurring_id` este mes (idempotente / catch-up). Fecha del entry = día de cargo, no día de ejecución. Migración: `supabase/recurring.sql` (columna `recurring_id` + índice).
- **Taxonomía de gasto**: `lib/finance/categories.ts` — buckets canónicos (`escuela`, `comida`, `salidas`, `transporte`, `suscripciones`, `salud`, `hogar`, `compras`, `servicios`, `ahorro`, `inversion`, `flouvia`, `pago`, `ingreso`, `otros`) cada uno con color + ícono. `SPENDING_BUCKETS` (los que se ofrecen como gasto) excluye `ingreso`/`pago`. `normalizeBucket()` (sinónimos, estilo `muscles.ts`), `entryBucket()` (unifica category+subcategory → bucket para la distribución; `pago_tarjeta → pago`, excluido de la distribución de gasto), `bucketLabel/Color/Icon`
- **Próximos pagos**: `lib/finance/payments.ts` — `buildUpcomingPayments(cards, recurring)` calcula la próxima fecha de cada `due_day`/`charge_day` (`nextOccurrenceOfDay`, clamp al fin de mes), el monto (tarjeta: `statement_balance ?? current_balance`) y los días que faltan, ordenado. Compartido por la página y Shadow
- **Dashboard**: header con 3 botones (`AddAccount` · `AddCard` · `AddEntry`) · patrimonio neto · KPIs (saldo, ingresos, gastos, balance del mes) · panel **análisis de Shadow** (`Analysis.tsx` → `ShadowAnalysis` con orbe) · **gráficas** (`FinanceCharts.tsx`, client): donut SVG de distribución del gasto con leyenda interactiva + barras ingresos/gastos de 6 meses · **presupuestos** (`Budgets.tsx`) · **próximos pagos** (tarjetas + recurrentes, resalta ≤3 días) · cuentas (`AccountsList`, click → editar) · **tarjetas realistas** (`CreditCardsList`, gradiente/chip/número, barra de uso con tope al 100% + aviso "sobrepasado", click → editar) · metas de capital · **movimientos** (`Transactions`, con filtros por tipo/mes + búsqueda, click en fila → editar/borrar)
- **Islas**: `AddEntry.tsx` (segmento **Egreso / Ingreso / Pago tarjeta**; egreso → categoría + chips de bucket [solo gastos] + método + cuenta/tarjeta; ingreso → cuenta destino; pago → tarjeta a pagar [con montos rápidos saldo al corte/total] + cuenta de origen), `EditEntry.tsx` (editar/borrar cualquier movimiento; el trigger revierte y reaplica saldos), `AddAccount`/`EditAccount`, `AddCard`/`EditCard` (eliminar = `active=false`), `Budgets.tsx` (tope mensual por bucket con barra de avance, alta/edición/borrado en un modal interno), `Transactions.tsx` (filtros + búsqueda + filas editables). Las gráficas son SVG a mano (sin librería), igual que el gym
- **Conexión con Shadow**: tools `consultar_finanzas` (patrimonio, distribución, próximos pagos) y `registrar_finanza` (Shadow **auto-categoriza**: elige categoría + subcategoría canónica; distingue **compra a crédito** [gasto + `metodo_pago='tarjeta de crédito'`] de **pago_tarjeta** [abono a la deuda]; resuelve `tarjeta`/`cuenta` por nombre → `card_id`/`account_id` para que los triggers ajusten saldos). `consultar_estado` incluye el próximo pago a ≤10 días. Clases CSS: `.fin-*` (charts, donut, leyenda, barras, filas de pago, chips de bucket, filtros, presupuestos), `.cc-*` (tarjeta de crédito realista)

---

## Flouvia — Negocio / agencia (módulo 08)
- **Ruta**: `app/(os)/flouvia/page.tsx` (server: carga clientes + proyectos no cancelados + facturas de 6 meses + follow-ups pendientes + análisis cacheado) → `FlouviaClient.tsx` (dashboard cliente que computa KPIs/gráfica y persiste vía edición inline). El header (server) muestra contador de activos/propuestas
- **Modelo de datos**: `flouvia_clients` (`status` propuesta/activo/pausado/completado, `project_value`, `monthly_value` = MRR, `description`, `notes`, `sort_order`) → `flouvia_projects` (`status` scoping/in_progress/review/delivered/cancelled, `total_value`, `estimated_hours`/`actual_hours`, `deadline`) · `flouvia_invoices` (`status` draft/sent/paid/overdue/cancelled, `total`, `issued_date`, `paid_date`) · `flouvia_contacts` · `flouvia_followups` (`title`, `due_date`, `done`)
- **Dashboard** (`FlouviaClient`): botones (Cliente · Proyecto) · KPIs (Pipeline activo, MRR, Cobrado este mes, Por cobrar) · **gráfica de ingresos** SVG a mano de 6 meses (verde cobrado / azul pendiente, mes actual en dorado) · panel **análisis de Shadow** (`Analysis.tsx`) · follow-ups pendientes con botón "Listo" inline · **kanban** de 4 columnas (clic en card → editar cliente) · lista de proyectos (clic → editar proyecto)
- **Edición**: todo es editable después de creado. Clic en card del kanban abre modal pre-llenado (nombre, estado, valor proyecto, MRR, descripción, notas) con eliminar. Clic en proyecto abre modal (nombre, cliente, estado, valor, horas, deadline, descripción) con eliminar; el botón "Proyecto" abre el mismo modal en blanco. Los inserts de `flouvia_projects` usan cast `as any` (typing estricto de supabase-js)
- **Islas**: `AddClient.tsx` (crear cliente, usado en header y pie de cada columna), `Analysis.tsx` (panel de Shadow, mismo patrón y clases `.fin-analysis-*` que Finanzas). El resto (gráfica, kanban editable, modales de edición de cliente/proyecto, follow-ups) vive dentro de `FlouviaClient`
- **Conexión con Shadow**: análisis de negocio vía `app/api/shadow/flouvia/route.ts` (ver sección Shadow). El ticker del topbar usa `flouvia_clients.monthly_value` de activos como MRR

---

## Academia — Panamericana (módulo 09)
- **Ruta**: `app/(os)/panamericana/page.tsx` (server: carga materias activas + `grade_components` + entregas pendientes + `class_schedule` + **`semesters`** + análisis cacheado) → `PanamericanaClient.tsx` (dashboard cliente que computa todo y persiste vía islas). La página separa semestres por `status`: `activeSemester` (`status='active'`) y `closedSemesters` (`status='closed'`)
- **Modelo de datos**: `academic_courses` (materia, `target_grade` = objetivo, `color`, `absences`/`max_absences` para faltas, **`semester_id`** = a qué semestre pertenece [null = semestre en curso, las materias activas tienen `active=true`]) → `grade_components` (el esquema de calificación: cada componente del 100% con `kind` examen/tarea/proyecto/participacion/otro, `weight`, `grade` 0-10, `date`; los exámenes llevan `difficulty` 1-5, `study_start_date`, `topics`, **`exam_time`**; eventos de calendario en **`calendar_event_id`** [examen] y **`study_event_id`** [bloque de estudio]). `class_schedule` (horario: `day_of_week` 0-6, `start_time`/`end_time`, `room`, **`calendar_event_id`** del evento recurrente). `assignments` (entregas con `due_date` + **`due_time`** + **`calendar_event_id`**). **`semesters`** (historial: `label`, `term_number`, `gpa` final, `course_count` = nº de materias, `credits_taken`/`credits_passed`, `status` active/closed)
- **Cálculo de calificaciones** (`lib/academia/grades.ts`): `computeCourseGrades()` (promedio ponderado → actual/proyectada, peso calificado/restante), `neededForTarget()` (qué promedio necesita en lo que falta para su meta), `suggestStudyStart()` (fecha − días según dificultad: 1→2d … 5→18d), `studyState()` (urgent/study-now/soon/later), `absenceRisk()` (safe/warn/danger vs. límite). Al calificar un componente se recalcula y persiste `academic_courses.grade` para que GPA y ticker queden consistentes
- **Trayectoria / promedio general** (`lib/academia/semesters.ts`): en la UP los créditos son solo el "costo" de la materia — **todas las materias pesan igual**. `cumulativeGpa(closed, active)` = promedio general ponderado por **nº de materias** (cada semestre cerrado aporta `gpa × course_count`; el activo aporta cada materia calificada). Por eso los semestres "rápidos" guardan `course_count`. `semesterGpa()` (promedio simple del semestre), `buildTrajectory()` (puntos por semestre + el activo en curso), `nextTermNumber()`, `gpaColor()`
- **Dashboard** (`PanamericanaClient`): KPIs (GPA proyectado, materias, créditos, exámenes próximos, faltas en riesgo) · panel de **proyección de Shadow** · sección **`Semesters`** (trayectoria) · lista de exámenes próximos (color por dificultad + "estudia ya"/cuántos días) · horario semanal en grid · entregas pendientes · cards de materia expandibles con esquema de calificación (barras de peso + input inline de calificación), "necesitas X en el Y% restante", stepper de faltas con riesgo, **botón "Editar materia"** y su horario
- **`Semesters.tsx`** (isla): tarjeta "Trayectoria académica" con **promedio general** + **meta de beca** editable (riesgo/a salvo, guardada en `ajustes.academia` de Zustand) · **gráfica de trayectoria** SVG por semestre (el activo en dorado punteado) · **barra de avance de créditos** vs. `creditsTarget` · historial de semestres cerrados (con eliminar). Acciones: **Cerrar semestre** (calcula el promedio de las materias activas, las archiva con `active=false`+`semester_id`, las pasa al historial) y **Semestre pasado** (modal con toggle **Rápido** [promedio + nº materias + créditos] o **Materia por materia** [inserta `academic_courses` con `active=false`]). Clases `.ac-traj-*`, `.ac-sem-*`, `.ac-meta-*`, `.ac-credit-*`
- **Sincronización con Google Calendar** (`lib/academia/calendar.ts`, best-effort desde el cliente, CDMX `-06:00` fijo): al crear una entrega con fecha (`syncAssignment`), un examen futuro sin calificar (`syncExam` + `syncStudyBlock` para el día sugerido de estudio) o una clase (`syncClass`, evento **semanal recurrente** `RRULE:FREQ=WEEKLY;BYDAY=…;COUNT=20`) se hace POST a `/api/calendar` y se guarda el id devuelto. Al borrar componente/clase/materia se llama `deleteCalEvent`. La ruta `/api/calendar` ahora acepta `recurrence?: string[]`. Si el calendario falla, la captura sigue (id queda null)
- **Islas**: `AddCourse` (con faltas permitidas), `EditCourse` (editar objetivo/color/profesor/créditos/faltas/notas + eliminar con limpieza de eventos de calendario), `AddComponent` (examen/componente con dificultad + hora + sugerencia de cuándo estudiar), `AddAssignment` (con hora límite), `AddClass` (horario). Calificar/borrar componentes y ajustar faltas es inline en `PanamericanaClient`
- **Migración**: `supabase/academia-v2.sql` (aditiva — **correr en Supabase**): añade `semesters.status`/`term_number`/`course_count`, `academic_courses.semester_id`, `assignments.due_time`/`calendar_event_id`, `grade_components.exam_time`/`calendar_event_id`/`study_event_id`, `class_schedule.calendar_event_id`
- **Recordatorios** (`NotifCenter`, client): `scanAcademia` consulta entregas (≤2 días) y exámenes (≤3 días) sin terminar y crea notis (severidad escala a `error` el día 0/1). Dedupe en `localStorage` key `valleos-notified-academia` por `id:día`
- **Conexión con Shadow**: tools `consultar_academia`, `agregar_componente`, `calificar_componente`, `registrar_falta`; `consultar_estado` incluye el próximo examen. Shadow consulta, registra exámenes/notas/faltas y proyecta el semestre — André edita el detalle en la app (incluyendo materias vía `EditCourse` y el historial de semestres vía `Semesters`)

---

## Gym — Entrenamiento (módulo 11)
- **Ruta**: `app/(os)/gym/page.tsx` (server: carga rutinas/días/ejercicios/sesiones/series + `workout_schedule` + `cardio_sessions`/`cardio_goal` de los últimos 120d) → `GymClient.tsx` (dashboard cliente que computa todo y persiste vía islas)
- **Modelo de datos** (8 tablas): `workout_routines` (rutinas, una `active`) → `workout_days` (días con `muscle_groups[]`, `day_order` define el ciclo) → `workout_exercises` (plantilla: `target_sets`/`target_reps`/`muscle_group`, **`tracking_type`** `'strength'|'timed'|'bodyweight'` default `'strength'`, `target_duration_seconds` para ejercicios por tiempo). Lo registrado: `workout_sessions` (un entrenamiento, guarda `day_name` denormalizado — puede combinar varios días "Upper + Abdomen") → `workout_sets` (peso×reps por serie o `duration_seconds` para ejercicios `timed`, `exercise_name`/`muscle_group` denormalizados para sobrevivir ediciones). **`workout_schedule`** (horario semanal: `weekday` 0-6 convención JS → `day_id`; varias filas mismo weekday = varias rutinas ese día; sin filas = descanso). **`cardio_sessions`** (carrera/cardio como serie propia: `activity` run/walk/bike/swim/row/other, `distance_km`, `duration_minutes`, `avg_hr`, `elevation_m`, `calories`) + **`cardio_goal`** (fila única id=1: `weekly_km_target`, `race_distance_km`, `race_date`). Helpers en `lib/gym/schedule.ts` (`WEEK_ORDER` Lun→Dom, `todayWeekday`, `pace`, `CARDIO_ACTIVITIES`, `fmtKm`). Migración: `supabase/gym-v2.sql` (**correr** — re-asegura también las columnas de `gym-tracking.sql`, cuya ausencia hacía que el insert de series fallara en silencio)
- **Catálogo de músculos**: `lib/gym/muscles.ts` — 13 keys canónicas (`pecho`, `espalda`, `hombros`, `biceps`, `triceps`, `antebrazo`, `abdomen`, `trapecio`, `cuadriceps`, `isquios`, `gluteos`, `pantorrillas`, `lumbar`) + `normalizeMuscle()` (sinónimos) + `muscleLabel()`
- **Mapa muscular**: `components/gym/MuscleMap.tsx` — figuras SVG frente/espalda; cada grupo es un `<path>` coloreado por intensidad (series del período / máx). Heatmap dorado→ámbar. Hover muestra el músculo + series
- **Dashboard** (`GymClient`): stats strip (sesiones, volumen, Δ vs período previo, series, PRs del mes) · card **"Hoy toca"** (driven por `workout_schedule` del día de hoy — muestra todos los días asignados; "Descanso" si no toca; fallback al ciclo si no hay horario configurado) · mapa muscular con toggle Semana/Mes · **strip "Tu semana"** (Lun→Dom con los días asignados / descanso, hoy resaltado, botón Editar) · barras de volumen por músculo · sparklines de progresión (peso máx top 4 ejercicios) · volumen semanal 8 semanas · **sección Carrera·cardio** (meta semanal km con barra, total/sesiones/ritmo medio, progreso hacia carrera objetivo + countdown, distancia semanal 8s, cardio reciente) · historial
- **Interactivo desde la app** (no desde el chat): `LogSession.tsx` registra una sesión que puede **apilar varios días** (chips `.gym-day-chip` prellenados desde el horario de hoy, agregables de cualquier rutina → `day_name` combinado "Upper + Abdomen"); el input cambia según `tracking_type` (`strength` → kg×reps, `timed` → segundos, `bodyweight` → solo reps); ejercicio libre con selector de tipo. **Errores visibles vía `toast` de sonner** (antes los inserts fallaban en silencio): si falla el insert de series borra la sesión para no dejar huérfana. `ScheduleEditor.tsx` (modal `wide`) edita el horario semanal (asigna 0+ días por día de semana, persiste inmediato a `workout_schedule`). `LogCardio.tsx` registra carrera/cardio (calcula ritmo en vivo). `CardioGoalEditor.tsx` (botón ⌖) fija la meta semanal + carrera objetivo (upsert `cardio_goal` id=1). `RoutineEditor.tsx` (modal `wide`) gestiona rutinas/días/ejercicios. **`EditSession.tsx`**: clic en una sesión del historial (`.gym-hist-row`) la abre para editar/borrar series (peso/reps/tiempo), agregar/quitar ejercicios y meta (fecha/duración/peso corporal/notas), o eliminar la sesión (confirm en línea); al guardar inserta las series nuevas y luego borra las viejas (no pierde datos si el insert falla). Quick actions: `entreno` (LogSession), `cardio` (LogCardio). `router.refresh()` al cerrar
- **Conexión con Shadow**: tools `consultar_rutina` y `registrar_entrenamiento`; `consultar_estado` incluye resumen de gym. Shadow consulta y registra sesiones — André edita la rutina en la app

---

## Brain — Segundo cerebro (módulo 04)
- **Ruta**: `app/(os)/brain/page.tsx` (client) — captura rápida de notas + búsqueda + tab Vault (Obsidian). Cada nota deriva su título de la primera línea no vacía; si hay Obsidian conectado, empuja un `.md` al vault (fire-and-forget)
- **Modelo de datos**: `brain_notes` — `content`, `source`, `title`, `obsidian_path`, `tags text[]`, `related_ids uuid[]`, `embedding vector(1536)` (scaffolding sin usar). Migración aditiva: `supabase/brain.sql` (agrega `tags`, `related_ids` + índice GIN; también `title`/`obsidian_path` por si faltan)
- **Auto-tagging semántico**: al guardar una nota, el cliente llama `app/api/brain/tag/route.ts` (POST `{id}`, no bloquea la captura). Claude (`claude-sonnet-4-6`) recibe la nota + un catálogo de hasta 50 notas existentes y devuelve JSON `{tags:[2-4], related:[≤3 ids]}`; la ruta valida que los `related` existan y persiste `tags`/`related_ids`. La UI muestra las tags como chips clickeables (`#tag` → setea búsqueda), las relacionadas como chips (→ búsqueda por su título), y "Shadow etiquetando…" mientras corre. La búsqueda también filtra por tags. Clases `.bn-*`
- **Nota sobre embeddings**: el schema tiene `embedding vector(1536)` + RPC `search_brain_notes` pero **no se popula** (no hay proveedor de embeddings; solo `ANTHROPIC_API_KEY`). El enlazado lo hace Claude, no similitud vectorial

---

## Lectura — Lista de lectura (módulo 12)
- **Ruta**: `app/(os)/lectura/page.tsx` (server: carga `reading_items` excluyendo archivados) — libros y contenido se separan dentro de cada sección (Leyendo / Por leer / Completados)
- **Modelo de datos**: `reading_items` — `type` (`article`|`video`|`podcast`|`paper`|`book`|`other`), `status` (`pending`|`reading`|`done`|`archived`), `title`, `url`, `source` (autor), `summary`, `notes`, `estimated_minutes` (para no-libros), `cover_url` (URL imagen portada, libros), `total_pages` / `current_page` (progreso, libros), `completed_at`. Migración aditiva: `supabase/lectura.sql`
- **Dos tipos de card** (client components, cada uno maneja su estado y edición):
  - `BookCard.tsx` — tarjeta horizontal con portada CSS (color determinista por título o imagen si hay `cover_url`; efecto spine con sombra inset). Barra de progreso + input de página actual editable inline (actualiza `current_page` en Supabase al `onBlur`). Botones: ciclar estado · Editar · Ver (si hay URL)
  - `ContentCard.tsx` — tarjeta compacta con ícono de tipo coloreado por variante (azul artículo, rojo video, violeta podcast). Ciclar estado inline + botón de editar con ícono
- **Islas**: `AddReading.tsx` (modal agregar — campos dinámicos: libros muestran `cover_url`+`total_pages`, contenido muestra `estimated_minutes`), `EditReading.tsx` (modal editar todo + archivar; campos dinámicos igual que Add), `BookCard.tsx`, `ContentCard.tsx`
- **Clases CSS**: `.rd-book-card`, `.rd-cover`, `.rd-cover-initial`, `.rd-book-info`, `.rd-book-title`, `.rd-book-author`, `.rd-book-summary`, `.rd-progress-wrap`, `.rd-progress-bar`, `.rd-progress-fill`, `.rd-progress-meta`, `.rd-page-input`, `.rd-book-actions`, `.rd-content-card`, `.rd-content-type`, `.rd-content-info`, `.rd-content-header`, `.rd-content-title`, `.rd-content-actions`, `.rd-content-meta`, `.rd-content-summary`, `.rd-icon-btn`

---

## Salud — Bienestar (módulo 10)
- **Ruta**: `app/(os)/salud/page.tsx` (server: carga `health_entries` de 30 días, `weight_logs` de 180 días y análisis cacheado) → dashboard con islas cliente
- **Modelo de datos**:
  - `health_entries` (registro diario, `date` único): `sleep_hours`, `sleep_quality`, `bedtime`/`wake_time` (sueño detallado), `mood`/`energy` (1-5), `steps`, `resting_hr`, `active_calories`, `water_l`, `workout_minutes`/`workout_type`, `source` (`manual`/`shadow`/`apple_health`). El `weight_kg` legacy ya NO se escribe desde la UI
  - `weight_logs` (peso como **serie propia**, `date` único): `weight_kg`, `body_fat_pct`, `muscle_kg`, `source`. André no se pesa a diario, así que el peso vive aquí y el último registro es su "peso actual". Migración aditiva: `supabase/salud.sql` (crea `weight_logs`, agrega columnas a `health_entries`)
- **Cálculo** (`lib/salud/health.ts`): `weightStats()` (peso actual = último, delta del período, kg/sem, rango), `sleepDebt()` (deuda vs objetivo `SLEEP_TARGET` = 7.5h), `compareWindows()` (promedio 7d vs. 7d previos → delta), `correlate()`/`corrLabel()` (Pearson sueño↔ánimo y sueño↔energía), `sleepColor()` (verde ≥7.5h / dorado 6-7.5 / rojo <6)
- **Dashboard**: header con 2 botones (`LogWeight` peso · `LogHealth` día) · card de **peso actual** (valor grande + Δ + grasa/músculo/rango) · KPIs 7d (sueño/ánimo/energía/pasos, cada uno con su delta vs. semana previa) · panel **análisis de Shadow** (`Analysis.tsx`) · **gráficas** (`SaludCharts.tsx`, SVG a mano): tendencia de peso (línea+área), sueño (barras 14d), ánimo vs. energía (líneas superpuestas) · card **"Tus patrones"** (correlaciones + deuda de sueño) · **heatmap de sueño** 30d · historial
- **Islas**: `LogWeight.tsx` (registrar peso → `weight_logs`), `LogHealth.tsx` (registrar día → `health_entries`; deriva horas de sueño de acostado/despierto, usa `.sl-rating` 1-5), `SaludCharts.tsx` (gráficas), `Analysis.tsx` (panel de Shadow, reusa clases `.fin-analysis-*`)
- **Apple Salud / Apple Fitness**: la PWA no lee HealthKit directo. Endpoint `app/api/health/ingest/route.ts` (POST, auth header `Authorization: Bearer <HEALTH_INGEST_SECRET>`) recibe JSON y hace upsert parcial a `health_entries` + `weight_logs` (`source: apple_health`). André configura un Atajo (Shortcuts) en su iPhone que lea Salud y haga el POST. Pendiente: crear el Atajo y definir `HEALTH_INGEST_SECRET`
- **Conexión con Shadow**: análisis vía `app/api/shadow/salud/route.ts`; tools `consultar_salud`, `registrar_salud`, `registrar_peso`; `consultar_estado` incluye sueño prom 7d + peso. Clases CSS: `.sl-*`

---

## Tiempo — Tracker de tiempo (módulo 13)
- **Ruta**: `app/(os)/tiempo/page.tsx` (server: carga `time_blocks` activos + `time_logs` últimos 100d + `flouvia_clients` para nombres de cliente) → `TiempoCharts.tsx` (client: todos los charts SVG/CSS)
- **Modelo de datos**: `time_blocks` (plantilla del día: `start_time`, `label`, `active`, `sort_order`) · `time_logs` (sesión: `label`, `started_at`, `ended_at`, `duration_minutes` generado, `category`, `client_id → flouvia_clients`, `block_id`). Migración aditiva: `supabase/tiempo.sql` (agrega `client_id` + índices — correr en Supabase)
- **Categorías**: `lib/tiempo/categories.ts` — 7 categorías (`Flouvia`, `Panamericana`, `Estudio`, `Deep work`, `Salud`, `Personal`, `Descanso`) con color e ícono. Helpers: `catColor()`, `catIcon()`, `clientColor(index)` (paleta estable para clientes Flouvia), `fmtHours(mins)` → `"1.5h"` / `"45m"` / `"—"`
- **Dashboard**: server computa todos los datos (ventanas diaria/semanal/30d/90d en TZ `America/Mexico_City`), charts son client components en `TiempoCharts.tsx`
  - **5 KPIs**: Hoy · Esta semana · Δ% vs semana previa (verde/rojo) · Promedio/día 30d · Racha activa (días consecutivos hacia atrás)
  - **Heatmap** (`ActivityHeatmap`): 13 semanas estilo GitHub — 4 niveles de intensidad dorada, mes en tope de columna, hoy resaltado, semanas empiezan el lunes
  - **Barras semanales** (`WeeklyHours`): últimas 10 semanas (lunes a lunes), semana actual en dorado
  - **Donut categorías** (`CategoryDonut`): distribución 30d interactiva con leyenda — reusa `.fin-donut-wrap` de Finanzas
  - **Barras por cliente** (`ClientHours`): tiempo 30d ligado a `client_id → flouvia_clients`, color estable por índice
  - **Ritmo del día** (`DayRhythm`): 24 barras, hora pico en dorado, tooltip hora + duración
  - Plantilla del día · Sesiones recientes (dot de color por categoría + nombre de cliente si tiene `client_id`)
- **Patrones predictivos** (`Patrones.tsx`, isla cliente bajo los KPIs): `app/api/shadow/patrones/route.ts` (POST) analiza `time_logs` de 90d agregando minutos por **día de la semana × categoría** + hora modal de cada celda; Claude devuelve JSON `{patterns:[{insight, suggestion, block?:{title, weekday 0-6, start, end}}]}` (máx 3). Cachea el JSON en `shadow_cache` key `patrones:{lunesISO}` (la página lo parsea y lo pasa como prop). Cada patrón con `block` muestra el slot (`Mié · 14:00–16:00`) y un botón **"Bloquear en calendario"** que hace POST a `/api/calendar` calculando la próxima ocurrencia del weekday con offset fijo CDMX `-06:00`. weekday usa convención JS (0=Domingo). `weekday=0` significa "hoy" → agenda la próxima semana
- **`LogTime.tsx`**: recibe `clients[]` del servidor; muestra selector de cliente cuando `category === "Flouvia"`. `client_id` se guarda en el insert
- **Clases CSS**: `.tm-kpis` (grid 5 col responsive) · `.tm-grid-2` (grid 2 col) · `.tm-hm-*` (heatmap, key, cells con `data-lvl`) · `.tm-week-*` (barras semanales, `.current` en dorado) · `.tm-client-*` (barras por cliente con color inline) · `.tm-rhythm` / `.tm-rhythm-bar.peak` / `.tm-rhythm-axis` · `.tm-dot` · `.pt-*` (patrones: card, item, insight, suggestion, block, slot)

---

## Metas — Objetivos (módulo 07)
- **Ruta**: `app/(os)/metas/page.tsx` (server: carga metas activas/pausadas + sus `goal_milestones`, `goal_habits`, hábitos activos y `habit_completions` de 30d; calcula adherencia 30d por hábito y la pasa a las tarjetas) → islas cliente que persisten vía Supabase + `router.refresh()`. Mantiene además la card de **metas de capital** (`capital_goals`, de Finanzas)
- **Modelo de datos**: `goals` (`progress_type` `percentage`/`numeric`/`milestones`, `current_value`, `target_value`, `unit`, `target_date`, `started_at` [inicio del tracking], `category`, `status` active/paused/completed/archived, `pinned`) → `goal_milestones` (hitos: `title`, `done`, `done_at`, `due_date`, `sort_order`) · `goal_habits` (vínculo **qué hábitos sostienen qué meta**: PK `(goal_id, habit_id)`). Migración aditiva: `supabase/metas.sql` (crea `goal_habits`, agrega `goals.started_at`, amplía el check de `progress_type` para aceptar `'percentage'`)
- **Cálculo** (`lib/metas/progress.ts`): `goalPct()` (% según tipo: hitos completados, valor/objetivo, o el % directo), `goalPace()` (**ritmo**: compara avance real vs. el esperado en la ventana `started_at → target_date` → `ahead`/`ontrack`/`behind`/`done`/`none` con etiqueta "A tiempo/Adelantado/Atrasado · faltan N días"), `milestoneState()` (`done`/`overdue`/`soon` ≤7d/`upcoming`/`nodate`). `lib/metas/categories.ts` — `GOAL_CATS` (valor+label+color) y `catColor()`/`catLabel()`
- **Tarjeta** (`GoalCard.tsx`, client): header con ícono+categoría+estado · **barra de progreso estilo gym** (gradiente del color de categoría) con **marcador de ritmo** (línea que muestra dónde deberías ir) + etiqueta de ritmo coloreada · actualización inline del valor (no para tipo hitos) · **hitos en línea** ordenados por fecha, con color por estado (verde hecho / rojo vencido / dorado pronto), click para marcar · **motor**: filas de hábitos vinculados con barra de adherencia 30d
- **Islas**: `AddGoal.tsx` (crear meta — elige tipo de progreso, hitos iniciales con fecha y chips para vincular hábitos), `GoalManage.tsx` (modal `wide`: editar todos los campos, gestionar hitos con fecha [diff insert/update/delete], vincular/desvincular hábitos, eliminar meta). `GoalCard.tsx` muestra y dispara acciones rápidas
- **Clases CSS**: `.mt-goal`, `.mt-goal-head`, `.mt-goal-icon`, `.mt-gear`, `.mt-prog`, `.mt-track` (+ `.mt-track-fill`/`.mt-track-marker`), `.mt-pct`, `.mt-pace`, `.mt-section`, `.mt-hitos`/`.mt-hito` (`.done`/`.overdue`/`.soon`), `.mt-engine`/`.mt-engine-row`, `.mt-mng-*` (modal), `.mt-hab-pick`/`.mt-hab-chip`
- **Conexión con Shadow**: tools `consultar_metas`, `crear_meta`, `actualizar_progreso_meta`, `agregar_hito`, `completar_hito`, `vincular_habito_meta` (`buildMetas` en `tools.ts`); `consultar_estado` incluye conteo de metas + próximo hito. El sync de memoria exporta hitos con fecha/estado y los hábitos que sostienen cada meta

---

## Supabase — Tipos
Archivo: `lib/supabase/types.ts`

**CRÍTICO**: Toda tabla debe incluir `Relationships: []` o las queries retornan `never` en TypeScript (bug de supabase-js v2.106+).

Para joins anidados con `.select("*, otra_tabla(campo)")`, usar cast doble:
```ts
const data = result.data as unknown as MiTipo[];
```

Tablas principales: `user_preferences`, `habits`, `habit_completions`, `financial_entries` (incluye `recurring_id`), `bank_accounts`, `credit_cards`, `investments`, `flouvia_clients`, `flouvia_projects`, `shadow_conversations`, `shadow_messages`, `shadow_memory`, `shadow_cache`, `notifications` (incluye `pushed`), `push_subscriptions`, `brain_notes`, `goals` (incluye `started_at`), `goal_milestones`, `goal_habits`, `capital_goals`, `health_entries`, `weight_logs`, `reading_items`, `custom_pages`, `time_logs`, `academic_courses` (incluye `absences`/`max_absences`/`semester_id`), `grade_components` (incluye `exam_time`/`calendar_event_id`/`study_event_id`), `class_schedule` (incluye `calendar_event_id`), `assignments` (incluye `due_time`/`calendar_event_id`), `semesters` (incluye `status`/`term_number`/`course_count`), `priorities`, `daily_notes`, `workout_routines`, `workout_days`, `workout_exercises`, `workout_sessions`, `workout_sets`, `workout_schedule`, `cardio_sessions`, `cardio_goal`.

Schema completo en `supabase/schema.sql` — correr en Supabase SQL Editor para crear/recrear tablas. Migraciones aditivas (sin borrar datos): `supabase/gym.sql`, `supabase/gym-tracking.sql` (`workout_exercises.tracking_type` + `target_duration_seconds` + `workout_sets.duration_seconds`), `supabase/gym-v2.sql` (`workout_schedule` + `cardio_sessions` + `cardio_goal` + re-asegura columnas de tracking — **correr para horario semanal y cardio**), `supabase/academia.sql` (faltas + `grade_components`), `supabase/academia-v2.sql` (`semesters.status`/`term_number`/`course_count` + `academic_courses.semester_id` + `assignments.due_time`/`calendar_event_id` + `grade_components.exam_time`/`calendar_event_id`/`study_event_id` + `class_schedule.calendar_event_id` — **correr para historial de semestres + sync de calendario**), `supabase/finanzas.sql` (`financial_entries.account_id` + `credit_cards.statement_balance` + índices), `supabase/lectura.sql` (`reading_items.cover_url` + `total_pages` + `current_page`), `supabase/metas.sql` (`goal_habits` + `goals.started_at` + check de `progress_type` ampliado a `'percentage'`), `supabase/tiempo.sql` (`time_logs.client_id → flouvia_clients` + índices), `supabase/salud.sql` (tabla `weight_logs` + columnas `steps`/`resting_hr`/`active_calories`/`bedtime`/`wake_time`/`source` en `health_entries`), `supabase/brain.sql` (`brain_notes.tags` + `related_ids` + índice GIN — **correr para que funcione el auto-tagging**), `supabase/recurring.sql` (`financial_entries.recurring_id` + índice — **cron de cargos recurrentes**), `supabase/push.sql` (tabla `push_subscriptions` + `notifications.pushed` — **Web Push**), `supabase/finanzas-v2.sql` (categoría `pago_tarjeta` + triggers de saldo automático en `financial_entries` — **correr para que los saldos se ajusten solos y para registrar pagos de tarjeta**).

**Cambios de tipo aditivos en `types.ts`**: `health_entries.Insert` es `Partial<...> & { date: string }` (upserts parciales válidos sin cast). `time_logs.Row` incluye `client_id: string | null`. `financial_entries.Row` incluye `recurring_id: string | null` (Insert omite + hace opcional). `notifications.Row` incluye `pushed: boolean` (Insert omite + hace opcional con default false). `push_subscriptions` tabla completa. Tablas académicas: `semesters.Insert` omite `status` (opcional); `academic_courses`/`grade_components`/`assignments`/`class_schedule` omiten sus columnas nuevas en Insert y las hacen opcionales.

---

## Calendario — Google Calendar bidireccional (módulo 05)
- **API route**: `app/api/calendar/route.ts` — CRUD completo contra `calendarId: "primary"`:
  - `GET ?days=N` → lista eventos (incluye `id`, `description`, `allDay`, `location`, `color`/colorId, `htmlLink`)
  - `POST` → crea evento `{title, start, end?, description?, location?, color?, allDay?, recurrence?}` (`recurrence: string[]` = reglas RRULE para eventos recurrentes, ej. clases semanales)
  - `PATCH` → edita por `id` (parcial: cualquier campo)
  - `DELETE ?id=` → borra
  - Helpers: `getCalendar()` (OAuth2 con refresh token), `serialize()`, `toRequestBody()`. Zona horaria fija `America/Mexico_City`. En `allDay`, Google usa fin exclusivo (el modal suma 1 día).
- **Env vars**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_REFRESH_TOKEN`
- **UI** (`app/(os)/calendario/page.tsx`, client): vista de día con navegación. El botón "Evento" y los slots horarios vacíos abren `EventModal` en modo crear; click en un evento lo abre en modo editar. Tras crear/editar/borrar → re-fetch (`load()`)
- **`components/calendario/EventModal.tsx`**: modal reutilizable crear/editar/borrar. Campos: título, todo-el-día, inicio/fin (`datetime-local` o `date`), ubicación, descripción (textarea) y color (chips `.cal-color-chip`). Convierte ISO↔valor local y llama `POST`/`PATCH`/`DELETE`. Exporta el tipo `CalEvent`
- **Shadow lee y escribe el calendario**: tools `consultar_eventos` (lee próximos N días con cuánto falta), `crear_evento` (con ubicación/descripción), `editar_evento` (mover/agrandar buscando por título), `eliminar_evento`. `consultar_estado` incluye la agenda de 48h; el brief incluye la agenda del día y marca lo que requiere prepararse
- **Avisos de urgencia**: ver sección Notificaciones — `NotifCenter` escanea el calendario y Shadow puede empujar notis con `crear_notificacion`

---

## Notificaciones — campana del topbar
- **Tabla**: `notifications`: `{ title, body, severity('info'|'warning'|'error'|'success'), module, href, read, dismissed, pushed, created_at }`. `pushed` indica si ya se envió al dispositivo vía Web Push (default `false`).
- **`components/shell/NotifCenter.tsx`** (client, vive en el Topbar): campana con badge de no-leídas + panel dropdown (`.notif-*`). Lee `notifications` (no descartadas) vía Supabase client, refresca cada 60s. Al abrir: marca leídas + pide permiso `Notification` del navegador + suscribe a Web Push (`ensurePushSubscription` de `lib/push/client.ts`). Click en una noti con `href` → `router.push`. X individual o "Limpiar" → marca `dismissed`
- **Notificaciones del navegador** (foreground): si hay permiso, dispara `new Notification()` para notis nuevas no leídas al refrescar.
- **Web Push en background (PWA cerrada)**: stack completo implementado.
  - `public/sw.js` — service worker con handlers `push` + `notificationclick` (navega al `href` de la noti).
  - `lib/push/client.ts` — `ensurePushSubscription()`: registra el SW, suscribe al PushManager con la VAPID public key, hace POST a `/api/push/subscribe`.
  - `app/api/push/subscribe/route.ts` — upsert en `push_subscriptions` (tabla: `endpoint` PK, `p256dh`, `auth`, `user_agent`).
  - `lib/push/send.ts` — `pushToAll(payload)`: usa `web-push` con service role, itera subs, purga las muertas (410/404).
  - `app/api/cron/radar/route.ts` — cron de Shadow proactivo (13:00 UTC = 7am CDMX): corre `buildBriefRadar` + `buildDayPlan` + `buildCrossInsights` y crea `notifications` para los ítems urgentes del radar y los insights en tono rojo. Deduplicado por título en las últimas 18h. El cron `notify` las empuja después.
  - `app/api/cron/notify/route.ts` — cron que busca `notifications` con `pushed=false` y las empuja vía `pushToAll`, luego marca `pushed=true`. Corre en Vercel a las 16:00 UTC (10am CDMX).
  - Migraciones: `supabase/push.sql` (tabla `push_subscriptions` + columna `notifications.pushed`).
  - **Env vars requeridas**: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`.
- **Escaneo de calendario** (client): `NotifCenter` consulta `/api/calendar?days=1` y crea una noti `warning` por cada evento con hora que empieza en ≤60 min. Dedupe en `localStorage` (key `valleos-notified-events`, scoping por día).
- **Recordatorios académicos** (client): `NotifCenter.scanAcademia` consulta `assignments` (entregas ≤2 días) y `grade_components` de tipo examen (≤3 días) sin terminar y crea notis (severidad `error` el día 0/1). Dedupe en `localStorage` key `valleos-notified-academia`. Las notis enlazan a `/panamericana`.
- **Shadow empuja notis**: tool `crear_notificacion` → inserta en la tabla. El cron `notify` la empuja al dispositivo. El cron `radar` (7am CDMX) crea notis proactivas automáticamente con el radar + insights del día; el cron `notify` (10am CDMX) las empuja al dispositivo.

---

## Páginas — server shell + islas cliente
Patrón: la página es **server component** (SSR, carga datos) y las acciones interactivas son **islas cliente** (`"use client"`) que escriben a Supabase y llaman `router.refresh()`. Ejemplos de islas: `finanzas/AddEntry`+`AddAccount`+`AddCard`, `flouvia/AddClient`, `metas/AddGoal`+`GoalCard`+`GoalManage`, `salud/LogWeight`+`LogHealth`+`SaludCharts`+`Analysis`, `lectura/AddReading`+`BookCard`+`ContentCard`+`EditReading`, `tiempo/LogTime`, `panamericana/AddCourse`+`AddComponent`+`AddAssignment`+`AddClass`.

| Server (con islas cliente) | Client components completos |
|---|---|
| finanzas, metas, salud, lectura, tiempo, centro, brief (`BriefClient`) | shadow, habitos, brain, paginas, config, calendario, gym (`GymClient`), panamericana (`PanamericanaClient` + islas `AddCourse`/`AddComponent`/`AddAssignment`/`AddClass`), flouvia (`FlouviaClient` + islas `AddClient`/`Analysis`) |

**Qué guarda cada página** (todo persiste a Supabase):
- **Brief**: command center del día — prioridades (check/agregar/borrar), intención editable, hábitos, brief de Shadow, finanzas del mes. Layout: franja **"Shadow detecta"** (insights cruzados, condicional) → radar **"Atender hoy"** → cuerpo 2-col con **"Plan de hoy"** timeline en col derecha (**ya no hay fetch cliente de /api/calendar**). Helpers: `lib/brief/today.ts` — `buildBriefRadar()` devuelve `{items: RadarItem[], tiempoHoy, libro}`; item de Gym usa `gymToday()` (horario real `workout_schedule`, fallback ciclo). `lib/brief/plan.ts` — `buildDayPlan(supabase, today)` fusiona clases (`class_schedule`), gym (`gymToday()` — fuente única de verdad del "hoy toca"), bloques de estudio (exámenes con `study_start_date ≤ today`), entregas (`due_date=today`) y eventos de Google Calendar del día (fetch server-side); devuelve `{items: PlanItem[], text}`; exporta `gymToday(supabase, weekday)` reutilizado por el radar. `lib/brief/insights.ts` — `buildCrossInsights(supabase, today, plan)` detecta tensiones cruzadas: examen apremiante + gym mismo día, meta atrasada + hábito vinculado, cluster de pagos ≥2 en 6d, día cargado ≥4 compromisos; devuelve `CrossInsight[]` (máx 3). `app/api/shadow/brief/route.ts` — recibe plan+radar+insights (ya no construye agenda por separado) y el prompt pide cerrar con **"Primero:"** + acción de mayor palanca. Tarjetas extra: **Tiempo · hoy** y **Leyendo**
- **Centro**: cockpit de 11 tarjetas en grid (2-col, 3 en md) — todas con datos reales. Tarjetas: Hábitos (anillo de progreso SVG `<Ring>`), Calendario, Gym (hoy toca = siguiente día del ciclo), Panamericana (GPA + examen en Nd), Salud (peso actual + mini-sparkline SVG de 90d `<Sparkline>`), Tiempo (horas hoy con `fmtHours`), Finanzas (saldo), Metas (activas), Flouvia (MRR), Lectura (título en progreso), Brain (notas). Componentes `Ring` y `Sparkline` son SVG inline definidos en el mismo archivo
- **Hábitos v2**: tracker diario con check-off satisfactorio (anillo de progreso), calendario heatmap mensual (perfecto/parcial/fallado), stats de racha actual/mejor/% del mes/días perfectos, y strip de 30 días por hábito. Permite backfill clickeando días pasados del calendario
- **Finanzas**: dashboard de dinero — agregar cuentas/tarjetas/movimientos, gráficas (distribución + tendencia), próximos pagos, análisis de Shadow (ver sección Finanzas arriba)
- **Flouvia**: dashboard de negocio interactivo — KPIs + gráfica de ingresos de 6 meses, análisis de Shadow, kanban de clientes y proyectos editables inline, follow-ups (ver sección Flouvia arriba)
- **Metas**: dashboard de objetivos — progreso visual con marcador de ritmo (a tiempo/atrasado vs. fecha), hitos con fecha en línea de tiempo, motor de hábitos que sostienen cada meta, todo conectado a Shadow (ver sección Metas arriba)
- **Tiempo**: dashboard de analytics — heatmap 13w, barras semanales 10w, donut por categoría, tiempo por cliente Flouvia, ritmo del día, racha activa (ver sección Tiempo arriba)
- **Salud**: dashboard de bienestar — peso como serie propia (`weight_logs`, último = actual), registro diario de sueño/ánimo/energía/pasos, KPIs con delta vs. semana previa, gráficas (peso/sueño/ánimo-energía), correlaciones + deuda de sueño, heatmap de sueño, análisis de Shadow e ingesta de Apple Salud vía `app/api/health/ingest` (ver sección Salud arriba)
- **Lectura**: libros con portada CSS + progreso de páginas inline (`BookCard`); artículos/videos/podcasts como cards compactas (`ContentCard`); editar y archivar desde `EditReading` (ver sección Lectura arriba)
- **Gym**: dashboard interactivo de entrenamiento (ver sección Gym arriba)
- **Panamericana**: dashboard académico interactivo — esquema de calificación por materia, calificar parciales inline, faltas, exámenes por dificultad + cuándo estudiar, horario y proyección de Shadow (ver sección Academia arriba)

El **ticker** del topbar (en `Topbar.tsx`) fetcha al montar: MRR (`flouvia_clients.monthly_value` activos), hábitos del día, racha 7d, GPA (`academic_courses.grade`), sesiones de gym de la semana (`workout_sessions`). CDMX es placeholder estático.

### Patrón loading.tsx
Las rutas SSR con `revalidate = 0` tienen un `loading.tsx` que Next muestra automáticamente vía Suspense mientras cargan los datos. Usan `<DashboardSkeleton>` de `components/Skeleton.tsx` con props afinadas por página (`hero` para páginas con strip destacado, `kpis` para el número de KPIs). Rutas cubiertas: finanzas, salud, tiempo, gym, panamericana, metas, flouvia, brief, lectura, centro.

---

## Convenciones de código
- Sin comentarios salvo que el WHY sea no obvio
- Sin imports innecesarios
- Server components para datos estáticos/SSR; client components para interactividad
- Estilos: mezcla de clases CSS globales (`.card`, `.eyebrow`, `.btn-*`) e inline styles — preferir clases globales cuando existen
- No usar `className` de Tailwind directamente si ya existe una clase CSS equivalente en `globals.css`
