import { useState } from 'react'
import { ChevronDown, ChevronUp, Info, Table2, Image as ImageIcon } from 'lucide-react'
import type { Source } from '../types'

interface WhyDrawerProps {
  sources: Source[]
  query?: string
  focusChunkId?: number | null
}

function relevancePercent(distance: number): number {
  return Math.max(0, Math.round((1 - distance / 2) * 100))
}

function highlightQuery(text: string, query?: string): React.ReactNode {
  if (!query) return text
  const words = query
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (words.length === 0) return text
  const regex = new RegExp(`(${words.join('|')})`, 'gi')
  const parts = text.split(regex)
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="highlight">
        {part}
      </mark>
    ) : (
      part
    )
  )
}

function ChunkTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'table':
      return <Table2 size={13} className="chunk-card__type-icon chunk-card__type-icon--table" />
    case 'figure':
      return <ImageIcon size={13} className="chunk-card__type-icon chunk-card__type-icon--figure" />
    default:
      return null
  }
}

function ChunkTypeBadge({ type }: { type: string }) {
  if (type === 'text') return null
  const label = type === 'table' ? 'Table' : 'Figure'
  return <span className={`chunk-card__type-badge chunk-card__type-badge--${type}`}>{label}</span>
}

export function WhyDrawer({ sources, query, focusChunkId }: WhyDrawerProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (sources.length === 0) return null

  const uniqueFiles = new Set(sources.map((s) => s.source_file)).size
  const tableCount = sources.filter((s) => s.chunk_type === 'table').length
  const figureCount = sources.filter((s) => s.chunk_type === 'figure').length

  return (
    <div className={`why-drawer ${isOpen ? 'why-drawer--open' : ''}`}>
      <button className="why-drawer__toggle" onClick={() => setIsOpen(!isOpen)}>
        <Info size={14} />
        <span>Why this answer?</span>
        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {isOpen && (
        <div className="why-drawer__content">
          <p className="why-drawer__summary">
            Used <strong>{sources.length} chunks</strong> from{' '}
            <strong>{uniqueFiles} document{uniqueFiles !== 1 ? 's' : ''}</strong>
            {tableCount > 0 && (
              <span className="why-drawer__stat">
                <Table2 size={12} /> {tableCount} table{tableCount !== 1 ? 's' : ''}
              </span>
            )}
            {figureCount > 0 && (
              <span className="why-drawer__stat">
                <ImageIcon size={12} /> {figureCount} figure{figureCount !== 1 ? 's' : ''}
              </span>
            )}
          </p>

          <div className="why-drawer__chunks">
            {sources.map((source) => (
              <div
                key={source.chunk_id}
                className={`chunk-card ${focusChunkId === source.chunk_id ? 'chunk-card--focused' : ''}`}
                id={`chunk-${source.chunk_id}`}
              >
                <div className="chunk-card__header">
                  <span className="chunk-card__id">
                    <ChunkTypeIcon type={source.chunk_type} />
                    Chunk #{source.chunk_id}
                  </span>
                  <ChunkTypeBadge type={source.chunk_type} />
                  <span className="chunk-card__source">
                    {source.source_file} — {source.section || `Page ${source.page + 1}`}
                  </span>
                  <span className="chunk-card__relevance">
                    {relevancePercent(source.distance)}% relevant
                  </span>
                </div>

                {/* Render asset preview for tables and figures */}
                {source.asset_url && (source.chunk_type === 'table' || source.chunk_type === 'figure') && (
                  <div className="chunk-card__asset-preview">
                    <img
                      src={source.asset_url}
                      alt={source.section || `${source.chunk_type} preview`}
                      className="chunk-card__asset-img"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  </div>
                )}

                <p className="chunk-card__preview">
                  {highlightQuery(source.text_preview, query)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
