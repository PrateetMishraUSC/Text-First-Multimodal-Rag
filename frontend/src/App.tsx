import { useSession } from './hooks/useSession'
import { useChat } from './hooks/useChat'
import { UploadPanel } from './components/UploadPanel'
import { ChatPanel } from './components/ChatPanel'
import './App.css'

function App() {
  const { sessionId, loading } = useSession()
  const { messages, isStreaming, sendMessage, regenerate, clearChat } = useChat(sessionId)

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-loading__spinner" />
        <p>Initializing session...</p>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-header__logo">DocuChat</h1>
        <span className="app-header__tagline">Ask anything from your documents</span>
      </header>

      <main className="app-main">
        <UploadPanel sessionId={sessionId} />
        <ChatPanel
          messages={messages}
          isStreaming={isStreaming}
          onSend={sendMessage}
          onRegenerate={regenerate}
          onClear={clearChat}
        />
      </main>
    </div>
  )
}

export default App
