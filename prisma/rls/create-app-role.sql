-- Rol de aplicación para Caudall — sin privilegios de dueño de tabla.
--
-- PostgreSQL IGNORA automáticamente las políticas de Row-Level Security
-- para el dueño de la tabla (y para superusuarios). Si la app se sigue
-- conectando con el rol que creó las tablas (el dueño), activar RLS no
-- protege nada — las políticas existirían pero nunca se aplicarían.
--
-- Este script crea un rol nuevo, sin ser dueño de nada, con permisos
-- normales de lectura/escritura sobre las tablas — ese es el rol que la
-- app debe usar en DATABASE_URL a partir de ahora para que RLS sea real.
--
-- Paso único, no versionado por Prisma (CREATE ROLE es a nivel de
-- cluster, no de base de datos — Prisma Migrate no lo rastrea bien). Se
-- corre una sola vez, a mano, contra cada base (local y Neon).
--
-- IMPORTANTE: reemplaza REPLACE_WITH_STRONG_PASSWORD por una contraseña
-- fuerte generada aparte (ej. `openssl rand -base64 24`) ANTES de correr
-- esto — nunca la misma en local y en Neon, y nunca commiteada a git.
-- Esa contraseña va después en APP_DATABASE_URL (ver comentario en
-- src/lib/db/prisma.ts), no en este archivo.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'caudall_app') THEN
    CREATE ROLE caudall_app LOGIN PASSWORD 'REPLACE_WITH_STRONG_PASSWORD';
  END IF;
END
$$;

DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO caudall_app', current_database());
END
$$;

GRANT USAGE ON SCHEMA public TO caudall_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO caudall_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO caudall_app;

-- Para que las tablas que se creen en el futuro (nuevas migraciones)
-- también queden accesibles para este rol sin repetir este script.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO caudall_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO caudall_app;
