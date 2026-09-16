Design Hub V24.3 — revisión y mejora

Cambios principales:
- Limpieza de la lógica del formulario de nuevas solicitudes.
- Eliminación de referencias heredadas al selector de estado inexistente.
- Estado inicial de nuevas tareas fijado en “En cola”.
- Corrección del estado vacío de la tabla para respetar sus 5 columnas.
- Consolidación final del layout responsive de la tabla de tareas.
- Ajuste de los controles de estado para evitar solapamientos.
- Mejora de accesibilidad de foco y reduced-motion.
- Conservación de Supabase, Realtime, historial, notas y guardado existente.

Validaciones realizadas:
- node --check app.js: OK
- IDs HTML duplicados: ninguno detectado
- Encabezados de tabla: 5, coherentes con las celdas renderizadas
- Referencias estáticas getElementById: sin faltantes, salvo taskNotesViewer que es un elemento creado dinámicamente
- status-switch heredado: eliminado del JS
- submit duplicado de taskForm: eliminado
