# V39.2 — Formulario y comentarios fechados

- Ajustado únicamente el modal Nueva Solicitud: ancho responsivo, cuadrícula estable, campos sin desbordamiento y contenedores que no recortan menús/fechas.
- El panel de notas ahora permite añadir comentarios con fecha, hora y autor.
- Los comentarios se almacenan dentro del campo `notes` existente; no se requiere migración SQL.
- La edición de notas conserva los comentarios existentes. Las notas antiguas siguen siendo legibles como contexto original.
- No se cambió la lógica de prioridades, estados ni entregas.
