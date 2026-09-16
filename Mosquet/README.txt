DESIGN HUB V30

Versión basada exclusivamente en Design Hub V29.

V30 refina la navegación y el historial general de cambios sin alterar la lógica principal de Gestión ni la trazabilidad de Solicitudes realizadas.

Cambios principales:
- Navegación conjunta entre Solicitudes realizadas e Historial de cambios.
- Historial de cambios con el mismo ancho de la vista de gestión.
- Tipografía y densidad visual reducidas para mostrar más actividad en menos espacio.
- Categorías de auditoría: Creación, Cambio de estado, Asignación, Cambio de fecha, Ajuste solicitado, Modificación y Eliminación.
- El nombre de la solicitud se obtiene preferentemente del snapshot histórico, no solo del registro actual.
- Filtros de fecha normalizados a la fecha local mostrada por la interfaz.
- Filtro de usuario por ID interno, manteniendo el nombre visible.
- Contador que distingue cambios registrados y solicitudes afectadas.
- Carga incremental del historial cuando supera el primer bloque de registros.
- Detalle de cambio accesible con foco controlado, Escape y retorno del foco al botón de origen.
- Restauración renombrada como “Restaurar estado anterior” y presentada como acción secundaria.
- Fechas de campos de tareas formateadas de manera consistente en el detalle.
- Eliminado user-scalable=no del viewport para permitir zoom accesible.
- Etiquetado explícito del campo de fecha de recepción en edición.
- Mantiene la trazabilidad de entregas y ajustes de Solicitudes realizadas.

Validación V30:
- app.js: node --check OK.
- IDs HTML duplicados: ninguno.
- ZIP íntegro: OK.

Nota técnica:
La persistencia transaccional/RPC y la validación definitiva de RLS de Supabase requieren el esquema SQL real de la instancia y no se inventan en esta versión.
