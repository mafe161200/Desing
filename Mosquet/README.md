# Design Hub V36 — paquete limpio

Esta carpeta corresponde a la **base vigente V36** del proyecto. Se conservaron la interfaz y el flujo actuales; los cambios de esta entrega se concentran en limpieza del repositorio, seguridad de empaquetado, restauración con concurrencia optimista y consolidación de la migración de Supabase.

## Estructura

- `index.html` — interfaz principal.
- `style.css` — estilos actuales, conservados sin un refactor visual riesgoso.
- `app.js` — lógica principal actualizada.
- `SUPABASE_V36_FINAL.sql` — migración consolidada no destructiva.
- `V36_CHANGELOG.md` — registro de cambios.
- `package.json` — comandos de validación sin dependencias adicionales.
- `tests/smoke.test.mjs` — pruebas de integridad del paquete y de invariantes críticas.

## Qué se eliminó del paquete

- `users.js`: contenía credenciales de demostración en texto plano. El login actual utiliza Supabase Auth y perfiles en `public.profiles`.
- `SUPABASE_V34_MIGRATION.sql`: reemplazado por la migración consolidada V36.
- `SUPABASE_V35_MIGRATION.sql`: reemplazado por la migración consolidada V36.
- `V35_CHANGELOG.md`: absorbido en el historial V36.
- `supabase.sql`: su funcionalidad de historial general se conserva dentro de `SUPABASE_V36_FINAL.sql`.
- `desktop.ini`: archivo del sistema operativo, no pertenece al proyecto web.

## Importante sobre Supabase

La migración V36 **no inventa ni reemplaza las policies RLS** de la instalación real. Habilita RLS en las tablas de auditoría y deja la creación de policies para después de revisar los roles y el modelo de Auth reales.

Antes de producción hay que comprobar:

1. Esquema real de `public.tasks` y `public.profiles`.
2. Policies RLS de `tasks`, `profiles`, `task_events`, `task_adjustments` y `task_change_history`.
3. Que `design_hub_restore_task` sea invocable únicamente por los roles autorizados.
4. Que la columna `version` esté presente en `tasks`.

## Validación local

```bash
npm run check
npm test
```

No se afirma una prueba E2E contra la instancia real de Supabase: para ello hace falta ejecutar el proyecto contra esa base y sus policies reales.
