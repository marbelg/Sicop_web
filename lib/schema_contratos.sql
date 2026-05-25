create table if not exists contratos (
  id                    serial primary key,
  identificador         text unique not null,
  nro_contrato          text,
  numero_procedimiento  text,
  cedula_proveedor      text,
  nro_sicop             text,
  tipo_modificacion     text,
  tipo_disminucion      text,
  contrato_modificado   text,
  tipo_autorizacion     text,
  vigencia_contrato     text,
  unidad_vigencia       text,
  fecha_notificacion    timestamptz,
  ident_contrato_padre  text,
  secuencia             text,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

create index if not exists idx_contratos_numero_proc on contratos(numero_procedimiento);
create index if not exists idx_contratos_proveedor   on contratos(cedula_proveedor);
create index if not exists idx_contratos_padre       on contratos(ident_contrato_padre);
