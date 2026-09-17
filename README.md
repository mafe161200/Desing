# Design Hub V1

Base independiente para una aplicación integral de **producción + diseño + clientes + finanzas**.

## Objetivo de V1

Establecer una arquitectura inicial clara antes de conectar el sistema real a Supabase.

### Roles iniciales

- **Administrador**
- **Jefe de producción y diseño**
- **Finanzas**

La V1 separa conceptualmente los módulos y evita mezclar información financiera con la operación diaria de producción.

## Módulos

1. Dashboard
2. Solicitudes
3. Clientes
4. Producción
5. Finanzas
6. Historial / auditoría

## Estado actual

La interfaz incluida es un **prototipo funcional local**. Usa `localStorage` para demostrar navegación, solicitudes, estados, KPIs, carga de trabajo e historial.

La autenticación mostrada en esta V1 es únicamente de demostración. **No contiene contraseñas reales ni debe usarse como autenticación de producción.**

## Supabase

`SUPABASE_V1_SCHEMA.sql` define una primera base para:

- perfiles y roles;
- clientes;
- solicitudes;
- eventos/auditoría;
- facturación;
- control de versión para concurrencia.

No ejecutar el SQL directamente sobre una instancia existente sin comparar primero el esquema real.

## Regla de evolución

Esta V1 es una base nueva y separada. Las futuras modificaciones deben hacerse incrementalmente sobre la última versión validada de esta línea, no sobre versiones antiguas o archivos alternativos.

## Próximos bloques

- V1.1: autenticación Supabase Auth + perfiles/RLS.
- V1.2: CRUD real de clientes y solicitudes.
- V1.3: flujo completo de producción, entregables y ajustes.
- V1.4: módulo financiero con facturación, cobros y permisos.
- V1.5: auditoría, concurrencia, pruebas y endurecimiento de seguridad.
