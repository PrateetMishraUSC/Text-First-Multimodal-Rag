import { useRef, useEffect } from 'react'
import { Trash2, MessageSquare } from 'lucide-react'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import type { Message } from '../types'

interface ChatPanelProps {
  messages: Message[]
  isStreaming: boolean
  onSend: (message: string) => void
  onRegenerate: (index: number) => void
  onClear: () => void
}

export function ChatPanel({ messages, isStreaming, onSend, onRegenerate, onClear }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages / tokens
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  return (
    <section className="chat-panel">
      <div className="chat-panel__header">
        <h2 className="chat-panel__title">Chat</h2>
        {messages.length > 0 && (
          <button className="chat-panel__clear" onClick={onClear} title="Clear chat">
            <Trash2 size={16} />
            <span>Clear</span>
          </button>
        )}
      </div>

      <div className="chat-panel__messages" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="chat-panel__empty">
            <MessageSquare size={48} strokeWidth={1} />
            <h3>Ask anything about your documents</h3>
            <p>Upload files on the left, then ask questions here. Your answers will include sources and citations.</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              onRegenerate={() => onRegenerate(idx)}
              isLast={idx === messages.length - 1 && msg.role === 'assistant'}
            />
          ))
        )}
      </div>

      <ChatInput onSend={onSend} disabled={isStreaming} />
    </section>
  )
}
