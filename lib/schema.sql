-- Procedimientos / Licitaciones
create table if not exists licitaciones (
  id                    serial primary key,
  numero_procedimiento  text unique not null,
  titulo                text,
  institucion           text,
  tipo_procedimiento    text,
  monto_estimado        numeric,
  currency              text default 'CRC',
  fecha_publicacion     date,
  fecha_cierre          date,
  estado                text,
  descripcion           text,
  raw                   jsonb,
  score                 numeric default 0,
  keywords              text[],
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- Adjudicaciones históricas
create table if not exists adjudicaciones (
  id                    serial primary key,
  numero_procedimiento  text,
  proveedor             text,
  cedula_proveedor      text,
  monto_adjudicado      numeric,
  fecha_adjudicacion    date,
  institucion           text,
  raw                   jsonb,
  created_at            timestamptz default now()
);

-- Log de importaciones
create table if not exists import_logs (
  id              serial primary key,
  dataset         text,
  filename        text,
  rows_inserted   int default 0,
  rows_updated    int default 0,
  rows_skipped    int default 0,
  error           text,
  created_at      timestamptz default now()
);

-- Índices para búsquedas frecuentes
create index if not exists idx_licitaciones_estado        on licitaciones(estado);
create index if not exists idx_licitaciones_fecha_cierre  on licitaciones(fecha_cierre);
create index if not exists idx_licitaciones_institucion   on licitaciones(institucion);
create index if not exists idx_licitaciones_score         on licitaciones(score desc);
create index if not exists idx_adjudicaciones_proveedor   on adjudicaciones(cedula_proveedor);
create index if not exists idx_adjudicaciones_institucion on adjudicaciones(institucion);
