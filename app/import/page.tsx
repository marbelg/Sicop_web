'use client'
import { useState, useRef } from 'react'

export default function ImportPage() {
  const [file, setFile]       = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<any>(null)
  const [error, setError]     = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File | null) => {
    setFile(f)
    setResult(null)
    setError(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    handleFile(e.dataTransfer.files[0] ?? null)
  }

  const handleImport = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A1628', color: '#E2E8F0', fontFamily: 'system-ui, sans-serif', padding: '40px 24px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Importar datos SICOP</h1>
        <p style={{ color: '#64748B', fontSize: 14, marginBottom: 32 }}>
          Sube el archivo CSV o Excel descargado del portal de datos abiertos del SICOP.
        </p>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${file ? '#9ED23A' : '#1E3A5F'}`,
            borderRadius: 12,
            padding: '48px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            background: file ? 'rgba(158,210,58,0.05)' : '#0F1F35',
            transition: 'all 0.2s',
            marginBottom: 24,
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
              <p style={{ fontWeight: 600, color: '#9ED23A' }}>{file.name}</p>
              <p style={{ fontSize: 13, color: '#64748B' }}>{(file.size / 1024).toFixed(1)} KB</p>
            </>
          ) : (
            <>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
              <p style={{ fontWeight: 600 }}>Arrastra el archivo aquí</p>
              <p style={{ fontSize: 13, color: '#64748B' }}>o haz clic para seleccionar · CSV, XLSX, XLS</p>
            </>
          )}
        </div>

        {file && !result && (
          <button
            onClick={handleImport}
            disabled={loading}
            style={{
              width: '100%', padding: '14px', borderRadius: 8, border: 'none',
              background: loading ? '#1E3A5F' : '#9ED23A', color: loading ? '#64748B' : '#0A1628',
              fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Procesando...' : 'Importar datos'}
          </button>
        )}

        {error && (
          <div style={{ marginTop: 16, padding: 16, background: 'rgba(239,68,68,0.1)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', color: '#F87171' }}>
            {error}
          </div>
        )}

        {result && (
          <div style={{ marginTop: 16, padding: 24, background: '#0F1F35', borderRadius: 12, border: '1px solid #1E3A5F' }}>
            <p style={{ fontWeight: 700, color: '#9ED23A', marginBottom: 16, fontSize: 16 }}>✓ Importación completada</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {[
                { label: 'Nuevas', value: result.inserted, color: '#9ED23A' },
                { label: 'Actualizadas', value: result.updated, color: '#378ADD' },
                { label: 'Omitidas', value: result.skipped, color: '#64748B' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center', padding: 16, background: '#0A1628', borderRadius: 8 }}>
                  <p style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</p>
                  <p style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>{s.label}</p>
                </div>
              ))}
            </div>
            <p style={{ marginTop: 16, fontSize: 13, color: '#64748B', textAlign: 'center' }}>
              Total procesadas: {result.total} filas
            </p>
            <button
              onClick={() => { setFile(null); setResult(null); if (inputRef.current) inputRef.current.value = '' }}
              style={{ marginTop: 16, width: '100%', padding: 10, borderRadius: 8, border: '1px solid #1E3A5F', background: 'transparent', color: '#9ED23A', cursor: 'pointer', fontSize: 13 }}
            >
              Importar otro archivo
            </button>
          </div>
        )}

        <div style={{ marginTop: 40, padding: 16, background: '#0F1F35', borderRadius: 8, border: '1px solid #1E3A5F' }}>
          <p style={{ fontSize: 12, color: '#64748B', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cómo descargar los datos del SICOP</p>
          <ol style={{ fontSize: 13, color: '#94A3B8', lineHeight: 1.8, paddingLeft: 20, margin: 0 }}>
            <li>Ingresa al portal de datos abiertos del SICOP</li>
            <li>Selecciona el dataset de <strong style={{ color: '#E2E8F0' }}>Procedimientos</strong> o <strong style={{ color: '#E2E8F0' }}>Adjudicaciones</strong></li>
            <li>Descarga el archivo en formato CSV o Excel</li>
            <li>Sube el archivo aquí</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
