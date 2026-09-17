DESIGN HUB V34

Versión basada exclusivamente en Design Hub V33.

V34 mantiene la interfaz y el flujo de trabajo de V33 y refuerza la robustez de la aplicación sin introducir una nueva navegación ni sobrecargar el dashboard.

MEJORAS V34
- Confirmación accesible antes de marcar una solicitud como Entregada.
- Gestor global de foco para los modales: foco inicial, navegación por Tab y retorno al control que abrió el diálogo.
- Navegación Back/Forward del navegador corregida mediante popstate.
- Filtro de estado incluye explícitamente En cola.
- Los filtros principales conservan su selección cuando se reconstruyen los dropdowns.
- Edición de solicitudes con validación consistente de título, solicitante y fecha.
- Fechas de entrega muestran contexto HOY, MAÑANA o VENCIDA cuando corresponde.
- Estado de conexión corregido: cuando Supabase no está disponible se muestra “Sin conexión”, no “Modo Local”.
- Normalización de tareas recibidas por Realtime añadida para evitar referencias a una función inexistente.
- Consultas de perfiles reducidas a los campos que necesita el frontend.
- Notas del equipo limitadas a las 100 más recientes para evitar crecimiento indefinido de la consulta; se mantienen en orden cronológico visual.
- Protección de concurrencia compatible con columna opcional `version`: si la instancia la tiene, las actualizaciones/eliminaciones se condicionan a la versión leída.
- Mensaje específico ante conflicto de edición entre usuarios.
- Se eliminó la referencia a una contraseña ficticia en Gestión de Equipo; el catálogo de miembros no crea cuentas de Supabase Auth.

ARQUITECTURA / BACKEND
- Se incluye `SUPABASE_V34_MIGRATION.sql` como migración opcional para añadir control de versión y preparar eventos de auditoría.
- La migración no modifica ni elimina políticas RLS existentes automáticamente.
- La autorización real debe continuar residiendo en RLS / funciones de Supabase, no en controles visuales del navegador.
- No se inventa un esquema de RLS porque la instancia real de Supabase no fue entregada como SQL en este proyecto.

VALIDACIÓN
- app.js: node --check OK.
- IDs HTML duplicados: debe ser ninguno.
- ZIP: se valida con unzip -t.
- Se revisan referencias a funciones y elementos críticos mediante búsquedas estáticas.
- No se afirma una prueba E2E completa contra Supabase porque no se dispone de un navegador automatizado ni de un entorno de base de datos de prueba de la instancia real.

NOTA
Para activar el control de concurrencia de V34 en Supabase debe aplicarse la migración SQL incluida y comprobar las políticas RLS de la instancia antes de producción.
