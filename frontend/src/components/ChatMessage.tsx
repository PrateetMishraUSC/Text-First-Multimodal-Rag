import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { User, Bot } from 'lucide-react'
import { MessageActions } from './MessageActions'
import { SourceBadges } from './SourceBadges'
import { WhyDrawer } from './WhyDrawer'
import type { Message } from '../types'

interface ChatMessageProps {
  message: Message
  onRegenerate: () => void
  isLast: boolean
}

export function ChatMessage({ message, onRegenerate, isLast }: ChatMessageProps) {
  const [focusChunkId, setFocusChunkId] = useState<number | null>(null)
  const isUser = message.role === 'user'
  const isStreaming = message.status === 'streaming'

  return (
    <div className={`chat-message chat-message--${message.role}`}>
      <div className="chat-message__avatar">
        {isUser ? <User size={18} /> : <Bot size={18} />}
      </div>

      <div className="chat-message__body">
        <div className="chat-message__bubble">
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <>
              {message.content ? (
                <ReactMarkdown>{message.content}</ReactMarkdown>
              ) : isStreaming ? (
                <div className="typing-indicator">
                  <span></span><span></span><span></span>
                </div>
              ) : null}
            </>
          )}
        </div>

        {!isUser && message.status !== 'streaming' && message.content && (
          <>
            <SourceBadges
              sources={message.sources}
              onBadgeClick={(id) => setFocusChunkId(id === focusChunkId ? null : id)}
            />
            <WhyDrawer
              sources={message.sources}
              query={message.query}
              focusChunkId={focusChunkId}
            />
            <MessageActions
              content={message.content}
              onRegenerate={onRegenerate}
              showRegenerate={isLast}
            />
          </>
        )}
      </div>
    </div>
  )
}
