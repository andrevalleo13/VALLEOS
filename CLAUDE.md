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
| `components/shell/CmdK.tsx` | Paleta de comandos (⌘K) — usa `cmdk` |
| `components/shell/CaptureModal.tsx` | Modal de captura rápida (⌘J) |
| `components/shell/CierreFlow.tsx` | Flujo de cierre nocturno (⌘.) |
| `components/shell/AjustesDrawer.tsx` | Drawer de ajustes — temas base, personalización de colores (acento/fondo/texto), fuente, bordes. Incluye sección "Memoria de Claude" con botón de sync |
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
- `.ac-*` — dashboard de Academia (`PanamericanaClient.tsx`): card de materia expandible, esquema de calificación con barra de peso + input inline, badges de dificultad, stepper de faltas, grid de horario semanal
- `.seg` / `.seg-btn` — control segmentado (toggle Semana/Mes)
- `.modal-card-wide` — modal ancho (720px); `Modal` acepta prop `wide`. `.modal-body` ahora hace scroll (max-height 80vh)

### Color picker reutilizable
`components/ColorPicker.tsx` — chips de presets (10 colores) + botón `+` con `<input type="color">` nativo para color libre. Props: `value: string`, `onChange: (hex) => void`, `presets?: string[]`, `size?: number`. Usar en cualquier lugar donde el usuario elija color hex.

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
  - **Estado/notas**: `consultar_estado` (prioridades, hábitos, finanzas, gym, próximo examen y agenda 48h), `crear_nota`, `recordar` (memoria persistente)
  - **Prioridades/hábitos**: `agregar_prioridad`, `completar_prioridad`, `crear_habito`, `completar_habito`
  - **Finanzas**: `consultar_finanzas`, `registrar_finanza` (auto-categoriza)
  - **Gym**: `consultar_rutina`, `registrar_entrenamiento`
  - **Academia (Panamericana)**: `consultar_academia`, `agregar_componente`, `calificar_componente`, `registrar_falta`
  - **Calendario**: `crear_evento`, `consultar_eventos`, `editar_evento`, `eliminar_evento`
  - **Notificaciones**: `crear_notificacion` (empuja a la campana / centro de notificaciones)
- **Memoria**: tabla `shadow_memory` → se inyecta en system prompt como `## Memoria persistente`. El tool `recordar` escribe aquí
- **Mensajes guardados**: `shadow_messages.parts` = `[{text}, {tool}...]` (texto + resúmenes de acciones). El cliente parsea NDJSON y reconstruye texto + chips al recargar
- **Brief del día**: `app/api/shadow/brief/route.ts` (POST) — genera el brief analizando datos del día, lo cachea en `shadow_cache` key `brief:{YYYY-MM-DD}`. Se dispara desde el botón en Brief
- **Proyección académica**: `app/api/shadow/academia/route.ts` (POST) — analiza materias/calificaciones/exámenes/faltas y genera panorama + materias en riesgo + plan de exámenes + foco. Cachea en `shadow_cache` key `academia:{YYYY-MM-DD}`. Se dispara desde el botón en Panamericana
- **Análisis financiero**: `app/api/shadow/finanzas/route.ts` (POST) — analiza patrimonio, distribución del gasto, tendencia vs. mes previo y próximos pagos; devuelve 3 bloques (**Lectura** · **En qué se va el dinero** · **Movimientos**). Cachea en `shadow_cache` key `finanzas:{YYYY-MM}`. Se dispara desde el botón en Finanzas
- **Análisis de negocio (Flouvia)**: `app/api/shadow/flouvia/route.ts` (POST) — analiza pipeline, MRR, conversión propuesta→activo, proyectos activos e ingresos de 6 meses; devuelve 3 bloques (**Lectura** · **Oportunidades** [upsell/cowork/sinergias] · **Movimientos**). Cachea en `shadow_cache` key `flouvia:{YYYY-MM}`. Se dispara desde el botón en Flouvia

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
| `goals_flouvia.md` | Metas con progreso %, hitos, clientes Flouvia con MRR y proyectos |
| `academia_data.md` | Materias activas, calificaciones, componentes, próximos exámenes con días restantes |
| `gym_data.md` | Rutina Upper/Lower, ejercicios por día, sesiones recientes, PRs (90d) |
| `finance_data.md` | Patrimonio neto, cuentas, tarjetas, inversiones, gastos del mes, distribución 30d |
| `shadow_memory.md` | Hechos persistentes de `shadow_memory` (si existen), agrupados por categoría |

`MEMORY.md` se actualiza automáticamente con links a los archivos nuevos. Cálculos: streak cuenta hacia atrás desde hoy sobre días scheduled; PRs filtran `weight != null && weight > 0`.

---

## Finanzas — Dinero (módulo 03)
- **Ruta**: `app/(os)/finanzas/page.tsx` (server: carga cuentas/tarjetas/inversiones/cargos recurrentes + movimientos de los últimos 6 meses + análisis cacheado) → todo se computa server-side y la interactividad son islas
- **Modelo de datos**: `financial_entries` (movimiento: `category` enum de 5 [flouvia_ingreso/gasto_personal/gasto_flouvia/ahorro/inversion], `amount`, `subcategory` = bucket canónico, `card_id`/`account_id` para vincular tarjeta o cuenta de débito, `payment_method`) · `bank_accounts` (cuentas débito/efectivo/digital) · `credit_cards` (`credit_limit`, `current_balance`, `statement_balance` = saldo al corte a pagar, `statement_day` corte, `due_day` pago, `apr`) · `investments` · `capital_goals` · `recurring_charges` (cargos fijos con `charge_day`) · `budgets` (presupuestos por categoría, aún sin UI)
- **Taxonomía de gasto**: `lib/finance/categories.ts` — buckets canónicos (`escuela`, `comida`, `salidas`, `transporte`, `suscripciones`, `salud`, `hogar`, `compras`, `servicios`, `ahorro`, `inversion`, `flouvia`, `ingreso`, `otros`) cada uno con color + ícono. `normalizeBucket()` (sinónimos, estilo `muscles.ts`), `entryBucket()` (unifica category+subcategory → bucket para la distribución), `bucketLabel/Color/Icon`
- **Próximos pagos**: `lib/finance/payments.ts` — `buildUpcomingPayments(cards, recurring)` calcula la próxima fecha de cada `due_day`/`charge_day` (`nextOccurrenceOfDay`, clamp al fin de mes), el monto (tarjeta: `statement_balance ?? current_balance`) y los días que faltan, ordenado. Compartido por la página y Shadow
- **Dashboard**: header con 3 botones (`AddAccount` · `AddCard` · `AddEntry`) · patrimonio neto · KPIs (saldo, ingresos, gastos, balance del mes) · panel **análisis de Shadow** (`Analysis.tsx`) · **gráficas** (`FinanceCharts.tsx`, client): donut SVG de distribución del gasto con leyenda interactiva + barras ingresos/gastos de 6 meses · **próximos pagos** (tarjetas + recurrentes, resalta ≤3 días) · cuentas · tarjetas (con día de corte/pago + barra de uso) · metas de capital · últimos movimientos (con bucket + método)
- **Islas**: `AddEntry.tsx` (movimiento con categoría → si es gasto, chips de subcategoría/bucket + método de pago + cuenta/tarjeta), `AddAccount.tsx` (cuenta de débito/efectivo), `AddCard.tsx` (tarjeta con corte/pago/límite). Las gráficas son SVG a mano (sin librería), igual que el gym
- **Conexión con Shadow**: tools `consultar_finanzas` (patrimonio, distribución, próximos pagos) y `registrar_finanza` (Shadow **auto-categoriza**: elige categoría + subcategoría canónica). `consultar_estado` incluye el próximo pago a ≤10 días. Clases CSS: `.fin-*` (charts, donut, leyenda, barras, filas de pago, chips de bucket, análisis)

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
- **Ruta**: `app/(os)/panamericana/page.tsx` (server: carga materias activas + `grade_components` + entregas pendientes + `class_schedule` + análisis cacheado) → `PanamericanaClient.tsx` (dashboard cliente que computa todo y persiste vía islas)
- **Modelo de datos**: `academic_courses` (materia, `target_grade`, `color`, `absences`/`max_absences` para faltas) → `grade_components` (el esquema de calificación: cada componente del 100% con `kind` examen/tarea/proyecto/participacion/otro, `weight`, `grade` 0-10, `date`; los exámenes llevan `difficulty` 1-5, `study_start_date` y `topics`). `class_schedule` (horario: `day_of_week` 0-6, `start_time`/`end_time`, `room`). `assignments` sigue siendo el tracker de entregas/tareas con fecha
- **Cálculo** (`lib/academia/grades.ts`): `computeCourseGrades()` (promedio ponderado → actual/proyectada, peso calificado/restante), `neededForTarget()` (qué promedio necesita en lo que falta para su meta), `suggestStudyStart()` (fecha − días según dificultad: 1→2d … 5→18d), `studyState()` (urgent/study-now/soon/later), `absenceRisk()` (safe/warn/danger vs. límite). Al calificar un componente se recalcula y persiste `academic_courses.grade` para que GPA y ticker queden consistentes
- **Dashboard** (`PanamericanaClient`): KPIs (GPA proyectado, materias, créditos, exámenes próximos, faltas en riesgo) · panel de **proyección de Shadow** · lista de exámenes próximos (color por dificultad + "estudia ya"/cuántos días) · horario semanal en grid · entregas pendientes · cards de materia expandibles con esquema de calificación (barras de peso + input inline de calificación), "necesitas X en el Y% restante", stepper de faltas con riesgo, y su horario
- **Islas**: `AddCourse` (con faltas permitidas), `AddComponent` (examen/componente con dificultad + sugerencia de cuándo estudiar), `AddAssignment`, `AddClass` (horario). Calificar/borrar componentes y ajustar faltas es inline en `PanamericanaClient`
- **Conexión con Shadow**: tools `consultar_academia`, `agregar_componente`, `calificar_componente`, `registrar_falta`; `consultar_estado` incluye el próximo examen. Shadow consulta, registra exámenes/notas/faltas y proyecta el semestre — André edita el detalle en la app

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

## Lectura — Lista de lectura (módulo 12)
- **Ruta**: `app/(os)/lectura/page.tsx` (server: carga `reading_items` excluyendo archivados) — libros y contenido se separan dentro de cada sección (Leyendo / Por leer / Completados)
- **Modelo de datos**: `reading_items` — `type` (`article`|`video`|`podcast`|`paper`|`book`|`other`), `status` (`pending`|`reading`|`done`|`archived`), `title`, `url`, `source` (autor), `summary`, `notes`, `estimated_minutes` (para no-libros), `cover_url` (URL imagen portada, libros), `total_pages` / `current_page` (progreso, libros), `completed_at`. Migración aditiva: `supabase/lectura.sql`
- **Dos tipos de card** (client components, cada uno maneja su estado y edición):
  - `BookCard.tsx` — tarjeta horizontal con portada CSS (color determinista por título o imagen si hay `cover_url`; efecto spine con sombra inset). Barra de progreso + input de página actual editable inline (actualiza `current_page` en Supabase al `onBlur`). Botones: ciclar estado · Editar · Ver (si hay URL)
  - `ContentCard.tsx` — tarjeta compacta con ícono de tipo coloreado por variante (azul artículo, rojo video, violeta podcast). Ciclar estado inline + botón de editar con ícono
- **Islas**: `AddReading.tsx` (modal agregar — campos dinámicos: libros muestran `cover_url`+`total_pages`, contenido muestra `estimated_minutes`), `EditReading.tsx` (modal editar todo + archivar; campos dinámicos igual que Add), `BookCard.tsx`, `ContentCard.tsx`
- **Clases CSS**: `.rd-book-card`, `.rd-cover`, `.rd-cover-initial`, `.rd-book-info`, `.rd-book-title`, `.rd-book-author`, `.rd-book-summary`, `.rd-progress-wrap`, `.rd-progress-bar`, `.rd-progress-fill`, `.rd-progress-meta`, `.rd-page-input`, `.rd-book-actions`, `.rd-content-card`, `.rd-content-type`, `.rd-content-info`, `.rd-content-header`, `.rd-content-title`, `.rd-content-actions`, `.rd-content-meta`, `.rd-content-summary`, `.rd-icon-btn`

---

## Supabase — Tipos
Archivo: `lib/supabase/types.ts`

**CRÍTICO**: Toda tabla debe incluir `Relationships: []` o las queries retornan `never` en TypeScript (bug de supabase-js v2.106+).

Para joins anidados con `.select("*, otra_tabla(campo)")`, usar cast doble:
```ts
const data = result.data as unknown as MiTipo[];
```

Tablas principales: `user_preferences`, `habits`, `habit_completions`, `financial_entries`, `bank_accounts`, `credit_cards`, `investments`, `flouvia_clients`, `flouvia_projects`, `shadow_conversations`, `shadow_messages`, `shadow_memory`, `shadow_cache`, `notifications`, `brain_notes`, `goals`, `goal_milestones`, `capital_goals`, `health_entries`, `reading_items`, `custom_pages`, `time_logs`, `academic_courses` (incluye `absences`/`max_absences`), `grade_components`, `class_schedule`, `assignments`, `semesters`, `priorities`, `daily_notes`, `workout_routines`, `workout_days`, `workout_exercises`, `workout_sessions`, `workout_sets`.

Schema completo en `supabase/schema.sql` — correr en Supabase SQL Editor para crear/recrear tablas. Migraciones aditivas (sin borrar datos): `supabase/gym.sql`, `supabase/academia.sql` (faltas + `grade_components`), `supabase/finanzas.sql` (`financial_entries.account_id` + `credit_cards.statement_balance` + índices), `supabase/lectura.sql` (`reading_items.cover_url` + `total_pages` + `current_page`).

---

## Calendario — Google Calendar bidireccional (módulo 05)
- **API route**: `app/api/calendar/route.ts` — CRUD completo contra `calendarId: "primary"`:
  - `GET ?days=N` → lista eventos (incluye `id`, `description`, `allDay`, `location`, `color`/colorId, `htmlLink`)
  - `POST` → crea evento `{title, start, end?, description?, location?, color?, allDay?}`
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
- **Tabla**: `notifications` (ya existía en `schema.sql`, antes sin uso): `{ title, body, severity('info'|'warning'|'error'|'success'), module, href, read, dismissed, created_at }`
- **`components/shell/NotifCenter.tsx`** (client, vive en el Topbar): campana con badge de no-leídas + panel dropdown (`.notif-*`). Lee `notifications` (no descartadas) vía Supabase client, refresca cada 60s. Al abrir: marca leídas + pide permiso de `Notification` del navegador. Click en una noti con `href` → `router.push`. X individual o "Limpiar" → marca `dismissed`
- **Notificaciones del navegador**: si hay permiso concedido, dispara `new Notification()` para las notis nuevas no leídas que aparecen tras el primer load (foreground). Push real en background (PWA cerrada) requeriría service worker + VAPID + cron — pendiente
- **Escaneo de calendario**: `NotifCenter` consulta `/api/calendar?days=1` y crea una noti `warning` por cada evento con hora que empieza en ≤60 min. Dedupe en `localStorage` (key `valleos-notified-events`, scoping por día)
- **Shadow empuja notis**: tool `crear_notificacion` → inserta en la tabla; aparece en la campana en el siguiente refresh. El system prompt le indica avisar de lo urgente con severidad `warning` y enlace `/calendario`

---

## Páginas — server shell + islas cliente
Patrón: la página es **server component** (SSR, carga datos) y las acciones interactivas son **islas cliente** (`"use client"`) que escriben a Supabase y llaman `router.refresh()`. Ejemplos de islas: `finanzas/AddEntry`+`AddAccount`+`AddCard`, `flouvia/AddClient`, `metas/AddGoal`+`GoalProgress`, `salud/LogHealth`, `lectura/AddReading`+`BookCard`+`ContentCard`+`EditReading`, `tiempo/LogTime`, `panamericana/AddCourse`+`AddComponent`+`AddAssignment`+`AddClass`.

| Server (con islas cliente) | Client components completos |
|---|---|
| finanzas, metas, salud, lectura, tiempo, centro | brief (`BriefClient`), shadow, habitos, brain, paginas, config, calendario, gym (`GymClient`), panamericana (`PanamericanaClient` + islas `AddCourse`/`AddComponent`/`AddAssignment`/`AddClass`), flouvia (`FlouviaClient` + islas `AddClient`/`Analysis`) |

**Qué guarda cada página** (todo persiste a Supabase):
- **Brief**: prioridades (check/agregar/borrar), intención editable, toggle de hábitos, brief generado por Shadow, agenda del día
- **Hábitos v2**: tracker diario con check-off satisfactorio (anillo de progreso), calendario heatmap mensual (perfecto/parcial/fallado), stats de racha actual/mejor/% del mes/días perfectos, y strip de 30 días por hábito. Permite backfill clickeando días pasados del calendario
- **Finanzas**: dashboard de dinero — agregar cuentas/tarjetas/movimientos, gráficas (distribución + tendencia), próximos pagos, análisis de Shadow (ver sección Finanzas arriba)
- **Flouvia**: dashboard de negocio interactivo — KPIs + gráfica de ingresos de 6 meses, análisis de Shadow, kanban de clientes y proyectos editables inline, follow-ups (ver sección Flouvia arriba)
- **Metas/Salud/Tiempo**: crear registros + acciones (progreso de metas)
- **Lectura**: libros con portada CSS + progreso de páginas inline (`BookCard`); artículos/videos/podcasts como cards compactas (`ContentCard`); editar y archivar desde `EditReading` (ver sección Lectura arriba)
- **Gym**: dashboard interactivo de entrenamiento (ver sección Gym arriba)
- **Panamericana**: dashboard académico interactivo — esquema de calificación por materia, calificar parciales inline, faltas, exámenes por dificultad + cuándo estudiar, horario y proyección de Shadow (ver sección Academia arriba)

El **ticker** del topbar (en `Topbar.tsx`) fetcha al montar: MRR (`flouvia_clients.monthly_value` activos), hábitos del día, racha 7d, GPA (`academic_courses.grade`), sesiones de gym de la semana (`workout_sessions`). CDMX es placeholder estático.

---

## Convenciones de código
- Sin comentarios salvo que el WHY sea no obvio
- Sin imports innecesarios
- Server components para datos estáticos/SSR; client components para interactividad
- Estilos: mezcla de clases CSS globales (`.card`, `.eyebrow`, `.btn-*`) e inline styles — preferir clases globales cuando existen
- No usar `className` de Tailwind directamente si ya existe una clase CSS equivalente en `globals.css`
