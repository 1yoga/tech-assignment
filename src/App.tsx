import { ChatView } from './components/ChatView'
import { Login } from './components/Login'
import { Sidebar } from './components/Sidebar'
import { useChat } from './context/ChatContext'

export default function App() {
  const { creds, activeChatId } = useChat()

  if (!creds) {
    return <Login />
  }

  return (
    <div className={`app-shell${activeChatId ? ' chat-open' : ''}`}>
      <Sidebar />
      <ChatView />
    </div>
  )
}
