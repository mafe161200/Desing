Design Hub V25 — flujo funcional de revisión y ajustes

Base:
- Construida exclusivamente sobre Design Hub V24.4 final.

Cambios funcionales principales:
- Nuevo estado operativo: “Ajuste solicitado”.
- Flujo: En cola → En curso → Entregada → Ajuste solicitado → En curso → Entregada.
- “Entregar” reemplaza el lenguaje de “Finalizar” en el control de tareas.
- Una entrega requiere confirmación.
- Una tarea entregada puede pasar por “Solicitar ajuste” desde el tablero y desde Solicitudes realizadas.
- El motivo del ajuste es obligatorio y queda registrado en las notas con fecha, hora y usuario.
- Una tarea en “Ajuste solicitado” muestra la acción “Iniciar ajuste”.
- Se añadió filtro rápido “Ajustes”.
- Se añadió “Ajuste solicitado” a los filtros de estado del tablero y del historial.
- El historial distingue visualmente el estado “Ajuste solicitado”.
- Las tareas entregadas mantienen su fecha registrada hasta que se solicita un ajuste; la siguiente entrega puede actualizarse desde el flujo existente.
- Se conserva Supabase, Realtime, historial de cambios, notas, filtros y guardado.

Validaciones:
- node --check app.js: OK
- IDs HTML duplicados: ninguno
- Estados incluidos en filtros: OK
- Acción start-adjustment: OK
- Acción request-adjustment: OK
- ZIP integrity: OK

Nota:
- El estado y el motivo usan los campos existentes de la aplicación; no se inventaron nuevas columnas de Supabase.
- La trazabilidad detallada de cambios sigue dependiendo de task_change_history y sus políticas de Supabase.
