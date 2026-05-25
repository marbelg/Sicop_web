create table if not exists adjudicaciones_firme (
  id                     serial primary key,
  numero_procedimiento   text unique not null,
  nro_sicop              text,
  desierto               boolean,
  permite_recursos       boolean,
  fecha_adj_firme        timestamptz,
  fecha_comunicacion     timestamptz,
  fecha_maxima_recursos  timestamptz,
  created_at             timestamptz default now(),
  updated_at             timestamptz default now()
);

create index if not exists idx_adj_firme_numero_proc on adjudicaciones_firme(numero_procedimiento);
create index if not exists idx_adj_firme_fecha       on adjudicaciones_firme(fecha_adj_firme);
