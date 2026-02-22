import { useState, useEffect } from 'react'

export function useSession() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const existing = sessionStorage.getItem('rag_session_id')
    if (existing) {
      setSessionId(existing)
      setLoading(false)
      return
    }

    fetch('/api/session', { method: 'POST' })
      .then((res) => res.json())
      .then((data) => {
        sessionStorage.setItem('rag_session_id', data.session_id)
        setSessionId(data.session_id)
      })
      .catch((err) => console.error('Failed to create session:', err))
      .finally(() => setLoading(false))
  }, [])

  return { sessionId, loading }
}
