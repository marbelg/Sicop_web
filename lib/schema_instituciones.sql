create table if not exists instituciones (
  id                  serial primary key,
  cedula              text unique not null,
  nombre_institucion  text,
  representante       text,
  direccion           text,
  canton              text,
  distrito            text,
  codigo_postal       text,
  telefono            text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
