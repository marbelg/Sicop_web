create table if not exists proveedores (
  id                serial primary key,
  cedula_proveedor  text unique not null,
  nombre_proveedor  text,
  tipo_proveedor    text,
  tamaño_proveedor  text,
  provincia         text,
  canton            text,
  distrito          text,
  codigo_postal     text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);
