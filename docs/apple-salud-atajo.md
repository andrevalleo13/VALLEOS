# Atajo de Apple Salud → Valle OS

La PWA no puede leer HealthKit directo. Un **Atajo** (app Shortcuts) lee Salud/Fitness y hace `POST` a `/api/health/ingest`. Hace upsert por fecha en `health_entries` (sueño, pasos, FC reposo, calorías activas, agua, minutos de ejercicio) y `weight_kg`/`body_fat_pct`/`muscle_kg` en `weight_logs`. `source: "apple_health"`.

## 1. Antes de empezar (servidor)

Define el secreto en el entorno donde corre la app (Vercel → Settings → Environment Variables, o `.env.local` en dev):

```
HEALTH_INGEST_SECRET=<una cadena larga y aleatoria>
```

Sin esta variable el endpoint responde 500. Genera una con: `openssl rand -hex 32`.

La URL destino es `https://<tu-dominio>/api/health/ingest` (en producción) o `http://<ip-local>:3000/api/health/ingest` para probar en la misma red.

## 2. Crear el Atajo en el iPhone

App **Atajos** → `+` → agrega estas acciones en orden:

1. **Obtener muestras de salud** (una por métrica que quieras). Para cada una:
   - *Tipo de muestra*: Pasos / Energía activa / Frecuencia cardiaca en reposo / Análisis del sueño / Peso corporal / Porcentaje de grasa corporal, etc.
   - *Ordenar por*: Fecha de inicio (descendente). *Límite*: 1 (la más reciente del día).
   - Guarda cada valor en una **Variable** (renómbrala: `pasos`, `pesoKg`, `sueñoHrs`…).
   > El sueño viene en minutos/segmentos: divide entre 60 con una acción **Calcular** para obtener horas.

2. **Texto** → pega este JSON, sustituyendo cada valor por su Variable (toca para insertar la magic variable). Incluye **solo** los campos que recolectaste:

   ```json
   {
     "date": "FECHA_HOY",
     "sleep_hours": SUEÑO_HRS,
     "steps": PASOS,
     "resting_hr": FC_REPOSO,
     "active_calories": CALORIAS,
     "weight_kg": PESO_KG,
     "body_fat_pct": GRASA_PCT
   }
   ```
   - `date` es opcional; si lo omites usa hoy (zona `America/Mexico_City`). Para `FECHA_HOY` usa **Formato de fecha** → `yyyy-MM-dd`.
   - Campos reconocidos: `date, sleep_hours, sleep_quality, steps, resting_hr, active_calories, bedtime, wake_time, water_l, workout_minutes, workout_type, mood, energy, weight_kg, body_fat_pct, muscle_kg`.

3. **Obtener contenido de URL**:
   - *URL*: `https://<tu-dominio>/api/health/ingest`
   - *Método*: **POST**
   - *Encabezados*: `Authorization` = `Bearer <HEALTH_INGEST_SECRET>`
   - *Cuerpo de la solicitud*: **JSON** → o pega el Texto del paso 2 como cuerpo (tipo "Archivo"/texto). Lo más simple: *Cuerpo* = JSON y dentro pega la magic variable del Texto.

4. (Opcional) **Mostrar notificación** con el resultado para confirmar (`ok: true, written: [...]`).

## 3. Automatizar

Atajos → pestaña **Automatización** → `+` → **Hora del día** (ej. 23:30) → ejecuta este Atajo → **Ejecutar inmediatamente** (sin preguntar). Así sube el resumen del día cada noche sin tocar nada.

## 4. Probar

Corre el Atajo a mano. Respuesta esperada:

```json
{ "ok": true, "date": "2026-05-26", "written": ["día (steps, sleep_hours)", "peso 72.3kg"] }
```

Errores: `401` → token mal; `500` → falta `HEALTH_INGEST_SECRET`; `400` → JSON inválido o sin datos reconocibles.
