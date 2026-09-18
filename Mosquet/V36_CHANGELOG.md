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


## V36.4 — Flujo de producción y claridad operacional
- Mantiene el switch de estados V36.3 como control principal.
- Mejora el módulo **Carga de trabajo actual** con resumen de tareas activas y detección visible de solicitudes sin asignar.
- Las barras se documentan explícitamente como distribución relativa, no como capacidad laboral.
- El filtrado por responsable desde la carga deja visible el filtro aplicado.
- Los filtros avanzados incorporan una separación visual entre “Estado y asignación” y “Detalle y orden”.
- La vista “Solicitudes realizadas” se renombra a **Archivo de entregas**.


## V36.5 — Atajos de filtrado consistentes
- Se centralizó el reseteo de filtros de Gestión para evitar combinaciones accidentales entre accesos rápidos y filtros avanzados.
- Los KPI y filtros rápidos ahora aplican su contexto de forma limpia.
- Carga de trabajo filtra por responsable sin conservar filtros incompatibles previos.
- Mis tareas lleva primero al contexto "Mis tareas" y después enfoca la solicitud.
- Limpiar filtros sincroniza los componentes select personalizados.
- **SQL: no requerido.** No se modificó `SUPABASE_V36_FINAL.sql`.


## V36.6 — Pulido final de la pantalla principal
- Switch de estados conservado y con ancho equilibrado.
- Ajuste solicitado / Entregada con acciones verticales.
- Más espacio para Acciones.
- KPI de atención con señal visual cuando tienen contenido.
- `No asignado` priorizado visualmente en Carga de trabajo.
- Sin cambios en Supabase ni SQL.


## V36.7 — Saneamiento funcional y UX
- Los eventos de ciclo de vida quedan pendientes hasta que el guardado de la tarea se confirma correctamente.
- Archivo de entregas se limita a solicitudes con estado `Entregado`; las reabiertas regresan a Gestión.
- Mis tareas usa “Rec.” y “Límite” para distinguir fechas.
- Se refuerza la disposición y legibilidad del switch en escritorio y móvil.
- **SQL: no requerido.**


## V36.8 — Selectores del formulario de nueva solicitud
- Los selectores personalizados de Solicitud y Asignación se renderizan como menús portaled al `body`, evitando recortes por modales/overflow.
- Los menús se reconstruyen al abrir Nueva solicitud para mantener sincronizadas las opciones de solicitantes y colaboradores.
- No requiere cambios SQL.


## V36.9 — Núcleo y guardado

- Concurrencia optimista centralizada en `DataService.saveTasks()`; se elimina la comprobación preventiva duplicada.
- Los errores de lectura de tareas ya no se convierten silenciosamente en una lista vacía.
- Guardado con feedback claro y recuperación segura del botón.
- Sincronización posterior al guardado tolera un fallo de refresco sin presentar un guardado exitoso como fallido.
- Selectores personalizados reconstruidos como un conjunto global para evitar wrappers anidados y menús desconectados en Nueva solicitud y edición.
- No se realizaron cambios SQL.


## V37 — Autosave y sincronización
- Se reemplaza el guardado manual de cambios de solicitudes por guardado automático con una pausa breve después de cada modificación.
- El indicador inferior comunica `Guardando…`, `Guardado`, `No se pudo sincronizar` o conflicto remoto sin interrumpir el flujo.
- Se conserva `Deshacer` a nivel de último estado sincronizado mediante la API interna, sin botón permanente de “Guardar cambios”.
- La concurrencia continúa protegida por `version` cuando el esquema moderno está disponible.
- Los errores de Supabase no se convierten en listas vacías ni se presentan como guardados exitosos.
- La versión es compatible con el esquema actual de `tasks` sin requerir una migración SQL para el autosave básico. Las columnas modernas se usan únicamente cuando ya existen en la instalación.
- No se modifica ni se requiere ejecutar `SUPABASE_V36_FINAL.sql` para esta migración específica.


## V37.2 — Consolidación UX/UI

- Cards de notificaciones con mayor margen interno y cierres rediseñados.
- Modales con mejor espaciado, jerarquía y controles de cierre.
- Autosave mostrado como indicador compacto en lugar de barra de acción.
- Tabla con más aire en Estado y Acciones.
- Sidebar: Trabajo activo.
- Responsive refinado.
- Sin cambios de SQL.
