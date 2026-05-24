create table if not exists ofertas (
  id                    serial primary key,
  identificador         text unique not null,
  numero_procedimiento  text,
  cedula_proveedor      text,
  fecha_presenta_oferta timestamptz,
  estado                text,
  id_consorcio          text,
  elegible              text,
  tipo_oferta           text,
  nro_sicop             text,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

create index if not exists idx_ofertas_numero_proc on ofertas(numero_procedimiento);
create index if not exists idx_ofertas_proveedor   on ofertas(cedula_proveedor);
create index if not exists idx_ofertas_estado      on ofertas(estado);
