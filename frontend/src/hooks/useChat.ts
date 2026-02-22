import { useState, useRef, useCallback } from 'react'
import type { Message, Source } from '../types'

export function useChat(sessionId: string | null) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

  const closeStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [])

  const sendMessage = useCallback(
    (query: string) => {
      if (!sessionId || !query.trim() || isStreaming) return

      closeStream()

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: query.trim(),
        sources: [],
        status: 'complete',
        query: query.trim(),
      }

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        sources: [],
        status: 'streaming',
        query: query.trim(),
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setIsStreaming(true)

      const url = `/api/chat?query=${encodeURIComponent(query.trim())}&session_id=${sessionId}&top_k=5`
      const es = new EventSource(url)
      eventSourceRef.current = es

      const assistantId = assistantMsg.id

      es.addEventListener('sources', (e: MessageEvent) => {
        const sources: Source[] = JSON.parse(e.data)
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, sources } : m))
        )
      })

      es.addEventListener('token', (e: MessageEvent) => {
        const { token } = JSON.parse(e.data)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + token } : m
          )
        )
      })

      es.addEventListener('done', (e: MessageEvent) => {
        const { status } = JSON.parse(e.data)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, status: status === 'no_context' ? 'no_context' : 'complete' } : m
          )
        )
        setIsStreaming(false)
        es.close()
        eventSourceRef.current = null
      })

      es.onerror = () => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, status: 'error', content: m.content || 'Connection lost. Please try again.' }
              : m
          )
        )
        setIsStreaming(false)
        es.close()
        eventSourceRef.current = null
      }
    },
    [sessionId, isStreaming, closeStream]
  )

  const regenerate = useCallback(
    (messageIndex: number) => {
      const targetMsg = messages[messageIndex]
      if (!targetMsg || targetMsg.role !== 'assistant') return

      // Find the user message right before this assistant message
      const userMsg = messages[messageIndex - 1]
      if (!userMsg || userMsg.role !== 'user') return

      // Remove messages from this point onwards
      setMessages((prev) => prev.slice(0, messageIndex - 1))

      // Re-send the query
      setTimeout(() => sendMessage(userMsg.content), 50)
    },
    [messages, sendMessage]
  )

  const clearChat = useCallback(() => {
    closeStream()
    setMessages([])
    setIsStreaming(false)
  }, [closeStream])

  return { messages, isStreaming, sendMessage, regenerate, clearChat }
}
