import { useState } from 'react'
import { Copy, RefreshCw, Check } from 'lucide-react'

interface MessageActionsProps {
  content: string
  onRegenerate: () => void
  showRegenerate?: boolean
}

export function MessageActions({ content, onRegenerate, showRegenerate = true }: MessageActionsProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard may not be available */
    }
  }

  return (
    <div className="message-actions">
      <button className="message-action" onClick={handleCopy} title="Copy">
        {copied ? <Check size={14} /> : <Copy size={14} />}
        <span>{copied ? 'Copied' : 'Copy'}</span>
      </button>
      {showRegenerate && (
        <button className="message-action" onClick={onRegenerate} title="Regenerate">
          <RefreshCw size={14} />
          <span>Regenerate</span>
        </button>
      )}
    </div>
  )
}
