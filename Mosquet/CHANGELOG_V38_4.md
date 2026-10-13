# Design Hub V38.4 — Correcciones de entrega

- Se permite la transición directa de `En cola` a `Entregado`.
- Se bloquea la apertura de la confirmación de entrega cuando la solicitud no tiene responsable.
- Se vuelve a validar el responsable al confirmar la entrega, para evitar saltarse la validación.
- Se comprueba la transición de estado antes de registrar la fecha de entrega.
- No se modificaron estilos, estrellas, ni la estructura HTML.
- No se requiere ni se incluye una migración SQL para estos cambios.
