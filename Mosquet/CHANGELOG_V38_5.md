# Design Hub V38.5 — Responsables múltiples

## Corrección incluida
- El formulario de nueva solicitud permite seleccionar varias personas responsables.
- Las personas seleccionadas se guardan juntas en el campo de texto `assignee`, sin requerir cambios de esquema SQL.
- Se muestra la lista completa de responsables en la tabla de solicitudes.
- Los filtros por responsable, «Mis tareas», el historial y el gráfico de carga reconocen asignaciones múltiples.
- Se mantiene la compatibilidad con solicitudes existentes que tienen un único responsable o están sin asignar.
- Se conserva el flujo de entrega validado en V38.4: permite pasar directamente de «En cola» a «Entregado» y exige responsable antes de registrar la entrega.

## Uso
En «Nueva solicitud», selecciona varias personas en el campo «Asignar a» usando **Ctrl + clic** en Windows o **Cmd + clic** en Mac.

## Validación técnica
- `node --check app.js`: aprobado.
- Integridad del ZIP: aprobada.
- Prueba funcional en navegador: pendiente de ejecución en la instalación del usuario; no se declara ejecutada aquí.

## Compatibilidad
No se incluye ni se requiere migración SQL. Las asignaciones se serializan como texto separado por comas para conservar compatibilidad con el campo `assignee` existente.
