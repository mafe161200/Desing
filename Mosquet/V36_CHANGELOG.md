# Design Hub V36 — Stabilization

## Cambios de esta entrega

- Se conserva la base funcional V36 actual sin reconstruir el proyecto desde versiones anteriores.
- Se elimina del paquete el catálogo local `users.js` con credenciales de demostración; la autenticación vigente usa Supabase Auth + `public.profiles`.
- Se consolidan las migraciones V34/V35 en `SUPABASE_V36_FINAL.sql`.
- La restauración de historial usa concurrencia optimista cuando la tarea tiene `version`.
- La restauración pasa la versión actual de la tarea como `expectedVersion`, evitando restauraciones que sobrescriban cambios posteriores.
- Se mantiene `task_change_history` porque el frontend actual lo utiliza.
- Se mantienen `task_events` y `task_adjustments` como entidades de auditoría/ciclo de vida.
- Se conservan los estados y transiciones centralizados del frontend.
- Se mantienen las mejoras actuales de accesibilidad y foco de modales.
- Se añade una prueba de humo con Node.js para detectar regresiones estructurales del paquete.

## Archivos retirados

- `SUPABASE_V34_MIGRATION.sql`
- `SUPABASE_V35_MIGRATION.sql`
- `V35_CHANGELOG.md`
- `supabase.sql`
- `users.js`
- `desktop.ini`

## Nota de producción

La autorización definitiva debe estar en Supabase/RLS. Esta entrega no crea policies genéricas que puedan conceder permisos incorrectos en una instancia real.


## V36.1 — Consolidación UX/UI

- Selector único de estado por solicitud con transiciones existentes.
- Menú contextual para editar/eliminar y acciones frecuentes visibles.
- Filtros rápidos principales simplificados y secundarios agrupados.
- “No asignado” conservado como filtro accionable desde Carga de Trabajo.
- Semántica visual de fechas: Recibida / Fecha límite / Entregada.
- Separación de `due_at` y `delivered_at` cuando están disponibles.


## V36.2 — Switch de estado y reapertura segura

### UX/UI
- Restaurado el control de estado tipo switch/segmentado en la tabla.
- Se eliminó el desplegable de estado de las filas para reducir pasos y mejorar la lectura rápida.
- El switch usa acciones contextuales según el estado actual y conserva iconos, color y foco visible.

### Flujo de producción
- `Entregado` ahora permite `Devolver a gestión` mediante confirmación.
- La reapertura lleva la tarea a `En curso`, conserva `due_at`/fecha límite y elimina `delivered_at`.
- La entrega anterior no se borra del historial: el trigger de `task_change_history` registra el UPDATE y el cambio de estado.

### Robustez
- Se corrigió el guardado de valores `null` en campos opcionales para que `delivered_at` pueda limpiarse sin convertirlo en una cadena vacía.
- Se corrigió la llamada de confirmación de entrega para usar el método de estado centralizado de `App`.


## V36.3 — Flujo de producción y pulido operativo

### UX/UI
- Se conserva el switch contextual como interacción principal de estados.
- `Ajuste solicitado` y `Entregado` pasan a disposición vertical para evitar que las acciones se monten entre sí.
- En móvil las etiquetas de estado permanecen visibles.
- Se elimina la fecha duplicada del control de fechas del tablero.
- La acción de reapertura se presenta visualmente como **Reabrir**; el modal conserva la explicación completa de devolver la solicitud a gestión.

### Funcionalidad
- Corregidas las transiciones de ajuste para utilizar `this.setTaskStatus(...)`.
- Reapertura conserva la fecha límite y limpia `delivered_at`.
- Historial de entregas usa la fecha real `delivered_at` cuando está disponible.
- Concurrencia optimista incorpora `due_at` y `delivered_at` en la comparación previa al guardado.
- Los eventos de ciclo de vida se envían de forma best-effort a `task_events`.
- El guardado muestra estado `Guardando…` y bloquea doble envío.

### Validación
- Se mantiene la base V36.2 como único punto de partida.
- Se añade una prueba de regresión para el flujo de ajustes y la semántica de fechas.
