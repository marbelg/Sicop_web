create table if not exists ordenes_pedido (
  id                    serial primary key,
  numero_orden          text not null,
  linea_orden_pedido    text not null,
  numero_orden_pedido   text,
  numero_procedimiento  text,
  nro_contrat           text,
  identificador         text,
  codigo_producto       text,
  secuencia             text,
  monto_orden_pedido    numeric,
  precio_unitario       numeric,
  cantidad_contratada   numeric,
  tipo_moneda           text,
  tipo_cambio_crc       numeric,
  descuento             numeric,
  iva                   numeric,
  acarreos              numeric,
  otros_impuestos       numeric,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now(),
  unique (numero_orden, linea_orden_pedido)
);

create index if not exists idx_ordenes_numero_proc on ordenes_pedido(numero_procedimiento);
create index if not exists idx_ordenes_contrat     on ordenes_pedido(nro_contrat);
create index if not exists idx_ordenes_numero      on ordenes_pedido(numero_orden);
