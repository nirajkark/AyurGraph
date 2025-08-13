import React, { useState, useRef, useEffect } from 'react'
import { Send, Leaf, MessageCircle, Sparkles, Clock, Bot, User, Zap, Heart, Network } from 'lucide-react'
import { Network as VisNetwork } from 'vis-network'
import { DataSet } from 'vis-data'

const API_URL = import.meta.env?.VITE_API_URL || 'http://127.0.0.1:5000'

export default function App() {
  const [messages, setMessages] = useState([
    {
      from: 'bot', 
      text: 'Namaste! 🙏 Welcome to Ayurvedic Wisdom - your gateway to ancient healing knowledge.\n\nI can help you discover:\n• Traditional herbs and their properties\n• Natural remedies for common ailments\n• Ayurvedic principles and practices\n• Wellness guidance from ancient texts\n\nTry asking: "What herbs help with stress?" or "Remedies for better digestion"',
      timestamp: new Date(),
      type: 'welcome'
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [showGraph, setShowGraph] = useState(false)
  const [graphType, setGraphType] = useState(null) // 'query' or 'full'
  const [fullGraphData, setFullGraphData] = useState(null)
  const [graphLoading, setGraphLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const networkRef = useRef(null)
  const containerRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (showGraph && containerRef.current && (graphType === 'query' || graphType === 'full')) {
      let nodes, edges;
      if (graphType === 'full' && fullGraphData) {
        ({ nodes, edges } = fullGraphData)
      } else if (graphType === 'query' && messages[messages.length - 1]?.kg_data?.visualization) {
        ({ nodes, edges } = messages[messages.length - 1].kg_data.visualization)
      } else {
        return
      }
      if (!nodes.length || !edges.length) {
        setMessages(m => [...m, {
          from: 'bot',
          text: '⚠️ No data available for the knowledge graph. Please try another query or check the server logs.',
          timestamp: new Date(),
          type: 'error'
        }])
        setShowGraph(false)
        return
      }
      const visNodes = new DataSet(nodes.map(node => ({
        ...node,
        font: { size: 12, color: '#1e293b' },
        size: node.group === 'herbs' ? 25 : 20
      })))
      const visEdges = new DataSet(edges.map(edge => ({
        ...edge,
        arrows: 'to',
        color: { color: '#94a3b8' },
        font: { size: 10, align: 'middle' }
      })))
      const options = {
        nodes: {
          borderWidth: 1,
          shadow: true
        },
        edges: {
          width: 2,
          arrows: { to: { enabled: true, scaleFactor: 0.5 } }
        },
        physics: {
          forceAtlas2Based: {
            gravitationalConstant: -50,
            centralGravity: 0.005,
            springLength: 100,
            springConstant: 0.18
          },
          maxVelocity: 50,
          solver: 'forceAtlas2Based',
          timestep: 0.35
        },
        interaction: { 
          zoomView: true, 
          dragView: true, 
          multiselect: true,
          hover: true
        },
        layout: { improvedLayout: true }
      }
      try {
        networkRef.current = new VisNetwork(containerRef.current, { nodes: visNodes, edges: visEdges }, options)
        networkRef.current.stabilize(500)
      } catch (e) {
        console.error("Failed to initialize network:", e)
        setMessages(m => [...m, {
          from: 'bot',
          text: `⚠️ Error rendering graph: ${e.message}. Try refreshing or checking the server logs.`,
          timestamp: new Date(),
          type: 'error'
        }])
      }
    }
  }, [showGraph, graphType, fullGraphData])

  const fetchFullKG = async () => {
    setGraphLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/kg/full`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`)
      }
      const data = await res.json()
      if (data.error) {
        throw new Error(data.error)
      }
      if (!data.nodes.length || !data.edges.length) {
        throw new Error("Received empty knowledge graph data")
      }
      setFullGraphData(data)
      setGraphType('full')
      setShowGraph(true)
    } catch (e) {
      console.error("Failed to fetch full KG:", e)
      setMessages(m => [...m, {
        from: 'bot',
        text: `⚠️ Failed to load full Knowledge Graph: ${e.message}. Please check the server at ${API_URL} and try again.`,
        timestamp: new Date(),
        type: 'error'
      }])
    } finally {
      setGraphLoading(false)
    }
  }

  const send = async () => {
    if (!input.trim() || loading) return
    
    const userMsg = {
      from: 'user', 
      text: input.trim(), 
      timestamp: new Date(),
      type: 'user'
    }
    setMessages(m => [...m, userMsg])
    const currentInput = input.trim()
    setInput('')
    setLoading(true)
    setIsTyping(true)
    setShowGraph(false)
    
    try {
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: currentInput })
      })
      
      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`)
      }
      
      const data = await res.json()
      if (data.error) {
        throw new Error(data.error)
      }
      const botText = formatResults(data)
      
      setMessages(m => [...m, {
        from: 'bot', 
        text: botText, 
        timestamp: new Date(),
        type: data.confidence === 'high' ? 'results' : 'no-results',
        kg_data: data.kg_data
      }])
    } catch (e) {
      setMessages(m => [...m, {
        from: 'bot', 
        text: `🔌 Connection Issue\n\nI'm having trouble connecting to the knowledge base: ${e.message}\n\nPlease check if the server is running at ${API_URL} and try again.`,
        timestamp: new Date(),
        type: 'error'
      }])
    } finally {
      setLoading(false)
      setIsTyping(false)
    }
  }

  const formatResults = (data) => {
    if (data.error) {
      return `❌ Query Error\n\n${data.detail || data.error}\n\nTry rephrasing your question or ask about specific herbs like turmeric, ashwagandha, or neem.`
    }
    
    let responseText = data.response || 'No response available.'

    if (data.kg_data && (data.kg_data.entities?.length > 0 || Object.keys(data.kg_data.relationships || {}).length > 0)) {
      responseText += '\n\n📚 Sources from Knowledge Graph:'
      
      if (data.kg_data.entities?.length > 0) {
        responseText += '\nEntities Found:'
        data.kg_data.entities.forEach(entity => {
          responseText += `\n- ${entity.label} (${entity.type}): ${entity.details.description?.[0] || 'No description available.'}`
        })
      }
      
      if (Object.keys(data.kg_data.relationships || {}).length > 0) {
        responseText += '\nRelationships:'
        Object.entries(data.kg_data.relationships).forEach(([key, items]) => {
          responseText += `\n- ${key}: ${items.map(item => item.conditionLabel || item.herbLabel || item.label || '').join(', ')}`
        })
      }
    } else {
      responseText += '\n\nℹ️ General Ayurvedic guidance provided.'
    }

    return responseText
  }

  const formatTime = (timestamp) => {
    const now = new Date()
    const diff = now - timestamp
    
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const quickQuestions = [
    { text: "Herbs for stress relief", icon: "🧘" },
    { text: "Natural digestive aids", icon: "🌿" },
    { text: "Immunity boosting herbs", icon: "🛡️" },
    { text: "Sleep promoting remedies", icon: "🌙" },
    { text: "Anti-inflammatory herbs", icon: "🔥" },
    { text: "Energy boosting adaptogens", icon: "⚡" }
  ]

  const getMessageIcon = (message) => {
    switch (message.type) {
      case 'welcome': return <Heart size={16} className="text-rose-400" />
      case 'results': return <Sparkles size={16} className="text-emerald-400" />
      case 'error': return <Zap size={16} className="text-amber-400" />
      default: return <Leaf size={16} />
    }
  }

  const getMessageStyle = (message) => {
    const baseClasses = "message-bubble"
    
    if (message.from === 'user') {
      return `${baseClasses} user-message`
    }
    
    switch (message.type) {
      case 'welcome':
        return `${baseClasses} bot-message welcome-message`
      case 'results':
        return `${baseClasses} bot-message results-message`
      case 'no-results':
        return `${baseClasses} bot-message no-results-message`
      case 'error':
        return `${baseClasses} bot-message error-message`
      default:
        return `${baseClasses} bot-message`
    }
  }

  return (
    <div className="app-container">
      {/* Animated Background */}
      <div className="background-animation">
        <div className="floating-leaf leaf-1">🍃</div>
        <div className="floating-leaf leaf-2">🌿</div>
        <div className="floating-leaf leaf-3">🍃</div>
        <div className="floating-leaf leaf-4">🌱</div>
      </div>

      {/* Graph Visualization Modal */}
      {showGraph && (
        <div className="graph-modal">
          <div className="graph-modal-content">
            <button className="graph-close-button" onClick={() => setShowGraph(false)}>
              Close
            </button>
            <h3 className="graph-title">{graphType === 'full' ? 'Full Knowledge Graph' : 'Query Knowledge Graph'}</h3>
            {graphLoading ? (
              <div className="graph-loading">Loading graph...</div>
            ) : (
              <div ref={containerRef} className="graph-container" />
            )}
          </div>
        </div>
      )}

      {/* Header Section */}
      <header className="app-header">
        <div className="header-content">
          <div className="brand-section">
            <div className="brand-icon">
              <Leaf className="leaf-icon" />
              <div className="icon-glow"></div>
            </div>
            <div className="brand-text">
              <h1 className="brand-title">Ayurvedic Wisdom</h1>
              <p className="brand-subtitle">Ancient Knowledge, Modern Discovery</p>
            </div>
          </div>
          <div className="header-stats">
            <div className="stat-item">
              <MessageCircle size={16} />
              <span>{messages.length} messages</span>
            </div>
            <button className="header-button" onClick={fetchFullKG} disabled={graphLoading}>
              <Network size={16} /> {graphLoading ? 'Loading...' : 'View Full KG'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Chat Container */}
      <main className="chat-container">
        <div className="chat-window">
          {/* Messages Area */}
          <div className="messages-container">
            {messages.map((message, index) => (
              <div 
                key={index} 
                className={`message-wrapper ${message.from === 'user' ? 'user-wrapper' : 'bot-wrapper'}`}
              >
                <div className="message-content">
                  {message.from === 'bot' && (
                    <div className="bot-avatar">
                      <Bot size={18} />
                      {getMessageIcon(message)}
                    </div>
                  )}
                  
                  <div className={getMessageStyle(message)}>
                    <div className="message-text">
                      {message.text}
                      {message.kg_data?.visualization?.nodes?.length > 0 && (
                        <button
                          className="view-graph-button"
                          onClick={() => {
                            setGraphType('query')
                            setShowGraph(true)
                          }}
                        >
                          <Network size={16} /> View Knowledge Graph
                        </button>
                      )}
                    </div>
                    <div className="message-meta">
                      <Clock size={12} />
                      <span>{formatTime(message.timestamp)}</span>
                    </div>
                  </div>
                  
                  {message.from === 'user' && (
                    <div className="user-avatar">
                      <User size={18} />
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {/* Typing Indicator */}
            {isTyping && (
              <div className="message-wrapper bot-wrapper">
                <div className="message-content">
                  <div className="bot-avatar">
                    <Bot size={18} />
                  </div>
                  <div className="typing-indicator">
                    <div className="typing-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <span className="typing-text">Consulting ancient texts...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Questions */}
          {messages.length === 1 && !loading && (
            <div className="quick-questions">
              <h3 className="quick-title">
                <Sparkles size={16} />
                Popular Questions
              </h3>
              <div className="questions-grid">
                {quickQuestions.map((question, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInput(question.text)}
                    className="question-card"
                  >
                    <span className="question-icon">{question.icon}</span>
                    <span className="question-text">{question.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="input-section">
            <div className="input-container">
              <div className="input-wrapper">
                <MessageCircle className="input-icon" size={20} />
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      send()
                    }
                  }}
                  placeholder="Ask about herbs, remedies, or wellness practices..."
                  disabled={loading}
                  className="message-input"
                  maxLength={500}
                />
                <div className="input-actions">
                  <span className="char-counter">{input.length}/500</span>
                  <button
                    onClick={send}
                    disabled={loading || !input.trim()}
                    className="send-button"
                  >
                    {loading ? (
                      <Sparkles className="send-icon spinning" size={18} />
                    ) : (
                      <Send className="send-icon" size={18} />
                    )}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="input-footer">
              <p className="disclaimer">
                🌿 Powered by traditional Ayurvedic knowledge • Always consult healthcare professionals for medical advice
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}