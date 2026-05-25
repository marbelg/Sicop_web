import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { unzipSync } from 'fflate'

const SICOP_BASE = 'https://www.sicop.go.cr'
const PORTAL_URL = `${SICOP_BASE}/moduloPcont/pcont/rp/CE_MOD_DATOSABIERTOSVIEW.jsp`

// Format date as DDMMYYYY (SICOP format)
function fmtSicop(d: Date) {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}${mm}${yyyy}`
}

// Each dataset: endpoint + body builder + row normalizer
const DATASETS = [
  {
    name: 'solicitudes',
    endpoint: '/moduloPcont/servlet/cont/rp/CE_DA_SC_CONTROLLER_JSON.java',
    body: (start: string, end: string) =>
      `bgnYmd=${start}&endYmd=${end}&instNmSC=&instCdSC=&proceTypeSC=&cmd=create`,
    table: 'licitaciones',
    normalizer: normalizeSC,
  },
  {
    name: 'carteles',
    endpoint: '/moduloPcont/servlet/cont/rp/CE_DA_DC_CONTROLLER_JSON.java',
    body: (start: string, end: string) =>
      `bgnYmdDC=${start}&endYmdDC=${end}&instNmDC=&instCdDC=&instCartelNoDC=&proceTypeDC=&cmd=create`,
    table: 'carteles',
    normalizer: normalizeDC,
  },
  {
    name: 'ofertas',
    endpoint: '/moduloPcont/servlet/cont/rp/CE_DA_O_CONTROLLER_JSON.java',
    body: (start: string, end: string) =>
      `bgnYmdO=${start}&endYmdO=${end}&instNmO=&instCdO=&supplierO=&instCartelNoO=&proceTypeO=&cmd=create`,
    table: 'ofertas',
    normalizer: normalizeO,
  },
  {
    name: 'adjudicaciones_firme',
    endpoint: '/moduloPcont/servlet/cont/rp/CE_DA_AF_CONTROLLER_JSON.java',
    body: (start: string, end: string) =>
      `bgnYmdAF=${start}&endYmdAF=${end}&instNmAF=&instCdAF=&supplierCdAF=&instCartelNoAF=&proceTypeAF=&cmd=create`,
    table: 'adjudicaciones_firme',
    normalizer: normalizeAF,
  },
  {
    name: 'contratos',
    endpoint: '/moduloPcont/servlet/cont/rp/CE_DA_C_CONTROLLER_JSON.java',
    body: (start: string, end: string) =>
      `bgnYmdC=${start}&endYmdC=${end}&instNmC=&instCdC=&supplierC=&instCartelNoC=&proceTypeC=&cmd=create`,
    table: 'contratos',
    normalizer: normalizeC,
  },
  {
    name: 'ordenes_pedido',
    endpoint: '/moduloPcont/servlet/cont/rp/CE_DA_OP_CONTROLLER_JSON.java',
    body: (start: string, end: string) =>
      `bgnYmdOP=${start}&endYmdOP=${end}&valor=&instNmOP=&instCdOP=&ordenpedidoOP=&instCartelNoOP=&cmd=create`,
    table: 'ordenes_pedido',
    normalizer: normalizeOP,
  },
  {
    name: 'instituciones',
    endpoint: '/moduloPcont/servlet/cont/rp/CE_DA_IC_CONTROLLER_JSON.java',
    body: (_start: string, _end: string) =>
      `instNmIC=&instCdIC=&provincias=&cantones=&distritos=&cmd=create`,
    table: 'instituciones',
    normalizer: normalizeIC,
  },
  {
    name: 'proveedores',
    endpoint: '/moduloPcont/servlet/cont/rp/CE_DA_P_CONTROLLER_JSON.java',
    body: (_start: string, _end: string) => `tamano=&cmd=create`,
    table: 'proveedores',
    normalizer: normalizeP,
  },
]

function normalizeSC(row: any) {
  const numero = row.NUMERO_PROCEDIMIENTO
  if (!numero) return null

  const parseDate = (v: any) => {
    if (!v) return null
    const s = String(v).trim()
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
      const [d, m, y] = s.split('/'); return `${y}-${m}-${d}`
    }
    return null
  }

  const parseAmt = (v: any) => {
    if (v == null || v === '') return null
    const n = parseFloat(String(v).replace(/[^0-9.]/g, ''))
    return isNaN(n) ? null : n
  }

  return {
    numero_procedimiento: String(numero).trim(),
    titulo:            row.JUST_PROCEDENCIA ? String(row.JUST_PROCEDENCIA).slice(0, 500) : null,
    institucion:       row.CEDULA_INSTITUCION ? String(row.CEDULA_INSTITUCION) : null,
    tipo_procedimiento:row.TIPO_PROCEDIMIENTO ? String(row.TIPO_PROCEDIMIENTO) : null,
    monto_estimado:    parseAmt(row.PRESUPUESTO),
    currency:          row.MONEDA ?? 'CRC',
    fecha_publicacion: parseDate(row.FECHA_TRAMITE),
    fecha_cierre:      null,
    estado:            'Activo',
    descripcion:       row.FINALIDAD_PUBLICA ? String(row.FINALIDAD_PUBLICA).slice(0, 1000) : null,
    raw:               row,
  }
}

function normalizeDC(row: any) {
  const nro = row.NRO_PROCEDIMIENTO
  if (!nro) return null

  const parseDate = (v: any) => {
    if (!v) return null
    const s = String(v).trim()
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
      const [d, m, y] = s.split('/'); return `${y}-${m}-${d}`
    }
    return null
  }

  return {
    nro_procedimiento:      String(nro).trim(),
    fecha_cierre:           parseDate(row.FECHA_CIERRE_RECEPCION),
    nombre_unidad_compra:   row.NOMBRE_UNIDAD_COMPRA ? String(row.NOMBRE_UNIDAD_COMPRA).slice(0, 300) : null,
    cedula_institucion:     row.CEDULA_INSTITUCION ? String(row.CEDULA_INSTITUCION) : null,
    descripcion:            row.DESCRIPCION ? String(row.DESCRIPCION).slice(0, 1000) : null,
    tipo_procedimiento:     row.TIPO_PROCEDIMIENTO ? String(row.TIPO_PROCEDIMIENTO) : null,
    modalidad:              row.MODALIDAD_PROCEDIMIENTO ? String(row.MODALIDAD_PROCEDIMIENTO) : null,
    fecha_publicacion:      parseDate(row.FECHA_PUBLICACION),
    fecha_apertura:         parseDate(row.FECHA_APERTURA),
    fecha_inicio_recepcion: parseDate(row.FECHA_INICIO_RECEPCION),
    nro_sicop:              row.NRO_SICOP ? String(row.NRO_SICOP) : null,
    pago_adelantado_pymes:  row.PAGO_ADELANTADO_PYMES ? String(row.PAGO_ADELANTADO_PYMES) : null,
    raw:                    row,
  }
}

function normalizeO(row: any) {
  const id = row.IDENTIFICADOR
  if (!id) return null

  const parseTs = (v: any) => {
    if (!v) return null
    const s = String(v).trim()
    return /^\d{4}-\d{2}-\d{2}/.test(s) ? s : null
  }

  return {
    identificador:         String(id).trim(),
    numero_procedimiento:  row.NUMERO_PROCEDIMIENTO ? String(row.NUMERO_PROCEDIMIENTO).trim() : null,
    cedula_proveedor:      row.CEDULA_PROVEEDOR ? String(row.CEDULA_PROVEEDOR) : null,
    fecha_presenta_oferta: parseTs(row.FECHA_PRESENTA_OFERTA),
    estado:                row.ESTADO ? String(row.ESTADO) : null,
    id_consorcio:          row.ID_CONSORCIO && row.ID_CONSORCIO !== '' ? String(row.ID_CONSORCIO) : null,
    elegible:              row.ELEGIBLE ? String(row.ELEGIBLE) : null,
    tipo_oferta:           row.TIPO_OFERTA ? String(row.TIPO_OFERTA) : null,
    nro_sicop:             row.NRO_SICOP ? String(row.NRO_SICOP) : null,
    raw:                   row,
  }
}

function normalizeAF(row: any) {
  const nro = row.NUMERO_PROCEDIMIENTO
  if (!nro) return null

  const parseTs = (v: any) => {
    if (!v) return null
    const s = String(v).trim()
    return /^\d{4}-\d{2}-\d{2}/.test(s) ? s : null
  }

  return {
    numero_procedimiento:  String(nro).trim(),
    nro_sicop:             row.NRO_SICOP ? String(row.NRO_SICOP) : null,
    desierto:              row.DESIERTO === 'S' || row.DESIERTO === 'Si' || row.DESIERTO === 'Y',
    permite_recursos:      row.PERMITE_RECURSOS === 'Si' || row.PERMITE_RECURSOS === 'S',
    fecha_adj_firme:       parseTs(row.FECHA_ADJ_FIRME),
    fecha_comunicacion:    parseTs(row.FECHA_COMUNICACION),
    fecha_maxima_recursos: parseTs(row.FECHA_MAXIMA_RECURSOS),
    raw:                   row,
  }
}

function normalizeC(row: any) {
  const id = row.IDENTIFICADOR
  if (!id) return null

  const parseTs = (v: any) => {
    if (!v) return null
    const s = String(v).trim()
    return /^\d{4}-\d{2}-\d{2}/.test(s) ? s : null
  }

  return {
    identificador:        String(id).trim(),
    nro_contrato:         row.NRO_CONTRATO ? String(row.NRO_CONTRATO) : null,
    numero_procedimiento: row.NUMERO_PROCEDIMIENTO ? String(row.NUMERO_PROCEDIMIENTO).trim() : null,
    cedula_proveedor:     row.CEDULA_PROVEEDOR ? String(row.CEDULA_PROVEEDOR) : null,
    nro_sicop:            row.NRO_SICOP ? String(row.NRO_SICOP) : null,
    tipo_modificacion:    row.TIPO_MODIFICACION ? String(row.TIPO_MODIFICACION) : null,
    tipo_disminucion:     row.TIPO_DISMINUCION && row.TIPO_DISMINUCION !== '' ? String(row.TIPO_DISMINUCION) : null,
    contrato_modificado:  row.CONTRATO_MODIFICADO ? String(row.CONTRATO_MODIFICADO) : null,
    tipo_autorizacion:    row.TIPO_AUTORIZACION ? String(row.TIPO_AUTORIZACION) : null,
    vigencia_contrato:    row.VIGENCIA_CONTRATO ? String(row.VIGENCIA_CONTRATO) : null,
    unidad_vigencia:      row.UNIDAD_VIGENCIA ? String(row.UNIDAD_VIGENCIA) : null,
    fecha_notificacion:   parseTs(row.FECHA_NOTIFICACION),
    ident_contrato_padre: row.IDENT_CONTRATO_PADRE && row.IDENT_CONTRATO_PADRE !== '' ? String(row.IDENT_CONTRATO_PADRE) : null,
    secuencia:            row.SECUENCIA ? String(row.SECUENCIA) : null,
    raw:                  row,
  }
}

function normalizeOP(row: any) {
  const orden = row.NUMERO_ORDEN
  const linea = row.LINEA_ORDEN_PEDIDO
  if (!orden || !linea) return null

  const parseNum = (v: any) => {
    if (v == null || v === '') return null
    const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''))
    return isNaN(n) ? null : n
  }

  return {
    numero_orden:         String(orden).trim(),
    linea_orden_pedido:   String(linea).trim(),
    numero_orden_pedido:  row.NUMERO_ORDEN_PEDIDO ? String(row.NUMERO_ORDEN_PEDIDO) : null,
    numero_procedimiento: row.NUMERO_PROCEDIMIENTO ? String(row.NUMERO_PROCEDIMIENTO).trim() : null,
    nro_contrat:          row.NRO_CONTRAT ? String(row.NRO_CONTRAT) : null,
    identificador:        row.IDENTIFICADOR ? String(row.IDENTIFICADOR) : null,
    codigo_producto:      row.CODIGO_PRODUCTO ? String(row.CODIGO_PRODUCTO) : null,
    secuencia:            row.SECUENCIA ? String(row.SECUENCIA) : null,
    monto_orden_pedido:   parseNum(row.MONTO_ORDEN_PEDIDO),
    precio_unitario:      parseNum(row.PRECIO_UNITARIO),
    cantidad_contratada:  parseNum(row.CANTIDAD_CONTRATADA),
    tipo_moneda:          row.TIPO_MONEDA ? String(row.TIPO_MONEDA) : null,
    tipo_cambio_crc:      parseNum(row.TIPO_CAMBIO_CRC),
    descuento:            parseNum(row.DESCUENTO),
    iva:                  parseNum(row.IVA),
    acarreos:             parseNum(row.ACARREOS),
    otros_impuestos:      parseNum(row.OTROS_IMPUESTOS),
    raw:                  row,
  }
}

function normalizeIC(row: any) {
  const cedula = row.CEDULA
  if (!cedula) return null
  return {
    cedula:             String(cedula).trim(),
    nombre_institucion: row.NOMBRE_INSTITUCION ? String(row.NOMBRE_INSTITUCION) : null,
    representante:      row.REPRESENTANTE ? String(row.REPRESENTANTE) : null,
    direccion:          row.DIRECCION ? String(row.DIRECCION) : null,
    canton:             row.CANTON ? String(row.CANTON) : null,
    distrito:           row.DISTRITO ? String(row.DISTRITO) : null,
    codigo_postal:      row.CODIGO_POSTAL ? String(row.CODIGO_POSTAL) : null,
    telefono:           row.TELEFONO ? String(row.TELEFONO) : null,
    raw:                row,
  }
}

function normalizeP(row: any) {
  const cedula = row.CEDULA_PROVEEDOR
  if (!cedula) return null
  return {
    cedula_proveedor: String(cedula).trim(),
    nombre_proveedor: row.NOMBRE_PROVEEDOR ? String(row.NOMBRE_PROVEEDOR) : null,
    tipo_proveedor:   row.TIPO_PROVEEDOR ? String(row.TIPO_PROVEEDOR) : null,
    tamaño_proveedor: row['TAMAÑO_PROVEEDOR'] ? String(row['TAMAÑO_PROVEEDOR']) : null,
    provincia:        row.PROVINCIA ? String(row.PROVINCIA) : null,
    canton:           row.CANTON ? String(row.CANTON) : null,
    distrito:         row.DISTRITO ? String(row.DISTRITO) : null,
    codigo_postal:    row.CODIGO_POSTAL ? String(row.CODIGO_POSTAL) : null,
    raw:              row,
  }
}

function extractKeywords(norm: ReturnType<typeof normalizeSC>) {
  if (!norm) return []
  const text = [norm.titulo, norm.descripcion, norm.tipo_procedimiento].filter(Boolean).join(' ').toLowerCase()
  const stop = new Set(['de','la','el','en','y','a','que','los','las','con','para','por','del','un','una','se','al','por','las'])
  return [...new Set(text.replace(/[^\w\s]/g,' ').split(/\s+/).filter(w => w.length > 3 && !stop.has(w)))].slice(0, 20)
}

async function fetchSession(): Promise<string> {
  const res = await fetch(PORTAL_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const cookies = res.headers.get('set-cookie') || ''
  const match = cookies.match(/JSESSIONID=([^;]+)/)
  return match ? match[1] : ''
}

async function syncDataset(
  dataset: typeof DATASETS[0],
  sessionId: string,
  startDate: string,
  endDate: string,
  sql: ReturnType<typeof import('@/lib/db')['getDb']>
) {
  const body = dataset.body(startDate, endDate)
  const res = await fetch(`${SICOP_BASE}${dataset.endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Cookie': `JSESSIONID=${sessionId}`,
      'Referer': PORTAL_URL,
      'User-Agent': 'Mozilla/5.0',
    },
    body,
  })

  // Step 1: POST returns the filename of the ZIP, not the file itself
  const filename = (await res.text()).trim()
  if (!filename.endsWith('.zip')) throw new Error(`Unexpected response: ${filename.slice(0, 100)}`)

  // Step 2: GET same endpoint with cmd=download&fileZipName=
  const fileUrl = `${SICOP_BASE}${dataset.endpoint}?cmd=download&fileZipName=${encodeURIComponent(filename)}`
  const fileRes = await fetch(fileUrl, {
    headers: {
      'Cookie': `JSESSIONID=${sessionId}`,
      'Referer': PORTAL_URL,
      'User-Agent': 'Mozilla/5.0',
    },
  })
  if (!fileRes.ok) throw new Error(`ZIP download failed: HTTP ${fileRes.status} for ${filename}`)

  const buffer = Buffer.from(await fileRes.arrayBuffer())
  let rows: any[] = []
  let jsonText = ''

  // Extract JSON from ZIP
  try {
    const unzipped = unzipSync(new Uint8Array(buffer))
    const firstFile = Object.values(unzipped)[0]
    if (!firstFile) throw new Error('Empty ZIP')
    jsonText = new TextDecoder().decode(firstFile)
  } catch {
    jsonText = buffer.toString('utf8')
  }

  try {
    const parsed = JSON.parse(jsonText)
    if (Array.isArray(parsed)) rows = parsed
    else {
      const key = Object.keys(parsed).find(k => Array.isArray(parsed[k]))
      rows = key ? parsed[key] : []
    }
  } catch {
    throw new Error(`Cannot parse JSON from ${dataset.name}: ${jsonText.slice(0, 120)}`)
  }

  let inserted = 0, updated = 0, skipped = 0, batchErrors: string[] = []
  const BATCH = 100
  const isSC = dataset.table === 'licitaciones'
  const isDC = dataset.table === 'carteles'
  const isAF = dataset.table === 'adjudicaciones_firme'
  const isOP = dataset.table === 'ordenes_pedido'
  const isIC = dataset.table === 'instituciones'
  const isP  = dataset.table === 'proveedores'
  const pkField = isSC ? 'numero_procedimiento' : isDC ? 'nro_procedimiento' : isAF ? 'numero_procedimiento' : isOP ? 'numero_orden' : isIC ? 'cedula' : isP ? 'cedula_proveedor' : 'identificador'

  const normalized = rows.map(row => {
    const norm = dataset.normalizer(row)
    if (!norm) return null
    const { raw, ...rest } = norm as any
    return isSC ? { ...rest, keywords: extractKeywords(norm as any) } : rest
  }).filter(Boolean) as any[]

  skipped += rows.length - normalized.length

  // Deduplicate by primary key (SICOP can have dupes in same file)
  const dedupKey = isOP
    ? (r: any) => `${r.numero_orden}__${r.linea_orden_pedido}`
    : (r: any) => r[pkField]
  const deduped = Array.from(
    normalized.reduce((m, r) => m.set(dedupKey(r), r), new Map()).values()
  )
  skipped += normalized.length - deduped.length

  for (let i = 0; i < deduped.length; i += BATCH) {
    const batch = deduped.slice(i, i + BATCH)
    try {
      let result: any[]
      if (isSC) {
        result = await sql`
          insert into licitaciones
            (numero_procedimiento, titulo, institucion, tipo_procedimiento, monto_estimado,
             currency, fecha_publicacion, fecha_cierre, estado, descripcion, keywords)
          select
            r->>'numero_procedimiento',
            r->>'titulo',
            r->>'institucion',
            r->>'tipo_procedimiento',
            (r->>'monto_estimado')::numeric,
            coalesce(r->>'currency', 'CRC'),
            (r->>'fecha_publicacion')::date,
            (r->>'fecha_cierre')::date,
            r->>'estado',
            r->>'descripcion',
            array(select jsonb_array_elements_text(r->'keywords'))
          from jsonb_array_elements(${JSON.stringify(batch)}::jsonb) r
          on conflict (numero_procedimiento) do update set
            titulo             = excluded.titulo,
            institucion        = excluded.institucion,
            tipo_procedimiento = excluded.tipo_procedimiento,
            monto_estimado     = excluded.monto_estimado,
            fecha_cierre       = excluded.fecha_cierre,
            estado             = excluded.estado,
            keywords           = excluded.keywords,
            updated_at         = now()
          returning (xmax = 0) as is_insert
        `
      } else if (isDC) {
        result = await sql`
          insert into carteles
            (nro_procedimiento, fecha_cierre, nombre_unidad_compra, cedula_institucion,
             descripcion, tipo_procedimiento, modalidad, fecha_publicacion,
             fecha_apertura, fecha_inicio_recepcion, nro_sicop, pago_adelantado_pymes)
          select
            r->>'nro_procedimiento',
            (r->>'fecha_cierre')::date,
            r->>'nombre_unidad_compra',
            r->>'cedula_institucion',
            r->>'descripcion',
            r->>'tipo_procedimiento',
            r->>'modalidad',
            (r->>'fecha_publicacion')::date,
            (r->>'fecha_apertura')::date,
            (r->>'fecha_inicio_recepcion')::date,
            r->>'nro_sicop',
            r->>'pago_adelantado_pymes'
          from jsonb_array_elements(${JSON.stringify(batch)}::jsonb) r
          on conflict (nro_procedimiento) do update set
            fecha_cierre           = excluded.fecha_cierre,
            nombre_unidad_compra   = excluded.nombre_unidad_compra,
            cedula_institucion     = excluded.cedula_institucion,
            descripcion            = excluded.descripcion,
            modalidad              = excluded.modalidad,
            fecha_apertura         = excluded.fecha_apertura,
            nro_sicop              = excluded.nro_sicop,
            updated_at             = now()
          returning (xmax = 0) as is_insert
        `
      } else if (isAF) {
        result = await sql`
          insert into adjudicaciones_firme
            (numero_procedimiento, nro_sicop, desierto, permite_recursos,
             fecha_adj_firme, fecha_comunicacion, fecha_maxima_recursos)
          select
            r->>'numero_procedimiento',
            r->>'nro_sicop',
            (r->>'desierto')::boolean,
            (r->>'permite_recursos')::boolean,
            (r->>'fecha_adj_firme')::timestamptz,
            (r->>'fecha_comunicacion')::timestamptz,
            (r->>'fecha_maxima_recursos')::timestamptz
          from jsonb_array_elements(${JSON.stringify(batch)}::jsonb) r
          on conflict (numero_procedimiento) do update set
            desierto               = excluded.desierto,
            permite_recursos       = excluded.permite_recursos,
            fecha_adj_firme        = excluded.fecha_adj_firme,
            fecha_comunicacion     = excluded.fecha_comunicacion,
            fecha_maxima_recursos  = excluded.fecha_maxima_recursos,
            updated_at             = now()
          returning (xmax = 0) as is_insert
        `
      } else if (dataset.table === 'ofertas') {
        result = await sql`
          insert into ofertas
            (identificador, numero_procedimiento, cedula_proveedor, fecha_presenta_oferta,
             estado, id_consorcio, elegible, tipo_oferta, nro_sicop)
          select
            r->>'identificador',
            r->>'numero_procedimiento',
            r->>'cedula_proveedor',
            (r->>'fecha_presenta_oferta')::timestamptz,
            r->>'estado',
            r->>'id_consorcio',
            r->>'elegible',
            r->>'tipo_oferta',
            r->>'nro_sicop'
          from jsonb_array_elements(${JSON.stringify(batch)}::jsonb) r
          on conflict (identificador) do update set
            estado     = excluded.estado,
            elegible   = excluded.elegible,
            updated_at = now()
          returning (xmax = 0) as is_insert
        `
      } else if (isOP) {
        result = await sql`
          insert into ordenes_pedido
            (numero_orden, linea_orden_pedido, numero_orden_pedido, numero_procedimiento,
             nro_contrat, identificador, codigo_producto, secuencia,
             monto_orden_pedido, precio_unitario, cantidad_contratada,
             tipo_moneda, tipo_cambio_crc, descuento, iva, acarreos, otros_impuestos)
          select
            r->>'numero_orden',
            r->>'linea_orden_pedido',
            r->>'numero_orden_pedido',
            r->>'numero_procedimiento',
            r->>'nro_contrat',
            r->>'identificador',
            r->>'codigo_producto',
            r->>'secuencia',
            (r->>'monto_orden_pedido')::numeric,
            (r->>'precio_unitario')::numeric,
            (r->>'cantidad_contratada')::numeric,
            r->>'tipo_moneda',
            (r->>'tipo_cambio_crc')::numeric,
            (r->>'descuento')::numeric,
            (r->>'iva')::numeric,
            (r->>'acarreos')::numeric,
            (r->>'otros_impuestos')::numeric
          from jsonb_array_elements(${JSON.stringify(batch)}::jsonb) r
          on conflict (numero_orden, linea_orden_pedido) do update set
            monto_orden_pedido = excluded.monto_orden_pedido,
            precio_unitario    = excluded.precio_unitario,
            updated_at         = now()
          returning (xmax = 0) as is_insert
        `
      } else if (isIC) {
        result = await sql`
          insert into instituciones
            (cedula, nombre_institucion, representante, direccion, canton, distrito, codigo_postal, telefono)
          select
            r->>'cedula',
            r->>'nombre_institucion',
            r->>'representante',
            r->>'direccion',
            r->>'canton',
            r->>'distrito',
            r->>'codigo_postal',
            r->>'telefono'
          from jsonb_array_elements(${JSON.stringify(batch)}::jsonb) r
          on conflict (cedula) do update set
            nombre_institucion = excluded.nombre_institucion,
            representante      = excluded.representante,
            updated_at         = now()
          returning (xmax = 0) as is_insert
        `
      } else if (isP) {
        result = await sql`
          insert into proveedores
            (cedula_proveedor, nombre_proveedor, tipo_proveedor, tamaño_proveedor,
             provincia, canton, distrito, codigo_postal)
          select
            r->>'cedula_proveedor',
            r->>'nombre_proveedor',
            r->>'tipo_proveedor',
            r->>'tamaño_proveedor',
            r->>'provincia',
            r->>'canton',
            r->>'distrito',
            r->>'codigo_postal'
          from jsonb_array_elements(${JSON.stringify(batch)}::jsonb) r
          on conflict (cedula_proveedor) do update set
            nombre_proveedor = excluded.nombre_proveedor,
            tipo_proveedor   = excluded.tipo_proveedor,
            updated_at       = now()
          returning (xmax = 0) as is_insert
        `
      } else {
        result = await sql`
          insert into contratos
            (identificador, nro_contrato, numero_procedimiento, cedula_proveedor, nro_sicop,
             tipo_modificacion, tipo_disminucion, contrato_modificado, tipo_autorizacion,
             vigencia_contrato, unidad_vigencia, fecha_notificacion, ident_contrato_padre, secuencia)
          select
            r->>'identificador',
            r->>'nro_contrato',
            r->>'numero_procedimiento',
            r->>'cedula_proveedor',
            r->>'nro_sicop',
            r->>'tipo_modificacion',
            r->>'tipo_disminucion',
            r->>'contrato_modificado',
            r->>'tipo_autorizacion',
            r->>'vigencia_contrato',
            r->>'unidad_vigencia',
            (r->>'fecha_notificacion')::timestamptz,
            r->>'ident_contrato_padre',
            r->>'secuencia'
          from jsonb_array_elements(${JSON.stringify(batch)}::jsonb) r
          on conflict (identificador) do update set
            tipo_modificacion  = excluded.tipo_modificacion,
            contrato_modificado = excluded.contrato_modificado,
            fecha_notificacion = excluded.fecha_notificacion,
            updated_at         = now()
          returning (xmax = 0) as is_insert
        `
      }
      for (const r of result) {
        if ((r as any).is_insert) inserted++; else updated++
      }
    } catch (e: any) {
      batchErrors.push(e.message?.slice(0, 100))
      skipped += batch.length
    }
  }

  await sql`
    insert into import_logs (dataset, filename, rows_inserted, rows_updated, rows_skipped)
    values (${dataset.name}, ${'auto-sync'}, ${inserted}, ${updated}, ${skipped})
  `

  return { dataset: dataset.name, total: rows.length, inserted, updated, skipped, firstError: batchErrors[0] ?? null }
}

export async function GET(req: NextRequest) {
  // Protect cron endpoint
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sql = getDb()
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    // On first run use last 90 days to catch up
    const full = req.nextUrl.searchParams.get('full') === 'true'
    const countRows = await sql`select count(*)::int as n from licitaciones`
    const total = (countRows?.[0] as any)?.n ?? 0
    const daysBack = new Date(today); daysBack.setDate(daysBack.getDate() - 15)
    const startDate = (total === 0 || full)
      ? fmtSicop(daysBack)
      : fmtSicop(yesterday)
    const endDate = fmtSicop(today)

    const sessionId = await fetchSession()
    const results = []
    for (const dataset of DATASETS) {
      try {
        const r = await syncDataset(dataset, sessionId, startDate, endDate, sql)
        results.push(r)
      } catch (e: any) {
        results.push({ dataset: dataset.name, error: e.message })
      }
    }
    return NextResponse.json({ ok: true, range: `${startDate}→${endDate}`, results })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message, stack: e.stack?.split('\n').slice(0,3) }, { status: 500 })
  }
}
