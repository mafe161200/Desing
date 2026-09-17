
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
