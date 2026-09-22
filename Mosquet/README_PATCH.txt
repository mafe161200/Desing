Design Hub V37.5.15

Base: V37.5.14 EN CURSO + PRIORIDAD.

Corrección:
- Se corrige el bug visual de las estrellas de prioridad introducido por el ajuste V37.5.14.
- El CSS ya no fuerza el color de la estrella activa mediante `color: inherit !important`.
- El color de prioridad se entrega mediante `--priority-star-color`, respetando el color del perfil que marcó la solicitud.
- La estrella inactiva mantiene el estilo discreto de V37.5.14.
- No requiere SQL adicional.
- No se modifica el flujo de En curso, asignaciones, fechas, estados, Archivo ni guardado general.
