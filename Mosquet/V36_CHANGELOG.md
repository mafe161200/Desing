# Design Hub V36 — Stabilización

## Correcciones
- Restauración protegida por `version` para evitar sobrescrituras silenciosas.
- Acciones de ciclo de vida unificadas con la máquina de estados.
- Persistencia de eventos y ajustes preparada mediante `task_events` y `task_adjustments`.
- Filtro de vencidas basado en `due_at`/`dueAt`, no en fecha de entrega.
- Persistencia de campos relacionales, timestamps y versión cuando el esquema los soporte.
- Helper SQL para restauración atómica con concurrencia optimista.
- Índices adicionales para historial y ajustes.
- Estados de controles deshabilitados y foco de modales reforzados.

## Nota
La autorización definitiva sigue dependiendo de las políticas RLS reales de Supabase. No se inventan políticas genéricas.
