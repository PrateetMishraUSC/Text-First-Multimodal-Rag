import { FileText, Table2, Image as ImageIcon } from 'lucide-react'
import type { Source } from '../types'

interface SourceBadgesProps {
  sources: Source[]
  onBadgeClick?: (chunkId: number) => void
}

function SourceIcon({ type }: { type: string }) {
  switch (type) {
    case 'table':
      return <Table2 size={12} />
    case 'figure':
      return <ImageIcon size={12} />
    default:
      return <FileText size={12} />
  }
}

export function SourceBadges({ sources, onBadgeClick }: SourceBadgesProps) {
  if (sources.length === 0) return null

  // Deduplicate by source_file + page
  const unique = sources.reduce<Source[]>((acc, s) => {
    const exists = acc.some(
      (a) => a.source_file === s.source_file && a.page === s.page && a.chunk_type === s.chunk_type
    )
    if (!exists) acc.push(s)
    return acc
  }, [])

  return (
    <div className="source-badges">
      {unique.map((s) => (
        <button
          key={s.chunk_id}
          className={`source-badge source-badge--${s.chunk_type || 'text'}`}
          onClick={() => onBadgeClick?.(s.chunk_id)}
          title={`${s.source_file} — ${s.section || `Page ${s.page + 1}`}`}
        >
          <SourceIcon type={s.chunk_type} />
          <span>{s.source_file}</span>
          <span className="source-badge__page">
            {s.section ? s.section : `p.${s.page + 1}`}
          </span>
        </button>
      ))}
    </div>
  )
}
