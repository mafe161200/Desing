
## V36.1 — Consolidación UX/UI

- Se mantiene V36 como base única; no se reconstruye desde versiones anteriores.
- El estado de cada solicitud se presenta como un único selector contextual, en lugar de varios botones pequeños.
- Editar y eliminar pasan a un menú de “Más acciones”; notas e historial permanecen accesibles en la fila.
- Los filtros rápidos visibles se reducen a Todas, Mis tareas, Prioridad y Vencidas; filtros secundarios pasan a “Más filtros”.
- “Sin asignar”, “Hoy”, “En curso”, “Ajustes” y “En cola” siguen siendo filtros funcionales dentro del panel ampliado.
- La carga de trabajo continúa siendo accionable, incluido “No asignado”.
- Las fechas del tablero distinguen visualmente “Recibida”, “Fecha límite” y “Entregada”.
- Cuando el esquema soporta `due_at`/`delivered_at`, la fecha límite y la fecha real de entrega se mantienen separadas.
- Se conserva la identidad visual oscura, la navegación existente, la accesibilidad y la lógica de Supabase.


## V36.2 — Switch de estado y reapertura segura

- Se reemplazó el desplegable de estado de la tabla por un switch segmentado contextual, más rápido de leer y operar.
- Los estados mantienen el flujo centralizado: En cola → En curso → Entregado; Ajuste solicitado → En curso.
- Una solicitud entregada puede **Devolver a gestión** desde el switch, con confirmación explícita.
- Al reabrir, la solicitud vuelve a **En curso**, conserva su fecha límite y se limpia `delivered_at` para no confundir una entrega anterior con una nueva.
- El cambio queda trazado mediante el historial de cambios existente de Supabase (UPDATE con estado anterior y nuevo).
- Se corrigió la serialización de campos opcionales `null` para permitir limpiar correctamente `delivered_at`.
- Se conserva la identidad visual oscura y las medidas de accesibilidad de V36.1.


## V36.3 — Flujo de producción y pulido operativo

- Se conserva el switch contextual de estados como interacción principal de la tabla.
- `Ajuste solicitado` y `Entregado` usan una disposición vertical cuando necesitan mostrar una segunda acción (`Iniciar ajuste` / `Reabrir`) para evitar solapamientos y truncamientos.
- En móvil se conservan las etiquetas de estado; no se ocultan para depender únicamente de iconos.
- Se elimina la fecha duplicada que aparecía debajo del selector de fecha de la tabla.
- La vista de solicitudes realizadas usa `delivered_at` como fecha real de entrega cuando está disponible.
- La comprobación de concurrencia incluye `due_at` y `delivered_at`.
- Se corrigieron las llamadas de transición de ajustes para pasar por `App.setTaskStatus`, manteniendo una única máquina de estados.
- Los eventos de ciclo de vida se persisten de forma oportunista en `task_events`, además del historial general de cambios.
- El botón de guardado muestra `Guardando…`, queda deshabilitado durante la operación y recupera su estado aunque ocurra un error.


## V36.4 — Flujo de producción y claridad operacional
- Se mantiene el switch de estados de V36.3 como interacción principal.
- Se mejora la lectura de **Carga de trabajo actual**, indicando tareas activas y solicitudes sin asignar.
- Las barras de carga representan distribución relativa de tareas, no porcentaje de capacidad.
- El módulo de carga continúa siendo accionable para filtrar por responsable y resalta el responsable filtrado.
- Los filtros avanzados separan visualmente estado/asignación de detalle/orden.
- “Solicitudes realizadas” pasa a denominarse **Archivo de entregas** para reflejar su función.


## V36.5 — Atajos de filtrado consistentes
- Los accesos rápidos desde KPI, filtros y Mis tareas limpian filtros incompatibles antes de aplicarse.
- Carga de trabajo conserva el filtro por responsable sin arrastrar búsqueda, estado o fechas anteriores.
- Mis tareas aplica el filtro personal antes de llevar el foco a la solicitud seleccionada.
- Limpiar filtros actualiza también los selectores personalizados, evitando estados visuales desincronizados.
- No requiere cambios en Supabase ni ejecución de SQL.
