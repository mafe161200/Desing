V37.5.12 — PRIORIDAD FIX FINAL

- Partiendo exclusivamente de V37.5.11.
- La estrella de prioridad conserva el color dinámico del perfil; se eliminó la regla CSS que lo sobrescribía con cian mediante !important.
- El SVG de la estrella usa currentColor para respetar el color inline del usuario.
- El UPDATE de prioridad usa count: exact y valida que Supabase haya afectado exactamente una solicitud.
- Si RLS o permisos impiden la actualización, se informa el error y se revierte el cambio local.
- No requiere SQL adicional. Usa tasks.priority_by creada en V37.5.8.
- No se modifican los demás flujos del portal.
