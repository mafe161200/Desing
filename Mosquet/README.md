
## V36.1 — Consolidación UX/UI

- Se mantiene V36 como base única; no se reconstruye desde versiones anteriores.
- El estado de cada solicitud se presenta como un único selector contextual, en lugar de varios botones pequeños.
- Editar y eliminar pasan a un menú de “Más acciones”; notas e historial permanecen accesibles en la fila.
- Los filtros rápidos visibles se reducen a Todas, Mis tareas, Prioridad y Vencidas; filtros secundarios pasan a “Más filtros”.
- “Sin asignar”, “Hoy”, “En curso”, “Ajustes” y “En cola” siguen siendo filtros funcionales dentro del panel ampliado.
- La carga de trabajo continúa siendo accionable, incluido “No asignado”.
- Las fechas del tablero distinguen visualmente “Recibida”, “Fecha límite” y “Entregada”.
- Cuando el esquema soporta `due_at`/`delivered_at`, la fecha límite y la fecha real de entrega se mantienen separadas.
- Se conserva la identidad visual oscura, la navegación existente, la accesibilidad y la lógica de Supabase.


## V36.2 — Switch de estado y reapertura segura

- Se reemplazó el desplegable de estado de la tabla por un switch segmentado contextual, más rápido de leer y operar.
- Los estados mantienen el flujo centralizado: En cola → En curso → Entregado; Ajuste solicitado → En curso.
- Una solicitud entregada puede **Devolver a gestión** desde el switch, con confirmación explícita.
- Al reabrir, la solicitud vuelve a **En curso**, conserva su fecha límite y se limpia `delivered_at` para no confundir una entrega anterior con una nueva.
- El cambio queda trazado mediante el historial de cambios existente de Supabase (UPDATE con estado anterior y nuevo).
- Se corrigió la serialización de campos opcionales `null` para permitir limpiar correctamente `delivered_at`.
- Se conserva la identidad visual oscura y las medidas de accesibilidad de V36.1.


## V36.3 — Flujo de producción y pulido operativo

- Se conserva el switch contextual de estados como interacción principal de la tabla.
- `Ajuste solicitado` y `Entregado` usan una disposición vertical cuando necesitan mostrar una segunda acción (`Iniciar ajuste` / `Reabrir`) para evitar solapamientos y truncamientos.
- En móvil se conservan las etiquetas de estado; no se ocultan para depender únicamente de iconos.
- Se elimina la fecha duplicada que aparecía debajo del selector de fecha de la tabla.
- La vista de solicitudes realizadas usa `delivered_at` como fecha real de entrega cuando está disponible.
- La comprobación de concurrencia incluye `due_at` y `delivered_at`.
- Se corrigieron las llamadas de transición de ajustes para pasar por `App.setTaskStatus`, manteniendo una única máquina de estados.
- Los eventos de ciclo de vida se persisten de forma oportunista en `task_events`, además del historial general de cambios.
- El botón de guardado muestra `Guardando…`, queda deshabilitado durante la operación y recupera su estado aunque ocurra un error.


## V36.4 — Flujo de producción y claridad operacional
- Se mantiene el switch de estados de V36.3 como interacción principal.
- Se mejora la lectura de **Carga de trabajo actual**, indicando tareas activas y solicitudes sin asignar.
- Las barras de carga representan distribución relativa de tareas, no porcentaje de capacidad.
- El módulo de carga continúa siendo accionable para filtrar por responsable y resalta el responsable filtrado.
- Los filtros avanzados separan visualmente estado/asignación de detalle/orden.
- “Solicitudes realizadas” pasa a denominarse **Archivo de entregas** para reflejar su función.


## V36.5 — Atajos de filtrado consistentes
- Los accesos rápidos desde KPI, filtros y Mis tareas limpian filtros incompatibles antes de aplicarse.
- Carga de trabajo conserva el filtro por responsable sin arrastrar búsqueda, estado o fechas anteriores.
- Mis tareas aplica el filtro personal antes de llevar el foco a la solicitud seleccionada.
- Limpiar filtros actualiza también los selectores personalizados, evitando estados visuales desincronizados.
- No requiere cambios en Supabase ni ejecución de SQL.


## V36.6 — Pulido final de la pantalla principal
- Se conserva el switch de estados como interacción principal.
- Se amplía la columna de Estado y se uniforman los botones para evitar solapamientos.
- Los estados especiales de ajuste y entrega se presentan en bloques verticales.
- La columna Acciones recibe espacio suficiente para notas, historial y más acciones.
- Los KPI con atención (ajustes, vencidas y prioridad) reciben una señal visual discreta y siguen siendo clicables.
- `No asignado` aparece primero en Carga de trabajo cuando existe trabajo sin responsable y queda visualmente identificado.
- No requiere cambios SQL.


## V36.7 — Saneamiento funcional y UX

- Los eventos de ciclo de vida se encolan mientras hay cambios sin guardar y se persisten después de confirmar el guardado, evitando eventos de auditoría huérfanos.
- La vista Archivo de entregas muestra únicamente solicitudes actualmente entregadas; una solicitud reabierta vuelve a Gestión hasta que tenga una nueva entrega.
- Las tarjetas de Mis tareas distinguen “Rec.” y “Límite” para evitar confundir la fecha límite con una fecha de entrega real.
- Se refuerza el espacio de Estado y Acciones y se conserva el texto de los controles de estado en móvil.
- No requiere cambios en Supabase ni ejecución de SQL.


## V36.8 — Selectores del formulario de nueva solicitud
- Los selectores personalizados de Solicitud y Asignación se renderizan como menús portaled al `body`, evitando recortes por modales/overflow.
- Los menús se reconstruyen al abrir Nueva solicitud para mantener sincronizadas las opciones de solicitantes y colaboradores.
- No requiere cambios SQL.


## V36.9 — Núcleo y guardado

- Concurrencia optimista centralizada en `DataService.saveTasks()`; se elimina la comprobación preventiva duplicada.
- Los errores de lectura de tareas ya no se convierten silenciosamente en una lista vacía.
- Guardado con feedback claro y recuperación segura del botón.
- Sincronización posterior al guardado tolera un fallo de refresco sin presentar un guardado exitoso como fallido.
- Selectores personalizados reconstruidos como un conjunto global para evitar wrappers anidados y menús desconectados en Nueva solicitud y edición.
- No se realizaron cambios SQL.


## V37 — Autosave y sincronización
- Se reemplaza el guardado manual de cambios de solicitudes por guardado automático con una pausa breve después de cada modificación.
- El indicador inferior comunica `Guardando…`, `Guardado`, `No se pudo sincronizar` o conflicto remoto sin interrumpir el flujo.
- Se conserva `Deshacer` a nivel de último estado sincronizado mediante la API interna, sin botón permanente de “Guardar cambios”.
- La concurrencia continúa protegida por `version` cuando el esquema moderno está disponible.
- Los errores de Supabase no se convierten en listas vacías ni se presentan como guardados exitosos.
- La versión es compatible con el esquema actual de `tasks` sin requerir una migración SQL para el autosave básico. Las columnas modernas se usan únicamente cuando ya existen en la instalación.
- No se modifica ni se requiere ejecutar `SUPABASE_V36_FINAL.sql` para esta migración específica.


## V37.2 — Consolidación UX/UI

- Refinamiento de notificaciones, modales y controles de cierre.
- Indicador de autosave compacto: sincronizando, guardado y error.
- Jerarquía visual más clara para Estado y Acciones.
- Sidebar renombrado a Trabajo activo y fecha de filtros más clara.
- Ajustes responsive y accesibilidad visual.
- No requiere cambios en Supabase ni ejecución de SQL.


## V37.3 — Cierre del flujo de entregas

- Se añadió `Devolver al flujo` en el Archivo de entregas.
- La devolución permite elegir `En cola` o `En curso`.
- La entrega anterior permanece registrada en el historial.
- El estado `Entregado` ahora admite devolución a Gestión sin perder el historial.
- Se pulieron los botones `Solicitar ajuste` y `Devolver al flujo`.
- El texto del Archivo aclara sus acciones disponibles.
- No se modificó SQL.

## V37.4 — Jerarquía de atención y contraste

- Se reforzó el contraste de fechas límite que requieren atención.
- `Para Hoy` ahora utiliza un fondo ámbar sutil con texto de mayor contraste.
- `No asignado` conserva el ámbar como señal de atención, con menor intensidad que una fecha urgente.
- Las tareas vencidas mantienen prioridad visual mediante el estado de peligro, evitando mezclar semánticas.
- No se modificó la lógica de Supabase ni se requiere SQL adicional.



## V37.5 — Escala y proporciones

- Ajuste fino de escala tipográfica en tabla y acciones.
- Acciones del Archivo de entregas más compactas y horizontales en escritorio.
- Modal de entrega más compacto y con jerarquía tipográfica consistente.
- Footer del modal estabilizado para evitar solapamiento/corte del botón Cancelar.
- Botones con altura y tamaños tipográficos coherentes.
- Responsive ajustado para conservar legibilidad en pantallas pequeñas.
- No se modificó la lógica ni Supabase; no requiere SQL.


## V37.5.1 — Hotfix visual
- `No asignado` deja de utilizar amarillo y pasa a una señal neutra azul/gris.
- Se mantienen sin cambios las demás semánticas de color: `Para Hoy`, `Vencida`, `Ajuste solicitado`, `Prioridad` y `Entregado`.
- No se modificó la lógica de la aplicación ni se requiere SQL.


## V37.5.2 — Microinteracciones y tabla de Archivo
- Redistribución de columnas del Archivo de entregas para evitar acciones cortadas.
- Acciones de Archivo más compactas y con `↶` como botón secundario.
- Animaciones JS/CSS breves para cambios de estado, filtros, navegación entre vistas y actualización de KPI.
- Entrada escalonada de filas en Gestión y Archivo.
- Feedback visual de botones y acciones.
- Respeto de `prefers-reduced-motion`.
- Sin cambios de lógica de Supabase y sin SQL.

## V37.5.3 — STABLE
- Corrección: cada confirmación de entrega registra `dateDelivered` con la fecha real del día.
- La misma corrección aplica después de devolver una solicitud al flujo y entregarla nuevamente.
- Cuando existe el esquema moderno, también se conserva `delivered_at`.
- El historial previo de la solicitud no se elimina.
- Metadatos de `package.json` actualizados a V37.5.3.
- Sin SQL, sin migraciones y sin tests nuevos.

## V37.5.4 — STABLE
- Eliminado el icono grande redundante dentro del modal «Devolver al flujo».
- Footer del modal ajustado para mantener `Cancelar` completamente visible.
- Separación entre botones aumentada y botón principal ligeramente más compacto.
- Responsive preservado: en pantallas pequeñas los botones se apilan.
- Sin cambios funcionales, sin SQL y sin tests nuevos.

## V37.5.5 — Ajuste visual de filtros
- Panel «Más filtros» más compacto en escritorio, sin eliminar ni cambiar filtros.
- Los seis controles y «Limpiar» permanecen en una sola fila cuando el ancho lo permite.
- Textos visuales de filtros simplificados (`Responsable · Todos`, `Solicitante · Todos`).
- Búsqueda mantiene exactamente la misma lógica; se desactiva el autocompletado del navegador para evitar sugerencias flotantes.
- Sin cambios de Supabase, sin SQL, sin cambios de estados, entrega, archivo, historial o autosave.


## V37.5.5 FIX — Solicitudes realizadas
- Corregido el filtro «Realizadas» para reconocer tanto el estado actual `Entregado` como registros heredados con estado `Realizada`.
- Las solicitudes realizadas vuelven a aparecer correctamente al seleccionar ese filtro.
- La fecha de entrega también se interpreta correctamente para esos registros heredados.
- El ajuste visual de filtros de V37.5.5 se conserva.
- Sin SQL y sin cambios al flujo de estados actual.

## V37.5.8 — Búsqueda contextual de solicitudes entregadas
- Gestión conserva el filtro inicial `Pendientes`; las entregadas no se mezclan con las tareas activas.
- Si una búsqueda no tiene coincidencias pendientes pero sí encuentra solicitudes completadas, se informa que están en Archivo de entregas.
- El botón «Ver en Archivo de entregas» abre el Archivo y transfiere la búsqueda.
- El Archivo reconoce los estados completados actuales (`Entregado`) y legados (`Realizada`).
- Sin cambios de estilos generales, esquema de Supabase, SQL, historial de eventos o autosave.
