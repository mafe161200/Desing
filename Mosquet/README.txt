Design Hub V24.4 — consolidación técnica

Base exclusiva: Design Hub V24.3 estable.

Mejoras principales:
- Limpieza de selectores CSS residuales de la tabla.
- Distribución responsive de la tabla corregida para sumar 100% en tablet.
- Controles de estado más claros y compactos.
- Las solicitudes realizadas ahora pueden reabrirse desde la propia tabla.
- Confirmación de eliminación más descriptiva.
- Manejo de error fatal más útil; ya no recomienda limpiar caché como primera medida.
- Guardado de altas y actualizaciones agrupado mediante upsert para reducir llamadas a Supabase.
- Versiones de dependencias CDN fijadas para evitar cambios inesperados por `latest`/rangos.
- Ajustes responsive de acciones y estado en móvil.

Validaciones realizadas:
- node --check app.js: OK
- IDs HTML duplicados: ninguno detectado
- Tablas HTML: 2
- Selectores CSS residuales detectados en la revisión final: corregidos
- Distribución principal: 31/22/15/23/9 = 100%
- Distribución tablet: 30/22/15/24/9 = 100%
- Integridad ZIP: pendiente de empaquetado final

Nota técnica:
- El guardado sigue sin ser una transacción PostgreSQL completa porque eso requiere una función/RPC en Supabase. V24.4 reduce llamadas y mejora consistencia, pero no sustituye una transacción de base de datos.
