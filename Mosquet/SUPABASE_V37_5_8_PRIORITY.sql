-- Design Hub V37.5.8
-- Prioridad persistente por usuario.
-- Ejecutar UNA SOLA VEZ en el proyecto Supabase de Design Hub.

ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS priority_by text;

COMMENT ON COLUMN public.tasks.priority_by IS
'Usuario que marcó la solicitud como prioridad en Design Hub.';

CREATE INDEX IF NOT EXISTS idx_tasks_priority_by
ON public.tasks (priority_by);
