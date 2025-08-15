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
  const [currentGraphData, setCurrentGraphData] = useState(null) // Current graph data to display
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
    if (showGraph && containerRef.current && currentGraphData) {
      const { nodes, edges } = currentGraphData;
      
      // Clean up existing network and DataSet
      if (networkRef.current) {
        try {
          networkRef.current.destroy();
          networkRef.current = null;
        } catch (e) {
          console.warn("Error destroying previous network:", e);
        }
      }

      // Clear container
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      
      // Validate data structure
      if (!nodes || !Array.isArray(nodes)) {
        console.error("Invalid graph data structure: nodes missing or not an array", currentGraphData);
        setMessages(m => [...m, {
          from: 'bot',
          text: '⚠️ Invalid knowledge graph data structure. Please try another query.',
          timestamp: new Date(),
          type: 'error'
        }]);
        setShowGraph(false);
        return;
      }

      if (nodes.length === 0) {
        console.warn("Empty graph data: no nodes", { nodes: nodes.length });
        setMessages(m => [...m, {
          from: 'bot',
          text: '⚠️ No nodes available for the knowledge graph. Please try another query or check the server logs.',
          timestamp: new Date(),
          type: 'error'
        }]);
        setShowGraph(false);
        return;
      }

      try {
        // Generate unique IDs for nodes and create a mapping
        const nodeIdMap = new Map();
        const processedNodes = nodes.map((node, index) => {
          const uniqueId = `node_${index}_${Date.now()}_${Math.random()}`;
          nodeIdMap.set(node.id, uniqueId); // Map original ID to new unique ID
          return {
            ...node,
            id: uniqueId,
            font: { size: 12, color: '#1e293b' },
            size: node.group === 'herbs' ? 25 : 20
          };
        });
        
        // Process edges and map from/to IDs
        const processedEdges = (Array.isArray(edges) ? edges : [])
          .filter(edge => {
            const isValid = edge.from && edge.to;
            if (!isValid) {
              console.warn("Invalid edge filtered out:", edge);
              return false;
            }
            if (edge.from === edge.to) {
              console.warn("Self-loop detected:", edge);
              setMessages(m => [...m, {
                from: 'bot',
                text: `⚠️ Detected self-loop in knowledge graph for node '${edge.from}'. Check server logs for data issues.`,
                timestamp: new Date(),
                type: 'warning'
              }]);
              return false;
            }
            return true;
          })
          .map((edge, index) => ({
            ...edge,
            id: `edge_${index}_${Date.now()}_${Math.random()}`,
            from: nodeIdMap.get(edge.from) || edge.from,
            to: nodeIdMap.get(edge.to) || edge.to,
            arrows: {
              to: { enabled: true, type: 'arrow', scaleFactor: 0.75 }
            },
            color: { color: '#64748b', highlight: '#3b82f6' },
            font: { size: 10, align: 'middle', color: '#1e293b' },
            width: 2
          }));

        if (edges.length > 0 && processedEdges.length === 0) {
          console.warn("All edges were filtered out due to invalid from/to fields or self-loops", { originalEdges: edges });
          setMessages(m => [...m, {
            from: 'bot',
            text: '⚠️ No valid edges found for the knowledge graph. Displaying nodes only. Check server logs for edge data issues.',
            timestamp: new Date(),
            type: 'warning'
          }]);
        }

        console.log("Creating graph with:", { 
          nodes: processedNodes.length, 
          edges: processedEdges.length,
          nodeIds: processedNodes.map(n => n.id).slice(0, 5),
          edgeIds: processedEdges.map(e => e.id).slice(0, 5),
          edgeDetails: processedEdges.map(e => ({ from: e.from, to: e.to, label: e.label })).slice(0, 5)
        });

        // Create new DataSet instances
        const visNodes = new DataSet([]);
        const visEdges = new DataSet([]);
        
        // Add processed nodes and edges
        visNodes.add(processedNodes);
        visEdges.add(processedEdges);
        
        const options = {
          nodes: {
            borderWidth: 1,
            shadow: {
              enabled: true,
              size: 5,
              x: 2,
              y: 2
            },
            shape: 'dot'
          },
          edges: {
            width: 2,
            arrows: {
              to: {
                enabled: true,
                type: 'arrow',
                scaleFactor: 0.75
              }
            },
            color: {
              color: '#64748b',
              highlight: '#3b82f6',
              opacity: 1.0
            },
            smooth: {
              enabled: true,
              type: 'continuous'
            }
          },
          physics: {
            forceAtlas2Based: {
              gravitationalConstant: -50,
              centralGravity: 0.005,
              springLength: 100,
              springConstant: 0.18,
              avoidOverlap: 0.5
            },
            maxVelocity: 50,
            solver: 'forceAtlas2Based',
            timestep: 0.35,
            stabilization: {
              enabled: true,
              iterations: 1000
            }
          },
          interaction: { 
            zoomView: true, 
            dragView: true, 
            multiselect: true,
            hover: true
          },
          layout: { improvedLayout: true }
        };
        
        networkRef.current = new VisNetwork(containerRef.current, { nodes: visNodes, edges: visEdges }, options);
        networkRef.current.stabilize(1000);
        
        console.log("Network created successfully");
      } catch (e) {
        console.error("Failed to initialize network:", e);
        setMessages(m => [...m, {
          from: 'bot',
          text: `⚠️ Error rendering graph: ${e.message}. Try refreshing or checking the server logs.`,
          timestamp: new Date(),
          type: 'error'
        }]);
        setShowGraph(false);
      }
    }
  }, [showGraph, currentGraphData])

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
      
      // Validate data structure
      if (!data.nodes || !Array.isArray(data.nodes)) {
        throw new Error("Invalid knowledge graph data structure from server: nodes missing or not an array")
      }
      
      if (data.nodes.length === 0) {
        throw new Error("Received empty knowledge graph nodes")
      }
      
      // Generate unique IDs and validate edges
      const nodeIdMap = new Map();
      const processedNodes = data.nodes.map((node, index) => {
        const uniqueId = `node_${index}_${Date.now()}_${Math.random()}`;
        nodeIdMap.set(node.id, uniqueId);
        return {
          ...node,
          id: uniqueId
        };
      });
      
      const processedEdges = (Array.isArray(data.edges) ? data.edges : [])
        .filter(edge => {
          const isValid = edge.from && edge.to && edge.from !== edge.to;
          if (!isValid) {
            console.warn("Invalid edge or self-loop filtered out in fetchFullKG:", edge);
          }
          return isValid;
        })
        .map((edge, index) => ({
          ...edge,
          id: `edge_${index}_${Date.now()}_${Math.random()}`,
          from: nodeIdMap.get(edge.from) || edge.from,
          to: nodeIdMap.get(edge.to) || edge.to
        }));
      
      const processedData = { nodes: processedNodes, edges: processedEdges };
      
      setFullGraphData(processedData)
      setCurrentGraphData(processedData)
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

  const processResponseText = (text) => {
    // Convert Markdown **text** to <b>text</b> and remove any stray asterisks
    let processed = text
      .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') // Convert **text** to <b>text</b>
      .replace(/\*(.*?)\*/g, '<b>$1</b>')     // Convert *text* to <b>text</b>
      .replace(/\*/g, '');                    // Remove any remaining single asterisks
    return processed;
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
      
      // Log visualization data for debugging
      if (data.kg_data?.visualization) {
        console.log("Visualization data received:", {
          nodes: data.kg_data.visualization.nodes,
          edges: data.kg_data.visualization.edges,
          nodeIds: data.kg_data.visualization.nodes.map(n => n.id),
          edgeIds: data.kg_data.visualization.edges.map(e => e.id),
          edgeDetails: data.kg_data.visualization.edges?.map(e => ({ from: e.from, to: e.to, label: e.label }))
        });
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
      console.error("API Error:", e)
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
    
    let responseText = processResponseText(data.response || 'No response available.')

    // Add KG sources section if KG data exists
    if (data.kg_data && (
        (data.kg_data.entities && data.kg_data.entities.length > 0) || 
        (data.kg_data.relationships && Object.keys(data.kg_data.relationships).length > 0)
      )) {
      responseText += '\n\n📚 Sources from Knowledge Graph:'
      
      if (data.kg_data.entities && data.kg_data.entities.length > 0) {
        responseText += '\nEntities Found:'
        data.kg_data.entities.slice(0, 5).forEach(entity => {
          const description = entity.details?.description?.[0] || 'No description available'
          responseText += `\n- ${entity.label} (${entity.type}): ${description}`
        })
      }
      
      if (data.kg_data.relationships && Object.keys(data.kg_data.relationships).length > 0) {
        responseText += '\nRelationships:'
        Object.entries(data.kg_data.relationships).forEach(([key, items]) => {
          const cleanKey = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()
          if (Array.isArray(items) && items.length > 0) {
            const relationshipItems = items.slice(0, 5).map(item => 
              `${item.fromLabel} -> ${item.toLabel} (${item.relation})`
            ).join(', ')
            responseText += `\n- ${cleanKey}: ${relationshipItems}`
          }
        })
      }
    }

    return responseText
  }

  const showQueryGraph = (kgData) => {
    console.log("Attempting to show query graph:", kgData)
    
    // Clean up any existing network first
    if (networkRef.current) {
      try {
        networkRef.current.destroy()
        networkRef.current = null
      } catch (e) {
        console.warn("Error cleaning up network:", e)
      }
    }
    
    if (!kgData || !kgData.visualization) {
      console.error("No visualization data available:", kgData)
      setMessages(m => [...m, {
        from: 'bot',
        text: '⚠️ No visualization data available for this query.',
        timestamp: new Date(),
        type: 'error'
      }])
      return
    }

    const { nodes, edges } = kgData.visualization
    
    if (!nodes || !Array.isArray(nodes)) {
      console.error("Invalid visualization data structure: nodes missing or not an array", kgData.visualization)
      setMessages(m => [...m, {
        from: 'bot',
        text: '⚠️ Invalid knowledge graph data structure.',
        timestamp: new Date(),
        type: 'error'
      }])
      return
    }

    if (nodes.length === 0) {
      console.warn("Empty visualization data: no nodes", { nodes: nodes.length })
      setMessages(m => [...m, {
        from: 'bot',
        text: '⚠️ No nodes available for visualization.',
        timestamp: new Date(),
        type: 'error'
      }])
      return
    }

    // Generate unique node IDs and create a mapping
    const nodeIdMap = new Map();
    const processedNodes = nodes.map((node, index) => {
      const uniqueId = `node_${index}_${Date.now()}_${Math.random()}`;
      nodeIdMap.set(node.id, uniqueId);
      return {
        ...node,
        id: uniqueId
      };
    });

    // Process edges and map from/to IDs
    const validEdges = (Array.isArray(edges) ? edges : [])
      .filter(edge => {
        const isValid = edge.from && edge.to && edge.from !== edge.to;
        if (!isValid) {
          console.warn("Invalid edge or self-loop filtered out in showQueryGraph:", edge);
          return false;
        }
        return true;
      })
      .map((edge, index) => ({
        ...edge,
        id: `edge_${index}_${Date.now()}_${Math.random()}`,
        from: nodeIdMap.get(edge.from) || edge.from,
        to: nodeIdMap.get(edge.to) || edge.to
      }));

    if (edges?.length > 0 && validEdges.length === 0) {
      console.warn("All edges were filtered out due to invalid from/to fields or self-loops", { originalEdges: edges });
      setMessages(m => [...m, {
        from: 'bot',
        text: '⚠️ No valid edges found for the knowledge graph. Displaying nodes only. Check server logs for edge data issues.',
        timestamp: new Date(),
        type: 'warning'
      }]);
    }

    console.log("Setting up query graph with:", { 
      nodes: processedNodes.length, 
      edges: validEdges.length,
      edgeDetails: validEdges.map(e => ({ from: e.from, to: e.to, label: e.label })).slice(0, 5)
    })
    
    // Create graph data with processed nodes and edges
    const graphDataCopy = {
      nodes: processedNodes,
      edges: validEdges
    }
    
    setCurrentGraphData(graphDataCopy)
    setGraphType('query')
    setShowGraph(true)
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
      case 'warning': return <Zap size={16} className="text-yellow-400" />
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
      case 'warning':
        return `${baseClasses} bot-message warning-message`
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
            <button className="graph-close-button" onClick={() => {
              setShowGraph(false)
              // Clean up network when closing
              if (networkRef.current) {
                try {
                  networkRef.current.destroy()
                  networkRef.current = null
                } catch (e) {
                  console.warn("Error cleaning up network on close:", e)
                }
              }
            }}>
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
                    <div 
                      className="message-text" 
                      dangerouslySetInnerHTML={{ __html: processResponseText(message.text) }}
                    />
                    <div className="message-meta">
                      <Clock size={12} />
                      <span>{formatTime(message.timestamp)}</span>
                    </div>
                    {message.kg_data?.visualization?.nodes?.length > 0 && (
                      <button
                        className="view-graph-button"
                        onClick={() => showQueryGraph(message.kg_data)}
                      >
                        <Network size={16} /> View Knowledge Graph
                      </button>
                    )}
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





















// import React, { useState, useRef, useEffect } from 'react'
// import { Send, Leaf, MessageCircle, Sparkles, Clock, Bot, User, Zap, Heart, Network } from 'lucide-react'
// import { Network as VisNetwork } from 'vis-network'
// import { DataSet } from 'vis-data'

// const API_URL = import.meta.env?.VITE_API_URL || 'http://127.0.0.1:5000'

// export default function App() {
//   const [messages, setMessages] = useState([
//     {
//       from: 'bot', 
//       text: 'Namaste! 🙏 Welcome to Ayurvedic Wisdom - your gateway to ancient healing knowledge.\n\nI can help you discover:\n• Traditional herbs and their properties\n• Natural remedies for common ailments\n• Ayurvedic principles and practices\n• Wellness guidance from ancient texts\n\nTry asking: "What herbs help with stress?" or "Remedies for better digestion"',
//       timestamp: new Date(),
//       type: 'welcome'
//     }
//   ])
//   const [input, setInput] = useState('')
//   const [loading, setLoading] = useState(false)
//   const [isTyping, setIsTyping] = useState(false)
//   const [showGraph, setShowGraph] = useState(false)
//   const [graphType, setGraphType] = useState(null) // 'query' or 'full'
//   const [currentGraphData, setCurrentGraphData] = useState(null) // Current graph data to display
//   const [fullGraphData, setFullGraphData] = useState(null)
//   const [graphLoading, setGraphLoading] = useState(false)
//   const messagesEndRef = useRef(null)
//   const inputRef = useRef(null)
//   const networkRef = useRef(null)
//   const containerRef = useRef(null)

//   const scrollToBottom = () => {
//     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
//   }

//   useEffect(() => {
//     scrollToBottom()
//   }, [messages])

//   useEffect(() => {
//     inputRef.current?.focus()
//   }, [])

//   useEffect(() => {
//     if (showGraph && containerRef.current && currentGraphData) {
//       const { nodes, edges } = currentGraphData;
      
//       // Clean up existing network and DataSet
//       if (networkRef.current) {
//         try {
//           networkRef.current.destroy();
//           networkRef.current = null;
//         } catch (e) {
//           console.warn("Error destroying previous network:", e);
//         }
//       }

//       // Clear container
//       if (containerRef.current) {
//         containerRef.current.innerHTML = '';
//       }
      
//       // Validate data structure
//       if (!nodes || !Array.isArray(nodes)) {
//         console.error("Invalid graph data structure: nodes missing or not an array", currentGraphData);
//         setMessages(m => [...m, {
//           from: 'bot',
//           text: '⚠️ Invalid knowledge graph data structure. Please try another query.',
//           timestamp: new Date(),
//           type: 'error'
//         }]);
//         setShowGraph(false);
//         return;
//       }

//       if (nodes.length === 0) {
//         console.warn("Empty graph data: no nodes", { nodes: nodes.length });
//         setMessages(m => [...m, {
//           from: 'bot',
//           text: '⚠️ No nodes available for the knowledge graph. Please try another query or check the server logs.',
//           timestamp: new Date(),
//           type: 'error'
//         }]);
//         setShowGraph(false);
//         return;
//       }

//       try {
//         // Generate unique IDs for nodes and create a mapping
//         const nodeIdMap = new Map();
//         const processedNodes = nodes.map((node, index) => {
//           const uniqueId = `node_${index}_${Date.now()}_${Math.random()}`;
//           nodeIdMap.set(node.id, uniqueId); // Map original ID to new unique ID
//           return {
//             ...node,
//             id: uniqueId,
//             font: { size: 12, color: '#1e293b' },
//             size: node.group === 'herbs' ? 25 : 20
//           };
//         });
        
//         // Process edges and map from/to IDs
//         const processedEdges = (Array.isArray(edges) ? edges : [])
//           .filter(edge => {
//             const isValid = edge.from && edge.to;
//             if (!isValid) {
//               console.warn("Invalid edge filtered out:", edge);
//               return false;
//             }
//             if (edge.from === edge.to) {
//               console.warn("Self-loop detected:", edge);
//               setMessages(m => [...m, {
//                 from: 'bot',
//                 text: `⚠️ Detected self-loop in knowledge graph for node '${edge.from}'. Check server logs for data issues.`,
//                 timestamp: new Date(),
//                 type: 'warning'
//               }]);
//               return false;
//             }
//             return true;
//           })
//           .map((edge, index) => ({
//             ...edge,
//             id: `edge_${index}_${Date.now()}_${Math.random()}`,
//             from: nodeIdMap.get(edge.from) || edge.from,
//             to: nodeIdMap.get(edge.to) || edge.to,
//             arrows: {
//               to: { enabled: true, type: 'arrow', scaleFactor: 0.75 }
//             },
//             color: { color: '#64748b', highlight: '#3b82f6' },
//             font: { size: 10, align: 'middle', color: '#1e293b' },
//             width: 2
//           }));

//         if (edges.length > 0 && processedEdges.length === 0) {
//           console.warn("All edges were filtered out due to invalid from/to fields or self-loops", { originalEdges: edges });
//           setMessages(m => [...m, {
//             from: 'bot',
//             text: '⚠️ No valid edges found for the knowledge graph. Displaying nodes only. Check server logs for edge data issues.',
//             timestamp: new Date(),
//             type: 'warning'
//           }]);
//         }

//         console.log("Creating graph with:", { 
//           nodes: processedNodes.length, 
//           edges: processedEdges.length,
//           nodeIds: processedNodes.map(n => n.id).slice(0, 5),
//           edgeIds: processedEdges.map(e => e.id).slice(0, 5),
//           edgeDetails: processedEdges.map(e => ({ from: e.from, to: e.to, label: e.label })).slice(0, 5)
//         });

//         // Create new DataSet instances
//         const visNodes = new DataSet([]);
//         const visEdges = new DataSet([]);
        
//         // Add processed nodes and edges
//         visNodes.add(processedNodes);
//         visEdges.add(processedEdges);
        
//         const options = {
//           nodes: {
//             borderWidth: 1,
//             shadow: {
//               enabled: true,
//               size: 5,
//               x: 2,
//               y: 2
//             },
//             shape: 'dot'
//           },
//           edges: {
//             width: 2,
//             arrows: {
//               to: {
//                 enabled: true,
//                 type: 'arrow',
//                 scaleFactor: 0.75
//               }
//             },
//             color: {
//               color: '#64748b',
//               highlight: '#3b82f6',
//               opacity: 1.0
//             },
//             smooth: {
//               enabled: true,
//               type: 'continuous'
//             }
//           },
//           physics: {
//             forceAtlas2Based: {
//               gravitationalConstant: -50,
//               centralGravity: 0.005,
//               springLength: 100,
//               springConstant: 0.18,
//               avoidOverlap: 0.5
//             },
//             maxVelocity: 50,
//             solver: 'forceAtlas2Based',
//             timestep: 0.35,
//             stabilization: {
//               enabled: true,
//               iterations: 1000
//             }
//           },
//           interaction: { 
//             zoomView: true, 
//             dragView: true, 
//             multiselect: true,
//             hover: true
//           },
//           layout: { improvedLayout: true }
//         };
        
//         networkRef.current = new VisNetwork(containerRef.current, { nodes: visNodes, edges: visEdges }, options);
//         networkRef.current.stabilize(1000);
        
//         console.log("Network created successfully");
//       } catch (e) {
//         console.error("Failed to initialize network:", e);
//         setMessages(m => [...m, {
//           from: 'bot',
//           text: `⚠️ Error rendering graph: ${e.message}. Try refreshing or checking the server logs.`,
//           timestamp: new Date(),
//           type: 'error'
//         }]);
//         setShowGraph(false);
//       }
//     }
//   }, [showGraph, currentGraphData])

//   const fetchFullKG = async () => {
//     setGraphLoading(true)
//     try {
//       const res = await fetch(`${API_URL}/api/kg/full`, {
//         method: 'GET',
//         headers: { 'Content-Type': 'application/json' }
//       })
//       if (!res.ok) {
//         throw new Error(`Server error: ${res.status}`)
//       }
//       const data = await res.json()
//       if (data.error) {
//         throw new Error(data.error)
//       }
      
//       // Validate data structure
//       if (!data.nodes || !Array.isArray(data.nodes)) {
//         throw new Error("Invalid knowledge graph data structure from server: nodes missing or not an array")
//       }
      
//       if (data.nodes.length === 0) {
//         throw new Error("Received empty knowledge graph nodes")
//       }
      
//       // Generate unique IDs and validate edges
//       const nodeIdMap = new Map();
//       const processedNodes = data.nodes.map((node, index) => {
//         const uniqueId = `node_${index}_${Date.now()}_${Math.random()}`;
//         nodeIdMap.set(node.id, uniqueId);
//         return {
//           ...node,
//           id: uniqueId
//         };
//       });
      
//       const processedEdges = (Array.isArray(data.edges) ? data.edges : [])
//         .filter(edge => {
//           const isValid = edge.from && edge.to && edge.from !== edge.to;
//           if (!isValid) {
//             console.warn("Invalid edge or self-loop filtered out in fetchFullKG:", edge);
//           }
//           return isValid;
//         })
//         .map((edge, index) => ({
//           ...edge,
//           id: `edge_${index}_${Date.now()}_${Math.random()}`,
//           from: nodeIdMap.get(edge.from) || edge.from,
//           to: nodeIdMap.get(edge.to) || edge.to
//         }));
      
//       const processedData = { nodes: processedNodes, edges: processedEdges };
      
//       setFullGraphData(processedData)
//       setCurrentGraphData(processedData)
//       setGraphType('full')
//       setShowGraph(true)
//     } catch (e) {
//       console.error("Failed to fetch full KG:", e)
//       setMessages(m => [...m, {
//         from: 'bot',
//         text: `⚠️ Failed to load full Knowledge Graph: ${e.message}. Please check the server at ${API_URL} and try again.`,
//         timestamp: new Date(),
//         type: 'error'
//       }])
//     } finally {
//       setGraphLoading(false)
//     }
//   }

//   const processResponseText = (text) => {
//     // Convert Markdown **text** to <b>text</b> and remove any stray asterisks
//     let processed = text
//       .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') // Convert **text** to <b>text</b>
//       .replace(/\*(.*?)\*/g, '<b>$1</b>')     // Convert *text* to <b>text</b>
//       .replace(/\*/g, '');                    // Remove any remaining single asterisks
//     return processed;
//   }

//   const send = async () => {
//     if (!input.trim() || loading) return
    
//     const userMsg = {
//       from: 'user', 
//       text: input.trim(), 
//       timestamp: new Date(),
//       type: 'user'
//     }
//     setMessages(m => [...m, userMsg])
//     const currentInput = input.trim()
//     setInput('')
//     setLoading(true)
//     setIsTyping(true)
//     setShowGraph(false)
    
//     try {
//       await new Promise(resolve => setTimeout(resolve, 500))
      
//       const res = await fetch(`${API_URL}/api/chat`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ query: currentInput })
//       })
      
//       if (!res.ok) {
//         throw new Error(`Server error: ${res.status}`)
//       }
      
//       const data = await res.json()
//       if (data.error) {
//         throw new Error(data.error)
//       }
      
//       // Log visualization data for debugging
//       if (data.kg_data?.visualization) {
//         console.log("Visualization data received:", {
//           nodes: data.kg_data.visualization.nodes,
//           edges: data.kg_data.visualization.edges,
//           nodeIds: data.kg_data.visualization.nodes.map(n => n.id),
//           edgeIds: data.kg_data.visualization.edges.map(e => e.id),
//           edgeDetails: data.kg_data.visualization.edges?.map(e => ({ from: e.from, to: e.to, label: e.label }))
//         });
//       }
      
//       const botText = formatResults(data)
      
//       setMessages(m => [...m, {
//         from: 'bot', 
//         text: botText, 
//         timestamp: new Date(),
//         type: data.confidence === 'high' ? 'results' : 'no-results',
//         kg_data: data.kg_data
//       }])
//     } catch (e) {
//       console.error("API Error:", e)
//       setMessages(m => [...m, {
//         from: 'bot', 
//         text: `🔌 Connection Issue\n\nI'm having trouble connecting to the knowledge base: ${e.message}\n\nPlease check if the server is running at ${API_URL} and try again.`,
//         timestamp: new Date(),
//         type: 'error'
//       }])
//     } finally {
//       setLoading(false)
//       setIsTyping(false)
//     }
//   }

//   const formatResults = (data) => {
//     if (data.error) {
//       return `❌ Query Error\n\n${data.detail || data.error}\n\nTry rephrasing your question or ask about specific herbs like turmeric, ashwagandha, or neem.`
//     }
    
//     let responseText = processResponseText(data.response || 'No response available.')

//     // Always add KG sources section if KG data exists (regardless of errors)
//     if (data.kg_data && (
//         (data.kg_data.entities && data.kg_data.entities.length > 0) || 
//         (data.kg_data.relationships && Object.keys(data.kg_data.relationships).length > 0)
//       )) {
//       responseText += '\n\n📚 Sources from Knowledge Graph:'
      
//       if (data.kg_data.entities && data.kg_data.entities.length > 0) {
//         responseText += '\nEntities Found:'
//         data.kg_data.entities.slice(0, 3).forEach(entity => {
//           const description = entity.details?.description?.[0] || 'No description available'
//           responseText += `\n- ${entity.label} (${entity.type}): ${description}`
//         })
//       }
      
//       if (data.kg_data.relationships && Object.keys(data.kg_data.relationships).length > 0) {
//         responseText += '\nRelationships:'
//         Object.entries(data.kg_data.relationships).slice(0, 2).forEach(([key, items]) => {
//           const cleanKey = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()
//           if (Array.isArray(items) && items.length > 0) {
//             const relationshipItems = items.slice(0, 2).map(item => 
//               `${item.fromLabel} -> ${item.toLabel} (${item.relation})`
//             ).join(', ')
//             responseText += `\n- ${cleanKey}: ${relationshipItems}`
//           }
//         })
//       }
//     }

//     return responseText
//   }

//   const showQueryGraph = (kgData) => {
//     console.log("Attempting to show query graph:", kgData)
    
//     // Clean up any existing network first
//     if (networkRef.current) {
//       try {
//         networkRef.current.destroy()
//         networkRef.current = null
//       } catch (e) {
//         console.warn("Error cleaning up network:", e)
//       }
//     }
    
//     if (!kgData || !kgData.visualization) {
//       console.error("No visualization data available:", kgData)
//       setMessages(m => [...m, {
//         from: 'bot',
//         text: '⚠️ No visualization data available for this query.',
//         timestamp: new Date(),
//         type: 'error'
//       }])
//       return
//     }

//     const { nodes, edges } = kgData.visualization
    
//     if (!nodes || !Array.isArray(nodes)) {
//       console.error("Invalid visualization data structure: nodes missing or not an array", kgData.visualization)
//       setMessages(m => [...m, {
//         from: 'bot',
//         text: '⚠️ Invalid knowledge graph data structure.',
//         timestamp: new Date(),
//         type: 'error'
//       }])
//       return
//     }

//     if (nodes.length === 0) {
//       console.warn("Empty visualization data: no nodes", { nodes: nodes.length })
//       setMessages(m => [...m, {
//         from: 'bot',
//         text: '⚠️ No nodes available for visualization.',
//         timestamp: new Date(),
//         type: 'error'
//       }])
//       return
//     }

//     // Generate unique node IDs and create a mapping
//     const nodeIdMap = new Map();
//     const processedNodes = nodes.map((node, index) => {
//       const uniqueId = `node_${index}_${Date.now()}_${Math.random()}`;
//       nodeIdMap.set(node.id, uniqueId);
//       return {
//         ...node,
//         id: uniqueId
//       };
//     });

//     // Process edges and map from/to IDs
//     const validEdges = (Array.isArray(edges) ? edges : [])
//       .filter(edge => {
//         const isValid = edge.from && edge.to && edge.from !== edge.to;
//         if (!isValid) {
//           console.warn("Invalid edge or self-loop filtered out in showQueryGraph:", edge);
//           return false;
//         }
//         return true;
//       })
//       .map((edge, index) => ({
//         ...edge,
//         id: `edge_${index}_${Date.now()}_${Math.random()}`,
//         from: nodeIdMap.get(edge.from) || edge.from,
//         to: nodeIdMap.get(edge.to) || edge.to
//       }));

//     if (edges?.length > 0 && validEdges.length === 0) {
//       console.warn("All edges were filtered out due to invalid from/to fields or self-loops", { originalEdges: edges });
//       setMessages(m => [...m, {
//         from: 'bot',
//         text: '⚠️ No valid edges found for the knowledge graph. Displaying nodes only. Check server logs for edge data issues.',
//         timestamp: new Date(),
//         type: 'warning'
//       }]);
//     }

//     console.log("Setting up query graph with:", { 
//       nodes: processedNodes.length, 
//       edges: validEdges.length,
//       edgeDetails: validEdges.map(e => ({ from: e.from, to: e.to, label: e.label })).slice(0, 5)
//     })
    
//     // Create graph data with processed nodes and edges
//     const graphDataCopy = {
//       nodes: processedNodes,
//       edges: validEdges
//     }
    
//     setCurrentGraphData(graphDataCopy)
//     setGraphType('query')
//     setShowGraph(true)
//   }

//   const formatTime = (timestamp) => {
//     const now = new Date()
//     const diff = now - timestamp
    
//     if (diff < 60000) return 'Just now'
//     if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
//     return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
//   }

//   const quickQuestions = [
//     { text: "Herbs for stress relief", icon: "🧘" },
//     { text: "Natural digestive aids", icon: "🌿" },
//     { text: "Immunity boosting herbs", icon: "🛡️" },
//     { text: "Sleep promoting remedies", icon: "🌙" },
//     { text: "Anti-inflammatory herbs", icon: "🔥" },
//     { text: "Energy boosting adaptogens", icon: "⚡" }
//   ]

//   const getMessageIcon = (message) => {
//     switch (message.type) {
//       case 'welcome': return <Heart size={16} className="text-rose-400" />
//       case 'results': return <Sparkles size={16} className="text-emerald-400" />
//       case 'error': return <Zap size={16} className="text-amber-400" />
//       case 'warning': return <Zap size={16} className="text-yellow-400" />
//       default: return <Leaf size={16} />
//     }
//   }

//   const getMessageStyle = (message) => {
//     const baseClasses = "message-bubble"
    
//     if (message.from === 'user') {
//       return `${baseClasses} user-message`
//     }
    
//     switch (message.type) {
//       case 'welcome':
//         return `${baseClasses} bot-message welcome-message`
//       case 'results':
//         return `${baseClasses} bot-message results-message`
//       case 'no-results':
//         return `${baseClasses} bot-message no-results-message`
//       case 'error':
//         return `${baseClasses} bot-message error-message`
//       case 'warning':
//         return `${baseClasses} bot-message warning-message`
//       default:
//         return `${baseClasses} bot-message`
//     }
//   }

//   return (
//     <div className="app-container">
//       {/* Animated Background */}
//       <div className="background-animation">
//         <div className="floating-leaf leaf-1">🍃</div>
//         <div className="floating-leaf leaf-2">🌿</div>
//         <div className="floating-leaf leaf-3">🍃</div>
//         <div className="floating-leaf leaf-4">🌱</div>
//       </div>

//       {/* Graph Visualization Modal */}
//       {showGraph && (
//         <div className="graph-modal">
//           <div className="graph-modal-content">
//             <button className="graph-close-button" onClick={() => {
//               setShowGraph(false)
//               // Clean up network when closing
//               if (networkRef.current) {
//                 try {
//                   networkRef.current.destroy()
//                   networkRef.current = null
//                 } catch (e) {
//                   console.warn("Error cleaning up network on close:", e)
//                 }
//               }
//             }}>
//               Close
//             </button>
//             <h3 className="graph-title">{graphType === 'full' ? 'Full Knowledge Graph' : 'Query Knowledge Graph'}</h3>
//             {graphLoading ? (
//               <div className="graph-loading">Loading graph...</div>
//             ) : (
//               <div ref={containerRef} className="graph-container" />
//             )}
//           </div>
//         </div>
//       )}

//       {/* Header Section */}
//       <header className="app-header">
//         <div className="header-content">
//           <div className="brand-section">
//             <div className="brand-icon">
//               <Leaf className="leaf-icon" />
//               <div className="icon-glow"></div>
//             </div>
//             <div className="brand-text">
//               <h1 className="brand-title">Ayurvedic Wisdom</h1>
//               <p className="brand-subtitle">Ancient Knowledge, Modern Discovery</p>
//             </div>
//           </div>
//           <div className="header-stats">
//             <div className="stat-item">
//               <MessageCircle size={16} />
//               <span>{messages.length} messages</span>
//             </div>
//             <button className="header-button" onClick={fetchFullKG} disabled={graphLoading}>
//               <Network size={16} /> {graphLoading ? 'Loading...' : 'View Full KG'}
//             </button>
//           </div>
//         </div>
//       </header>

//       {/* Main Chat Container */}
//       <main className="chat-container">
//         <div className="chat-window">
//           {/* Messages Area */}
//           <div className="messages-container">
//             {messages.map((message, index) => (
//               <div 
//                 key={index} 
//                 className={`message-wrapper ${message.from === 'user' ? 'user-wrapper' : 'bot-wrapper'}`}
//               >
//                 <div className="message-content">
//                   {message.from === 'bot' && (
//                     <div className="bot-avatar">
//                       <Bot size={18} />
//                       {getMessageIcon(message)}
//                     </div>
//                   )}
                  
//                   <div className={getMessageStyle(message)}>
//                     <div 
//                       className="message-text" 
//                       dangerouslySetInnerHTML={{ __html: processResponseText(message.text) }}
//                     />
//                     <div className="message-meta">
//                       <Clock size={12} />
//                       <span>{formatTime(message.timestamp)}</span>
//                     </div>
//                     {message.kg_data?.visualization?.nodes?.length > 0 && (
//                       <button
//                         className="view-graph-button"
//                         onClick={() => showQueryGraph(message.kg_data)}
//                       >
//                         <Network size={16} /> View Knowledge Graph
//                       </button>
//                     )}
//                   </div>
                  
//                   {message.from === 'user' && (
//                     <div className="user-avatar">
//                       <User size={18} />
//                     </div>
//                   )}
//                 </div>
//               </div>
//             ))}
            
//             {/* Typing Indicator */}
//             {isTyping && (
//               <div className="message-wrapper bot-wrapper">
//                 <div className="message-content">
//                   <div className="bot-avatar">
//                     <Bot size={18} />
//                   </div>
//                   <div className="typing-indicator">
//                     <div className="typing-dots">
//                       <span></span>
//                       <span></span>
//                       <span></span>
//                     </div>
//                     <span className="typing-text">Consulting ancient texts...</span>
//                   </div>
//                 </div>
//               </div>
//             )}
            
//             <div ref={messagesEndRef} />
//           </div>

//           {/* Quick Questions */}
//           {messages.length === 1 && !loading && (
//             <div className="quick-questions">
//               <h3 className="quick-title">
//                 <Sparkles size={16} />
//                 Popular Questions
//               </h3>
//               <div className="questions-grid">
//                 {quickQuestions.map((question, idx) => (
//                   <button
//                     key={idx}
//                     onClick={() => setInput(question.text)}
//                     className="question-card"
//                   >
//                     <span className="question-icon">{question.icon}</span>
//                     <span className="question-text">{question.text}</span>
//                   </button>
//                 ))}
//               </div>
//             </div>
//           )}

//           {/* Input Area */}
//           <div className="input-section">
//             <div className="input-container">
//               <div className="input-wrapper">
//                 <MessageCircle className="input-icon" size={20} />
//                 <input
//                   ref={inputRef}
//                   type="text"
//                   value={input}
//                   onChange={(e) => setInput(e.target.value)}
//                   onKeyDown={(e) => {
//                     if (e.key === 'Enter' && !e.shiftKey) {
//                       e.preventDefault()
//                       send()
//                     }
//                   }}
//                   placeholder="Ask about herbs, remedies, or wellness practices..."
//                   disabled={loading}
//                   className="message-input"
//                   maxLength={500}
//                 />
//                 <div className="input-actions">
//                   <span className="char-counter">{input.length}/500</span>
//                   <button
//                     onClick={send}
//                     disabled={loading || !input.trim()}
//                     className="send-button"
//                   >
//                     {loading ? (
//                       <Sparkles className="send-icon spinning" size={18} />
//                     ) : (
//                       <Send className="send-icon" size={18} />
//                     )}
//                   </button>
//                 </div>
//               </div>
//             </div>
            
//             <div className="input-footer">
//               <p className="disclaimer">
//                 🌿 Powered by traditional Ayurvedic knowledge • Always consult healthcare professionals for medical advice
//               </p>
//             </div>
//           </div>
//         </div>
//       </main>
//     </div>
//   )
// }
























// import React, { useState, useRef, useEffect } from 'react'
// import { Send, Leaf, MessageCircle, Sparkles, Clock, Bot, User, Zap, Heart, Network } from 'lucide-react'
// import { Network as VisNetwork } from 'vis-network'
// import { DataSet } from 'vis-data'

// const API_URL = import.meta.env?.VITE_API_URL || 'http://127.0.0.1:5000'

// export default function App() {
//   const [messages, setMessages] = useState([
//     {
//       from: 'bot', 
//       text: 'Namaste! 🙏 Welcome to Ayurvedic Wisdom - your gateway to ancient healing knowledge.\n\nI can help you discover:\n• Traditional herbs and their properties\n• Natural remedies for common ailments\n• Ayurvedic principles and practices\n• Wellness guidance from ancient texts\n\nTry asking: "What herbs help with stress?" or "Remedies for better digestion"',
//       timestamp: new Date(),
//       type: 'welcome'
//     }
//   ])
//   const [input, setInput] = useState('')
//   const [loading, setLoading] = useState(false)
//   const [isTyping, setIsTyping] = useState(false)
//   const [showGraph, setShowGraph] = useState(false)
//   const [graphType, setGraphType] = useState(null) // 'query' or 'full'
//   const [currentGraphData, setCurrentGraphData] = useState(null) // Current graph data to display
//   const [fullGraphData, setFullGraphData] = useState(null)
//   const [graphLoading, setGraphLoading] = useState(false)
//   const messagesEndRef = useRef(null)
//   const inputRef = useRef(null)
//   const networkRef = useRef(null)
//   const containerRef = useRef(null)

//   const scrollToBottom = () => {
//     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
//   }

//   useEffect(() => {
//     scrollToBottom()
//   }, [messages])

//   useEffect(() => {
//     inputRef.current?.focus()
//   }, [])

//   useEffect(() => {
//     if (showGraph && containerRef.current && currentGraphData) {
//       const { nodes, edges } = currentGraphData;
      
//       // Clean up existing network and DataSet
//       if (networkRef.current) {
//         try {
//           networkRef.current.destroy();
//           networkRef.current = null;
//         } catch (e) {
//           console.warn("Error destroying previous network:", e);
//         }
//       }

//       // Clear container
//       if (containerRef.current) {
//         containerRef.current.innerHTML = '';
//       }
      
//       // Validate data structure
//       if (!nodes || !Array.isArray(nodes)) {
//         console.error("Invalid graph data structure: nodes missing or not an array", currentGraphData);
//         setMessages(m => [...m, {
//           from: 'bot',
//           text: '⚠️ Invalid knowledge graph data structure. Please try another query.',
//           timestamp: new Date(),
//           type: 'error'
//         }]);
//         setShowGraph(false);
//         return;
//       }

//       if (nodes.length === 0) {
//         console.warn("Empty graph data: no nodes", { nodes: nodes.length });
//         setMessages(m => [...m, {
//           from: 'bot',
//           text: '⚠️ No nodes available for the knowledge graph. Please try another query or check the server logs.',
//           timestamp: new Date(),
//           type: 'error'
//         }]);
//         setShowGraph(false);
//         return;
//       }

//       try {
//         // Generate unique IDs for nodes and create a mapping
//         const nodeIdMap = new Map();
//         const processedNodes = nodes.map((node, index) => {
//           const uniqueId = `node_${index}_${Date.now()}_${Math.random()}`;
//           nodeIdMap.set(node.id, uniqueId); // Map original ID to new unique ID
//           return {
//             ...node,
//             id: uniqueId,
//             font: { size: 12, color: '#1e293b' },
//             size: node.group === 'herbs' ? 25 : 20
//           };
//         });
        
//         // Process edges and map from/to IDs
//         const processedEdges = (Array.isArray(edges) ? edges : [])
//           .filter(edge => {
//             const isValid = edge.from && edge.to;
//             if (!isValid) {
//               console.warn("Invalid edge filtered out:", edge);
//               return false;
//             }
//             if (edge.from === edge.to) {
//               console.warn("Self-loop detected:", edge);
//               setMessages(m => [...m, {
//                 from: 'bot',
//                 text: `⚠️ Detected self-loop in knowledge graph for node '${edge.from}'. Check server logs for data issues.`,
//                 timestamp: new Date(),
//                 type: 'warning'
//               }]);
//               return false;
//             }
//             return true;
//           })
//           .map((edge, index) => ({
//             ...edge,
//             id: `edge_${index}_${Date.now()}_${Math.random()}`,
//             from: nodeIdMap.get(edge.from) || edge.from,
//             to: nodeIdMap.get(edge.to) || edge.to,
//             arrows: {
//               to: { enabled: true, type: 'arrow', scaleFactor: 0.75 }
//             },
//             color: { color: '#64748b', highlight: '#3b82f6' },
//             font: { size: 10, align: 'middle', color: '#1e293b' },
//             width: 2
//           }));

//         if (edges.length > 0 && processedEdges.length === 0) {
//           console.warn("All edges were filtered out due to invalid from/to fields or self-loops", { originalEdges: edges });
//           setMessages(m => [...m, {
//             from: 'bot',
//             text: '⚠️ No valid edges found for the knowledge graph. Displaying nodes only. Check server logs for edge data issues.',
//             timestamp: new Date(),
//             type: 'warning'
//           }]);
//         }

//         console.log("Creating graph with:", { 
//           nodes: processedNodes.length, 
//           edges: processedEdges.length,
//           nodeIds: processedNodes.map(n => n.id).slice(0, 5),
//           edgeIds: processedEdges.map(e => e.id).slice(0, 5),
//           edgeDetails: processedEdges.map(e => ({ from: e.from, to: e.to, label: e.label })).slice(0, 5)
//         });

//         // Create new DataSet instances
//         const visNodes = new DataSet([]);
//         const visEdges = new DataSet([]);
        
//         // Add processed nodes and edges
//         visNodes.add(processedNodes);
//         visEdges.add(processedEdges);
        
//         const options = {
//           nodes: {
//             borderWidth: 1,
//             shadow: {
//               enabled: true,
//               size: 5,
//               x: 2,
//               y: 2
//             },
//             shape: 'dot'
//           },
//           edges: {
//             width: 2,
//             arrows: {
//               to: {
//                 enabled: true,
//                 type: 'arrow',
//                 scaleFactor: 0.75
//               }
//             },
//             color: {
//               color: '#64748b',
//               highlight: '#3b82f6',
//               opacity: 1.0
//             },
//             smooth: {
//               enabled: true,
//               type: 'continuous'
//             }
//           },
//           physics: {
//             forceAtlas2Based: {
//               gravitationalConstant: -50,
//               centralGravity: 0.005,
//               springLength: 100,
//               springConstant: 0.18,
//               avoidOverlap: 0.5
//             },
//             maxVelocity: 50,
//             solver: 'forceAtlas2Based',
//             timestep: 0.35,
//             stabilization: {
//               enabled: true,
//               iterations: 1000
//             }
//           },
//           interaction: { 
//             zoomView: true, 
//             dragView: true, 
//             multiselect: true,
//             hover: true
//           },
//           layout: { improvedLayout: true }
//         };
        
//         networkRef.current = new VisNetwork(containerRef.current, { nodes: visNodes, edges: visEdges }, options);
//         networkRef.current.stabilize(1000);
        
//         console.log("Network created successfully");
//       } catch (e) {
//         console.error("Failed to initialize network:", e);
//         setMessages(m => [...m, {
//           from: 'bot',
//           text: `⚠️ Error rendering graph: ${e.message}. Try refreshing or checking the server logs.`,
//           timestamp: new Date(),
//           type: 'error'
//         }]);
//         setShowGraph(false);
//       }
//     }
//   }, [showGraph, currentGraphData])

//   const fetchFullKG = async () => {
//     setGraphLoading(true)
//     try {
//       const res = await fetch(`${API_URL}/api/kg/full`, {
//         method: 'GET',
//         headers: { 'Content-Type': 'application/json' }
//       })
//       if (!res.ok) {
//         throw new Error(`Server error: ${res.status}`)
//       }
//       const data = await res.json()
//       if (data.error) {
//         throw new Error(data.error)
//       }
      
//       // Validate data structure
//       if (!data.nodes || !Array.isArray(data.nodes)) {
//         throw new Error("Invalid knowledge graph data structure from server: nodes missing or not an array")
//       }
      
//       if (data.nodes.length === 0) {
//         throw new Error("Received empty knowledge graph nodes")
//       }
      
//       // Generate unique IDs and validate edges
//       const nodeIdMap = new Map();
//       const processedNodes = data.nodes.map((node, index) => {
//         const uniqueId = `node_${index}_${Date.now()}_${Math.random()}`;
//         nodeIdMap.set(node.id, uniqueId);
//         return {
//           ...node,
//           id: uniqueId
//         };
//       });
      
//       const processedEdges = (Array.isArray(data.edges) ? data.edges : [])
//         .filter(edge => {
//           const isValid = edge.from && edge.to && edge.from !== edge.to;
//           if (!isValid) {
//             console.warn("Invalid edge or self-loop filtered out in fetchFullKG:", edge);
//           }
//           return isValid;
//         })
//         .map((edge, index) => ({
//           ...edge,
//           id: `edge_${index}_${Date.now()}_${Math.random()}`,
//           from: nodeIdMap.get(edge.from) || edge.from,
//           to: nodeIdMap.get(edge.to) || edge.to
//         }));
      
//       const processedData = { nodes: processedNodes, edges: processedEdges };
      
//       setFullGraphData(processedData)
//       setCurrentGraphData(processedData)
//       setGraphType('full')
//       setShowGraph(true)
//     } catch (e) {
//       console.error("Failed to fetch full KG:", e)
//       setMessages(m => [...m, {
//         from: 'bot',
//         text: `⚠️ Failed to load full Knowledge Graph: ${e.message}. Please check the server at ${API_URL} and try again.`,
//         timestamp: new Date(),
//         type: 'error'
//       }])
//     } finally {
//       setGraphLoading(false)
//     }
//   }

//   const send = async () => {
//     if (!input.trim() || loading) return
    
//     const userMsg = {
//       from: 'user', 
//       text: input.trim(), 
//       timestamp: new Date(),
//       type: 'user'
//     }
//     setMessages(m => [...m, userMsg])
//     const currentInput = input.trim()
//     setInput('')
//     setLoading(true)
//     setIsTyping(true)
//     setShowGraph(false)
    
//     try {
//       await new Promise(resolve => setTimeout(resolve, 500))
      
//       const res = await fetch(`${API_URL}/api/chat`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ query: currentInput })
//       })
      
//       if (!res.ok) {
//         throw new Error(`Server error: ${res.status}`)
//       }
      
//       const data = await res.json()
//       if (data.error) {
//         throw new Error(data.error)
//       }
      
//       // Log visualization data for debugging
//       if (data.kg_data?.visualization) {
//         console.log("Visualization data received:", {
//           nodes: data.kg_data.visualization.nodes,
//           edges: data.kg_data.visualization.edges,
//           nodeIds: data.kg_data.visualization.nodes.map(n => n.id),
//           edgeIds: data.kg_data.visualization.edges.map(e => e.id),
//           edgeDetails: data.kg_data.visualization.edges?.map(e => ({ from: e.from, to: e.to, label: e.label }))
//         });
//       }
      
//       const botText = formatResults(data)
      
//       setMessages(m => [...m, {
//         from: 'bot', 
//         text: botText, 
//         timestamp: new Date(),
//         type: data.confidence === 'high' ? 'results' : 'no-results',
//         kg_data: data.kg_data
//       }])
//     } catch (e) {
//       console.error("API Error:", e)
//       setMessages(m => [...m, {
//         from: 'bot', 
//         text: `🔌 Connection Issue\n\nI'm having trouble connecting to the knowledge base: ${e.message}\n\nPlease check if the server is running at ${API_URL} and try again.`,
//         timestamp: new Date(),
//         type: 'error'
//       }])
//     } finally {
//       setLoading(false)
//       setIsTyping(false)
//     }
//   }

//   const formatResults = (data) => {
//     if (data.error) {
//       return `❌ Query Error\n\n${data.detail || data.error}\n\nTry rephrasing your question or ask about specific herbs like turmeric, ashwagandha, or neem.`
//     }
    
//     let responseText = data.response || 'No response available.'

//     // Always add KG sources section if KG data exists (regardless of errors)
//     if (data.kg_data && (
//         (data.kg_data.entities && data.kg_data.entities.length > 0) || 
//         (data.kg_data.relationships && Object.keys(data.kg_data.relationships).length > 0)
//       )) {
//       responseText += '\n\n📚 Sources from Knowledge Graph:'
      
//       if (data.kg_data.entities && data.kg_data.entities.length > 0) {
//         responseText += '\nEntities Found:'
//         data.kg_data.entities.slice(0, 3).forEach(entity => {
//           const description = entity.details?.description?.[0] || 'No description available'
//           responseText += `\n- ${entity.label} (${entity.type}): ${description}`
//         })
//       }
      
//       if (data.kg_data.relationships && Object.keys(data.kg_data.relationships).length > 0) {
//         responseText += '\nRelationships:'
//         Object.entries(data.kg_data.relationships).slice(0, 2).forEach(([key, items]) => {
//           const cleanKey = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()
//           if (Array.isArray(items) && items.length > 0) {
//             const relationshipItems = items.slice(0, 2).map(item => 
//               `${item.fromLabel} -> ${item.toLabel} (${item.relation})`
//             ).join(', ')
//             responseText += `\n- ${cleanKey}: ${relationshipItems}`
//           }
//         })
//       }
//     }

//     return responseText
//   }

//   const showQueryGraph = (kgData) => {
//     console.log("Attempting to show query graph:", kgData)
    
//     // Clean up any existing network first
//     if (networkRef.current) {
//       try {
//         networkRef.current.destroy()
//         networkRef.current = null
//       } catch (e) {
//         console.warn("Error cleaning up network:", e)
//       }
//     }
    
//     if (!kgData || !kgData.visualization) {
//       console.error("No visualization data available:", kgData)
//       setMessages(m => [...m, {
//         from: 'bot',
//         text: '⚠️ No visualization data available for this query.',
//         timestamp: new Date(),
//         type: 'error'
//       }])
//       return
//     }

//     const { nodes, edges } = kgData.visualization
    
//     if (!nodes || !Array.isArray(nodes)) {
//       console.error("Invalid visualization data structure: nodes missing or not an array", kgData.visualization)
//       setMessages(m => [...m, {
//         from: 'bot',
//         text: '⚠️ Invalid knowledge graph data structure.',
//         timestamp: new Date(),
//         type: 'error'
//       }])
//       return
//     }

//     if (nodes.length === 0) {
//       console.warn("Empty visualization data: no nodes", { nodes: nodes.length })
//       setMessages(m => [...m, {
//         from: 'bot',
//         text: '⚠️ No nodes available for visualization.',
//         timestamp: new Date(),
//         type: 'error'
//       }])
//       return
//     }

//     // Generate unique node IDs and create a mapping
//     const nodeIdMap = new Map();
//     const processedNodes = nodes.map((node, index) => {
//       const uniqueId = `node_${index}_${Date.now()}_${Math.random()}`;
//       nodeIdMap.set(node.id, uniqueId);
//       return {
//         ...node,
//         id: uniqueId
//       };
//     });

//     // Process edges and map from/to IDs
//     const validEdges = (Array.isArray(edges) ? edges : [])
//       .filter(edge => {
//         const isValid = edge.from && edge.to && edge.from !== edge.to;
//         if (!isValid) {
//           console.warn("Invalid edge or self-loop filtered out in showQueryGraph:", edge);
//           return false;
//         }
//         return true;
//       })
//       .map((edge, index) => ({
//         ...edge,
//         id: `edge_${index}_${Date.now()}_${Math.random()}`,
//         from: nodeIdMap.get(edge.from) || edge.from,
//         to: nodeIdMap.get(edge.to) || edge.to
//       }));

//     if (edges?.length > 0 && validEdges.length === 0) {
//       console.warn("All edges were filtered out due to invalid from/to fields or self-loops", { originalEdges: edges });
//       setMessages(m => [...m, {
//         from: 'bot',
//         text: '⚠️ No valid edges found for the knowledge graph. Displaying nodes only. Check server logs for edge data issues.',
//         timestamp: new Date(),
//         type: 'warning'
//       }]);
//     }

//     console.log("Setting up query graph with:", { 
//       nodes: processedNodes.length, 
//       edges: validEdges.length,
//       edgeDetails: validEdges.map(e => ({ from: e.from, to: e.to, label: e.label })).slice(0, 5)
//     })
    
//     // Create graph data with processed nodes and edges
//     const graphDataCopy = {
//       nodes: processedNodes,
//       edges: validEdges
//     }
    
//     setCurrentGraphData(graphDataCopy)
//     setGraphType('query')
//     setShowGraph(true)
//   }

//   const formatTime = (timestamp) => {
//     const now = new Date()
//     const diff = now - timestamp
    
//     if (diff < 60000) return 'Just now'
//     if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
//     return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
//   }

//   const quickQuestions = [
//     { text: "Herbs for stress relief", icon: "🧘" },
//     { text: "Natural digestive aids", icon: "🌿" },
//     { text: "Immunity boosting herbs", icon: "🛡️" },
//     { text: "Sleep promoting remedies", icon: "🌙" },
//     { text: "Anti-inflammatory herbs", icon: "🔥" },
//     { text: "Energy boosting adaptogens", icon: "⚡" }
//   ]

//   const getMessageIcon = (message) => {
//     switch (message.type) {
//       case 'welcome': return <Heart size={16} className="text-rose-400" />
//       case 'results': return <Sparkles size={16} className="text-emerald-400" />
//       case 'error': return <Zap size={16} className="text-amber-400" />
//       case 'warning': return <Zap size={16} className="text-yellow-400" />
//       default: return <Leaf size={16} />
//     }
//   }

//   const getMessageStyle = (message) => {
//     const baseClasses = "message-bubble"
    
//     if (message.from === 'user') {
//       return `${baseClasses} user-message`
//     }
    
//     switch (message.type) {
//       case 'welcome':
//         return `${baseClasses} bot-message welcome-message`
//       case 'results':
//         return `${baseClasses} bot-message results-message`
//       case 'no-results':
//         return `${baseClasses} bot-message no-results-message`
//       case 'error':
//         return `${baseClasses} bot-message error-message`
//       case 'warning':
//         return `${baseClasses} bot-message warning-message`
//       default:
//         return `${baseClasses} bot-message`
//     }
//   }

//   return (
//     <div className="app-container">
//       {/* Animated Background */}
//       <div className="background-animation">
//         <div className="floating-leaf leaf-1">🍃</div>
//         <div className="floating-leaf leaf-2">🌿</div>
//         <div className="floating-leaf leaf-3">🍃</div>
//         <div className="floating-leaf leaf-4">🌱</div>
//       </div>

//       {/* Graph Visualization Modal */}
//       {showGraph && (
//         <div className="graph-modal">
//           <div className="graph-modal-content">
//             <button className="graph-close-button" onClick={() => {
//               setShowGraph(false)
//               // Clean up network when closing
//               if (networkRef.current) {
//                 try {
//                   networkRef.current.destroy()
//                   networkRef.current = null
//                 } catch (e) {
//                   console.warn("Error cleaning up network on close:", e)
//                 }
//               }
//             }}>
//               Close
//             </button>
//             <h3 className="graph-title">{graphType === 'full' ? 'Full Knowledge Graph' : 'Query Knowledge Graph'}</h3>
//             {graphLoading ? (
//               <div className="graph-loading">Loading graph...</div>
//             ) : (
//               <div ref={containerRef} className="graph-container" />
//             )}
//           </div>
//         </div>
//       )}

//       {/* Header Section */}
//       <header className="app-header">
//         <div className="header-content">
//           <div className="brand-section">
//             <div className="brand-icon">
//               <Leaf className="leaf-icon" />
//               <div className="icon-glow"></div>
//             </div>
//             <div className="brand-text">
//               <h1 className="brand-title">Ayurvedic Wisdom</h1>
//               <p className="brand-subtitle">Ancient Knowledge, Modern Discovery</p>
//             </div>
//           </div>
//           <div className="header-stats">
//             <div className="stat-item">
//               <MessageCircle size={16} />
//               <span>{messages.length} messages</span>
//             </div>
//             <button className="header-button" onClick={fetchFullKG} disabled={graphLoading}>
//               <Network size={16} /> {graphLoading ? 'Loading...' : 'View Full KG'}
//             </button>
//           </div>
//         </div>
//       </header>

//       {/* Main Chat Container */}
//       <main className="chat-container">
//         <div className="chat-window">
//           {/* Messages Area */}
//           <div className="messages-container">
//             {messages.map((message, index) => (
//               <div 
//                 key={index} 
//                 className={`message-wrapper ${message.from === 'user' ? 'user-wrapper' : 'bot-wrapper'}`}
//               >
//                 <div className="message-content">
//                   {message.from === 'bot' && (
//                     <div className="bot-avatar">
//                       <Bot size={18} />
//                       {getMessageIcon(message)}
//                     </div>
//                   )}
                  
//                   <div className={getMessageStyle(message)}>
//                     <div className="message-text">
//                       {message.text}
//                       {message.kg_data?.visualization?.nodes?.length > 0 && (
//                         <button
//                           className="view-graph-button"
//                           onClick={() => showQueryGraph(message.kg_data)}
//                         >
//                           <Network size={16} /> View Knowledge Graph
//                         </button>
//                       )}
//                     </div>
//                     <div className="message-meta">
//                       <Clock size={12} />
//                       <span>{formatTime(message.timestamp)}</span>
//                     </div>
//                   </div>
                  
//                   {message.from === 'user' && (
//                     <div className="user-avatar">
//                       <User size={18} />
//                     </div>
//                   )}
//                 </div>
//               </div>
//             ))}
            
//             {/* Typing Indicator */}
//             {isTyping && (
//               <div className="message-wrapper bot-wrapper">
//                 <div className="message-content">
//                   <div className="bot-avatar">
//                     <Bot size={18} />
//                   </div>
//                   <div className="typing-indicator">
//                     <div className="typing-dots">
//                       <span></span>
//                       <span></span>
//                       <span></span>
//                     </div>
//                     <span className="typing-text">Consulting ancient texts...</span>
//                   </div>
//                 </div>
//               </div>
//             )}
            
//             <div ref={messagesEndRef} />
//           </div>

//           {/* Quick Questions */}
//           {messages.length === 1 && !loading && (
//             <div className="quick-questions">
//               <h3 className="quick-title">
//                 <Sparkles size={16} />
//                 Popular Questions
//               </h3>
//               <div className="questions-grid">
//                 {quickQuestions.map((question, idx) => (
//                   <button
//                     key={idx}
//                     onClick={() => setInput(question.text)}
//                     className="question-card"
//                   >
//                     <span className="question-icon">{question.icon}</span>
//                     <span className="question-text">{question.text}</span>
//                   </button>
//                 ))}
//               </div>
//             </div>
//           )}

//           {/* Input Area */}
//           <div className="input-section">
//             <div className="input-container">
//               <div className="input-wrapper">
//                 <MessageCircle className="input-icon" size={20} />
//                 <input
//                   ref={inputRef}
//                   type="text"
//                   value={input}
//                   onChange={(e) => setInput(e.target.value)}
//                   onKeyDown={(e) => {
//                     if (e.key === 'Enter' && !e.shiftKey) {
//                       e.preventDefault()
//                       send()
//                     }
//                   }}
//                   placeholder="Ask about herbs, remedies, or wellness practices..."
//                   disabled={loading}
//                   className="message-input"
//                   maxLength={500}
//                 />
//                 <div className="input-actions">
//                   <span className="char-counter">{input.length}/500</span>
//                   <button
//                     onClick={send}
//                     disabled={loading || !input.trim()}
//                     className="send-button"
//                   >
//                     {loading ? (
//                       <Sparkles className="send-icon spinning" size={18} />
//                     ) : (
//                       <Send className="send-icon" size={18} />
//                     )}
//                   </button>
//                 </div>
//               </div>
//             </div>
            
//             <div className="input-footer">
//               <p className="disclaimer">
//                 🌿 Powered by traditional Ayurvedic knowledge • Always consult healthcare professionals for medical advice
//               </p>
//             </div>
//           </div>
//         </div>
//       </main>
//     </div>
//   )
// }















// import React, { useState, useRef, useEffect } from 'react'
// import { Send, Leaf, MessageCircle, Sparkles, Clock, Bot, User, Zap, Heart, Network } from 'lucide-react'
// import { Network as VisNetwork } from 'vis-network'
// import { DataSet } from 'vis-data'

// const API_URL = import.meta.env?.VITE_API_URL || 'http://127.0.0.1:5000'

// export default function App() {
//   const [messages, setMessages] = useState([
//     {
//       from: 'bot', 
//       text: 'Namaste! 🙏 Welcome to Ayurvedic Wisdom - your gateway to ancient healing knowledge.\n\nI can help you discover:\n• Traditional herbs and their properties\n• Natural remedies for common ailments\n• Ayurvedic principles and practices\n• Wellness guidance from ancient texts\n\nTry asking: "What herbs help with stress?" or "Remedies for better digestion"',
//       timestamp: new Date(),
//       type: 'welcome'
//     }
//   ])
//   const [input, setInput] = useState('')
//   const [loading, setLoading] = useState(false)
//   const [isTyping, setIsTyping] = useState(false)
//   const [showGraph, setShowGraph] = useState(false)
//   const [graphType, setGraphType] = useState(null) // 'query' or 'full'
//   const [currentGraphData, setCurrentGraphData] = useState(null) // Current graph data to display
//   const [fullGraphData, setFullGraphData] = useState(null)
//   const [graphLoading, setGraphLoading] = useState(false)
//   const messagesEndRef = useRef(null)
//   const inputRef = useRef(null)
//   const networkRef = useRef(null)
//   const containerRef = useRef(null)

//   const scrollToBottom = () => {
//     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
//   }

//   useEffect(() => {
//     scrollToBottom()
//   }, [messages])

//   useEffect(() => {
//     inputRef.current?.focus()
//   }, [])

//   useEffect(() => {
//     if (showGraph && containerRef.current && currentGraphData) {
//       const { nodes, edges } = currentGraphData;
      
//       // Clean up existing network and DataSet
//       if (networkRef.current) {
//         try {
//           networkRef.current.destroy();
//           networkRef.current = null;
//         } catch (e) {
//           console.warn("Error destroying previous network:", e);
//         }
//       }

//       // Clear container
//       if (containerRef.current) {
//         containerRef.current.innerHTML = '';
//       }
      
//       // Validate data structure
//       if (!nodes || !Array.isArray(nodes)) {
//         console.error("Invalid graph data structure: nodes missing or not an array", currentGraphData);
//         setMessages(m => [...m, {
//           from: 'bot',
//           text: '⚠️ Invalid knowledge graph data structure. Please try another query.',
//           timestamp: new Date(),
//           type: 'error'
//         }]);
//         setShowGraph(false);
//         return;
//       }

//       if (nodes.length === 0) {
//         console.warn("Empty graph data: no nodes", { nodes: nodes.length });
//         setMessages(m => [...m, {
//           from: 'bot',
//           text: '⚠️ No nodes available for the knowledge graph. Please try another query or check the server logs.',
//           timestamp: new Date(),
//           type: 'error'
//         }]);
//         setShowGraph(false);
//         return;
//       }

//       try {
//         // Generate unique IDs for nodes and create a mapping
//         const nodeIdMap = new Map();
//         const processedNodes = nodes.map((node, index) => {
//           const uniqueId = `node_${index}_${Date.now()}_${Math.random()}`;
//           nodeIdMap.set(node.id, uniqueId); // Map original ID to new unique ID
//           return {
//             ...node,
//             id: uniqueId,
//             font: { size: 12, color: '#1e293b' },
//             size: node.group === 'herbs' ? 25 : 20
//           };
//         });
        
//         // Process edges and map from/to IDs
//         const processedEdges = (Array.isArray(edges) ? edges : [])
//           .filter(edge => {
//             const isValid = edge.from && edge.to;
//             if (!isValid) {
//               console.warn("Invalid edge filtered out:", edge);
//             }
//             return isValid;
//           })
//           .map((edge, index) => ({
//             ...edge,
//             id: `edge_${index}_${Date.now()}_${Math.random()}`,
//             from: nodeIdMap.get(edge.from) || edge.from, // Map to new node ID
//             to: nodeIdMap.get(edge.to) || edge.to, // Map to new node ID
//             arrows: {
//               to: { enabled: true, type: 'arrow', scaleFactor: 0.75 }
//             },
//             color: { color: '#64748b', highlight: '#3b82f6' },
//             font: { size: 10, align: 'middle', color: '#1e293b' },
//             width: 2
//           }));

//         if (edges.length > 0 && processedEdges.length === 0) {
//           console.warn("All edges were filtered out due to invalid from/to fields", { originalEdges: edges });
//           setMessages(m => [...m, {
//             from: 'bot',
//             text: '⚠️ No valid edges found for the knowledge graph. Displaying nodes only. Check server logs for edge data issues.',
//             timestamp: new Date(),
//             type: 'warning'
//           }]);
//         }

//         console.log("Creating graph with:", { 
//           nodes: processedNodes.length, 
//           edges: processedEdges.length,
//           nodeIds: processedNodes.map(n => n.id).slice(0, 5),
//           edgeIds: processedEdges.map(e => e.id).slice(0, 5),
//           edgeDetails: processedEdges.map(e => ({ from: e.from, to: e.to })).slice(0, 5)
//         });

//         // Create new DataSet instances
//         const visNodes = new DataSet([]);
//         const visEdges = new DataSet([]);
        
//         // Add processed nodes and edges
//         visNodes.add(processedNodes);
//         visEdges.add(processedEdges);
        
//         const options = {
//           nodes: {
//             borderWidth: 1,
//             shadow: {
//               enabled: true,
//               size: 5,
//               x: 2,
//               y: 2
//             },
//             shape: 'dot'
//           },
//           edges: {
//             width: 2,
//             arrows: {
//               to: {
//                 enabled: true,
//                 type: 'arrow',
//                 scaleFactor: 0.75
//               }
//             },
//             color: {
//               color: '#64748b',
//               highlight: '#3b82f6',
//               opacity: 1.0
//             },
//             smooth: {
//               enabled: true,
//               type: 'continuous'
//             }
//           },
//           physics: {
//             forceAtlas2Based: {
//               gravitationalConstant: -50,
//               centralGravity: 0.005,
//               springLength: 100,
//               springConstant: 0.18,
//               avoidOverlap: 0.5
//             },
//             maxVelocity: 50,
//             solver: 'forceAtlas2Based',
//             timestep: 0.35,
//             stabilization: {
//               enabled: true,
//               iterations: 1000
//             }
//           },
//           interaction: { 
//             zoomView: true, 
//             dragView: true, 
//             multiselect: true,
//             hover: true
//           },
//           layout: { improvedLayout: true }
//         };
        
//         networkRef.current = new VisNetwork(containerRef.current, { nodes: visNodes, edges: visEdges }, options);
//         networkRef.current.stabilize(1000);
        
//         console.log("Network created successfully");
//       } catch (e) {
//         console.error("Failed to initialize network:", e);
//         setMessages(m => [...m, {
//           from: 'bot',
//           text: `⚠️ Error rendering graph: ${e.message}. Try refreshing or checking the server logs.`,
//           timestamp: new Date(),
//           type: 'error'
//         }]);
//         setShowGraph(false);
//       }
//     }
//   }, [showGraph, currentGraphData])

//   const fetchFullKG = async () => {
//     setGraphLoading(true)
//     try {
//       const res = await fetch(`${API_URL}/api/kg/full`, {
//         method: 'GET',
//         headers: { 'Content-Type': 'application/json' }
//       })
//       if (!res.ok) {
//         throw new Error(`Server error: ${res.status}`)
//       }
//       const data = await res.json()
//       if (data.error) {
//         throw new Error(data.error)
//       }
      
//       // Validate data structure
//       if (!data.nodes || !Array.isArray(data.nodes)) {
//         throw new Error("Invalid knowledge graph data structure from server: nodes missing or not an array")
//       }
      
//       if (data.nodes.length === 0) {
//         throw new Error("Received empty knowledge graph nodes")
//       }
      
//       // Generate unique IDs and validate edges
//       const nodeIdMap = new Map();
//       const processedNodes = data.nodes.map((node, index) => {
//         const uniqueId = `node_${index}_${Date.now()}_${Math.random()}`;
//         nodeIdMap.set(node.id, uniqueId);
//         return {
//           ...node,
//           id: uniqueId
//         };
//       });
      
//       const processedEdges = (Array.isArray(data.edges) ? data.edges : [])
//         .filter(edge => {
//           const isValid = edge.from && edge.to;
//           if (!isValid) {
//             console.warn("Invalid edge filtered out in fetchFullKG:", edge);
//           }
//           return isValid;
//         })
//         .map((edge, index) => ({
//           ...edge,
//           id: `edge_${index}_${Date.now()}_${Math.random()}`,
//           from: nodeIdMap.get(edge.from) || edge.from,
//           to: nodeIdMap.get(edge.to) || edge.to
//         }));
      
//       const processedData = { nodes: processedNodes, edges: processedEdges };
      
//       setFullGraphData(processedData)
//       setCurrentGraphData(processedData)
//       setGraphType('full')
//       setShowGraph(true)
//     } catch (e) {
//       console.error("Failed to fetch full KG:", e)
//       setMessages(m => [...m, {
//         from: 'bot',
//         text: `⚠️ Failed to load full Knowledge Graph: ${e.message}. Please check the server at ${API_URL} and try again.`,
//         timestamp: new Date(),
//         type: 'error'
//       }])
//     } finally {
//       setGraphLoading(false)
//     }
//   }

//   const send = async () => {
//     if (!input.trim() || loading) return
    
//     const userMsg = {
//       from: 'user', 
//       text: input.trim(), 
//       timestamp: new Date(),
//       type: 'user'
//     }
//     setMessages(m => [...m, userMsg])
//     const currentInput = input.trim()
//     setInput('')
//     setLoading(true)
//     setIsTyping(true)
//     setShowGraph(false)
    
//     try {
//       await new Promise(resolve => setTimeout(resolve, 500))
      
//       const res = await fetch(`${API_URL}/api/chat`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ query: currentInput })
//       })
      
//       if (!res.ok) {
//         throw new Error(`Server error: ${res.status}`)
//       }
      
//       const data = await res.json()
//       if (data.error) {
//         throw new Error(data.error)
//       }
      
//       // Log visualization data for debugging
//       if (data.kg_data?.visualization) {
//         console.log("Visualization data received:", {
//           nodes: data.kg_data.visualization.nodes,
//           edges: data.kg_data.visualization.edges,
//           nodeIds: data.kg_data.visualization.nodes.map(n => n.id),
//           edgeIds: data.kg_data.visualization.edges.map(e => e.id),
//           edgeDetails: data.kg_data.visualization.edges?.map(e => ({ from: e.from, to: e.to }))
//         });
//       }
      
//       const botText = formatResults(data)
      
//       setMessages(m => [...m, {
//         from: 'bot', 
//         text: botText, 
//         timestamp: new Date(),
//         type: data.confidence === 'high' ? 'results' : 'no-results',
//         kg_data: data.kg_data
//       }])
//     } catch (e) {
//       console.error("API Error:", e)
//       setMessages(m => [...m, {
//         from: 'bot', 
//         text: `🔌 Connection Issue\n\nI'm having trouble connecting to the knowledge base: ${e.message}\n\nPlease check if the server is running at ${API_URL} and try again.`,
//         timestamp: new Date(),
//         type: 'error'
//       }])
//     } finally {
//       setLoading(false)
//       setIsTyping(false)
//     }
//   }

//   const formatResults = (data) => {
//     if (data.error) {
//       return `❌ Query Error\n\n${data.detail || data.error}\n\nTry rephrasing your question or ask about specific herbs like turmeric, ashwagandha, or neem.`
//     }
    
//     let responseText = data.response || 'No response available.'

//     // Always add KG sources section if KG data exists (regardless of errors)
//     if (data.kg_data && (
//         (data.kg_data.entities && data.kg_data.entities.length > 0) || 
//         (data.kg_data.relationships && Object.keys(data.kg_data.relationships).length > 0)
//       )) {
//       responseText += '\n\n📚 Sources from Knowledge Graph:'
      
//       if (data.kg_data.entities && data.kg_data.entities.length > 0) {
//         responseText += '\nEntities Found:'
//         data.kg_data.entities.slice(0, 3).forEach(entity => {
//           const description = entity.details?.description?.[0] || 'No description available'
//           responseText += `\n- ${entity.label} (${entity.type}): ${description}`
//         })
//       }
      
//       if (data.kg_data.relationships && Object.keys(data.kg_data.relationships).length > 0) {
//         responseText += '\nRelationships:'
//         Object.entries(data.kg_data.relationships).slice(0, 2).forEach(([key, items]) => {
//           const cleanKey = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()
//           if (Array.isArray(items) && items.length > 0) {
//             const relationshipItems = items.slice(0, 2).map(item => 
//               item.conditionLabel || item.herbLabel || item.label || 'Unknown'
//             ).join(', ')
//             responseText += `\n- ${cleanKey}: ${relationshipItems}`
//           }
//         })
//       }
//     }

//     return responseText
//   }

//   const showQueryGraph = (kgData) => {
//     console.log("Attempting to show query graph:", kgData)
    
//     // Clean up any existing network first
//     if (networkRef.current) {
//       try {
//         networkRef.current.destroy()
//         networkRef.current = null
//       } catch (e) {
//         console.warn("Error cleaning up network:", e)
//       }
//     }
    
//     if (!kgData || !kgData.visualization) {
//       console.error("No visualization data available:", kgData)
//       setMessages(m => [...m, {
//         from: 'bot',
//         text: '⚠️ No visualization data available for this query.',
//         timestamp: new Date(),
//         type: 'error'
//       }])
//       return
//     }

//     const { nodes, edges } = kgData.visualization
    
//     if (!nodes || !Array.isArray(nodes)) {
//       console.error("Invalid visualization data structure: nodes missing or not an array", kgData.visualization)
//       setMessages(m => [...m, {
//         from: 'bot',
//         text: '⚠️ Invalid knowledge graph data structure.',
//         timestamp: new Date(),
//         type: 'error'
//       }])
//       return
//     }

//     if (nodes.length === 0) {
//       console.warn("Empty visualization data: no nodes", { nodes: nodes.length })
//       setMessages(m => [...m, {
//         from: 'bot',
//         text: '⚠️ No nodes available for visualization.',
//         timestamp: new Date(),
//         type: 'error'
//       }])
//       return
//     }

//     // Generate unique node IDs and create a mapping
//     const nodeIdMap = new Map();
//     const processedNodes = nodes.map((node, index) => {
//       const uniqueId = `node_${index}_${Date.now()}_${Math.random()}`;
//       nodeIdMap.set(node.id, uniqueId);
//       return {
//         ...node,
//         id: uniqueId
//       };
//     });

//     // Process edges and map from/to IDs
//     const validEdges = (Array.isArray(edges) ? edges : [])
//       .filter(edge => {
//         const isValid = edge.from && edge.to;
//         if (!isValid) {
//           console.warn("Invalid edge filtered out in showQueryGraph:", edge);
//         }
//         return isValid;
//       })
//       .map((edge, index) => ({
//         ...edge,
//         id: `edge_${index}_${Date.now()}_${Math.random()}`,
//         from: nodeIdMap.get(edge.from) || edge.from,
//         to: nodeIdMap.get(edge.to) || edge.to
//       }));

//     if (edges?.length > 0 && validEdges.length === 0) {
//       console.warn("All edges were filtered out due to invalid from/to fields", { originalEdges: edges });
//       setMessages(m => [...m, {
//         from: 'bot',
//         text: '⚠️ No valid edges found for the knowledge graph. Displaying nodes only. Check server logs for edge data issues.',
//         timestamp: new Date(),
//         type: 'warning'
//       }]);
//     }

//     console.log("Setting up query graph with:", { 
//       nodes: processedNodes.length, 
//       edges: validEdges.length,
//       edgeDetails: validEdges.map(e => ({ from: e.from, to: e.to })).slice(0, 5)
//     })
    
//     // Create graph data with processed nodes and edges
//     const graphDataCopy = {
//       nodes: processedNodes,
//       edges: validEdges
//     }
    
//     setCurrentGraphData(graphDataCopy)
//     setGraphType('query')
//     setShowGraph(true)
//   }

//   const formatTime = (timestamp) => {
//     const now = new Date()
//     const diff = now - timestamp
    
//     if (diff < 60000) return 'Just now'
//     if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
//     return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
//   }

//   const quickQuestions = [
//     { text: "Herbs for stress relief", icon: "🧘" },
//     { text: "Natural digestive aids", icon: "🌿" },
//     { text: "Immunity boosting herbs", icon: "🛡️" },
//     { text: "Sleep promoting remedies", icon: "🌙" },
//     { text: "Anti-inflammatory herbs", icon: "🔥" },
//     { text: "Energy boosting adaptogens", icon: "⚡" }
//   ]

//   const getMessageIcon = (message) => {
//     switch (message.type) {
//       case 'welcome': return <Heart size={16} className="text-rose-400" />
//       case 'results': return <Sparkles size={16} className="text-emerald-400" />
//       case 'error': return <Zap size={16} className="text-amber-400" />
//       case 'warning': return <Zap size={16} className="text-yellow-400" />
//       default: return <Leaf size={16} />
//     }
//   }

//   const getMessageStyle = (message) => {
//     const baseClasses = "message-bubble"
    
//     if (message.from === 'user') {
//       return `${baseClasses} user-message`
//     }
    
//     switch (message.type) {
//       case 'welcome':
//         return `${baseClasses} bot-message welcome-message`
//       case 'results':
//         return `${baseClasses} bot-message results-message`
//       case 'no-results':
//         return `${baseClasses} bot-message no-results-message`
//       case 'error':
//         return `${baseClasses} bot-message error-message`
//       case 'warning':
//         return `${baseClasses} bot-message warning-message`
//       default:
//         return `${baseClasses} bot-message`
//     }
//   }

//   return (
//     <div className="app-container">
//       {/* Animated Background */}
//       <div className="background-animation">
//         <div className="floating-leaf leaf-1">🍃</div>
//         <div className="floating-leaf leaf-2">🌿</div>
//         <div className="floating-leaf leaf-3">🍃</div>
//         <div className="floating-leaf leaf-4">🌱</div>
//       </div>

//       {/* Graph Visualization Modal */}
//       {showGraph && (
//         <div className="graph-modal">
//           <div className="graph-modal-content">
//             <button className="graph-close-button" onClick={() => {
//               setShowGraph(false)
//               // Clean up network when closing
//               if (networkRef.current) {
//                 try {
//                   networkRef.current.destroy()
//                   networkRef.current = null
//                 } catch (e) {
//                   console.warn("Error cleaning up network on close:", e)
//                 }
//               }
//             }}>
//               Close
//             </button>
//             <h3 className="graph-title">{graphType === 'full' ? 'Full Knowledge Graph' : 'Query Knowledge Graph'}</h3>
//             {graphLoading ? (
//               <div className="graph-loading">Loading graph...</div>
//             ) : (
//               <div ref={containerRef} className="graph-container" />
//             )}
//           </div>
//         </div>
//       )}

//       {/* Header Section */}
//       <header className="app-header">
//         <div className="header-content">
//           <div className="brand-section">
//             <div className="brand-icon">
//               <Leaf className="leaf-icon" />
//               <div className="icon-glow"></div>
//             </div>
//             <div className="brand-text">
//               <h1 className="brand-title">Ayurvedic Wisdom</h1>
//               <p className="brand-subtitle">Ancient Knowledge, Modern Discovery</p>
//             </div>
//           </div>
//           <div className="header-stats">
//             <div className="stat-item">
//               <MessageCircle size={16} />
//               <span>{messages.length} messages</span>
//             </div>
//             <button className="header-button" onClick={fetchFullKG} disabled={graphLoading}>
//               <Network size={16} /> {graphLoading ? 'Loading...' : 'View Full KG'}
//             </button>
//           </div>
//         </div>
//       </header>

//       {/* Main Chat Container */}
//       <main className="chat-container">
//         <div className="chat-window">
//           {/* Messages Area */}
//           <div className="messages-container">
//             {messages.map((message, index) => (
//               <div 
//                 key={index} 
//                 className={`message-wrapper ${message.from === 'user' ? 'user-wrapper' : 'bot-wrapper'}`}
//               >
//                 <div className="message-content">
//                   {message.from === 'bot' && (
//                     <div className="bot-avatar">
//                       <Bot size={18} />
//                       {getMessageIcon(message)}
//                     </div>
//                   )}
                  
//                   <div className={getMessageStyle(message)}>
//                     <div className="message-text">
//                       {message.text}
//                       {message.kg_data?.visualization?.nodes?.length > 0 && (
//                         <button
//                           className="view-graph-button"
//                           onClick={() => showQueryGraph(message.kg_data)}
//                         >
//                           <Network size={16} /> View Knowledge Graph
//                         </button>
//                       )}
//                     </div>
//                     <div className="message-meta">
//                       <Clock size={12} />
//                       <span>{formatTime(message.timestamp)}</span>
//                     </div>
//                   </div>
                  
//                   {message.from === 'user' && (
//                     <div className="user-avatar">
//                       <User size={18} />
//                     </div>
//                   )}
//                 </div>
//               </div>
//             ))}
            
//             {/* Typing Indicator */}
//             {isTyping && (
//               <div className="message-wrapper bot-wrapper">
//                 <div className="message-content">
//                   <div className="bot-avatar">
//                     <Bot size={18} />
//                   </div>
//                   <div className="typing-indicator">
//                     <div className="typing-dots">
//                       <span></span>
//                       <span></span>
//                       <span></span>
//                     </div>
//                     <span className="typing-text">Consulting ancient texts...</span>
//                   </div>
//                 </div>
//               </div>
//             )}
            
//             <div ref={messagesEndRef} />
//           </div>

//           {/* Quick Questions */}
//           {messages.length === 1 && !loading && (
//             <div className="quick-questions">
//               <h3 className="quick-title">
//                 <Sparkles size={16} />
//                 Popular Questions
//               </h3>
//               <div className="questions-grid">
//                 {quickQuestions.map((question, idx) => (
//                   <button
//                     key={idx}
//                     onClick={() => setInput(question.text)}
//                     className="question-card"
//                   >
//                     <span className="question-icon">{question.icon}</span>
//                     <span className="question-text">{question.text}</span>
//                   </button>
//                 ))}
//               </div>
//             </div>
//           )}

//           {/* Input Area */}
//           <div className="input-section">
//             <div className="input-container">
//               <div className="input-wrapper">
//                 <MessageCircle className="input-icon" size={20} />
//                 <input
//                   ref={inputRef}
//                   type="text"
//                   value={input}
//                   onChange={(e) => setInput(e.target.value)}
//                   onKeyDown={(e) => {
//                     if (e.key === 'Enter' && !e.shiftKey) {
//                       e.preventDefault()
//                       send()
//                     }
//                   }}
//                   placeholder="Ask about herbs, remedies, or wellness practices..."
//                   disabled={loading}
//                   className="message-input"
//                   maxLength={500}
//                 />
//                 <div className="input-actions">
//                   <span className="char-counter">{input.length}/500</span>
//                   <button
//                     onClick={send}
//                     disabled={loading || !input.trim()}
//                     className="send-button"
//                   >
//                     {loading ? (
//                       <Sparkles className="send-icon spinning" size={18} />
//                     ) : (
//                       <Send className="send-icon" size={18} />
//                     )}
//                   </button>
//                 </div>
//               </div>
//             </div>
            
//             <div className="input-footer">
//               <p className="disclaimer">
//                 🌿 Powered by traditional Ayurvedic knowledge • Always consult healthcare professionals for medical advice
//               </p>
//             </div>
//           </div>
//         </div>
//       </main>
//     </div>
//   )
// }





























// import React, { useState, useRef, useEffect } from 'react'
// import { Send, Leaf, MessageCircle, Sparkles, Clock, Bot, User, Zap, Heart, Network } from 'lucide-react'
// import { Network as VisNetwork } from 'vis-network'
// import { DataSet } from 'vis-data'

// const API_URL = import.meta.env?.VITE_API_URL || 'http://127.0.0.1:5000'

// export default function App() {
//   const [messages, setMessages] = useState([
//     {
//       from: 'bot', 
//       text: 'Namaste! 🙏 Welcome to Ayurvedic Wisdom - your gateway to ancient healing knowledge.\n\nI can help you discover:\n• Traditional herbs and their properties\n• Natural remedies for common ailments\n• Ayurvedic principles and practices\n• Wellness guidance from ancient texts\n\nTry asking: "What herbs help with stress?" or "Remedies for better digestion"',
//       timestamp: new Date(),
//       type: 'welcome'
//     }
//   ])
//   const [input, setInput] = useState('')
//   const [loading, setLoading] = useState(false)
//   const [isTyping, setIsTyping] = useState(false)
//   const [showGraph, setShowGraph] = useState(false)
//   const [graphType, setGraphType] = useState(null) // 'query' or 'full'
//   const [currentGraphData, setCurrentGraphData] = useState(null) // Current graph data to display
//   const [fullGraphData, setFullGraphData] = useState(null)
//   const [graphLoading, setGraphLoading] = useState(false)
//   const messagesEndRef = useRef(null)
//   const inputRef = useRef(null)
//   const networkRef = useRef(null)
//   const containerRef = useRef(null)

//   const scrollToBottom = () => {
//     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
//   }

//   useEffect(() => {
//     scrollToBottom()
//   }, [messages])

//   useEffect(() => {
//     inputRef.current?.focus()
//   }, [])

//   useEffect(() => {
//     if (showGraph && containerRef.current && currentGraphData) {
//       const { nodes, edges } = currentGraphData;
      
//       // Clean up existing network and DataSet
//       if (networkRef.current) {
//         try {
//           networkRef.current.destroy();
//           networkRef.current = null;
//         } catch (e) {
//           console.warn("Error destroying previous network:", e);
//         }
//       }

//       // Clear container
//       if (containerRef.current) {
//         containerRef.current.innerHTML = '';
//       }
      
//       // Validate data structure
//       if (!nodes || !Array.isArray(nodes)) {
//         console.error("Invalid graph data structure: nodes missing or not an array", currentGraphData);
//         setMessages(m => [...m, {
//           from: 'bot',
//           text: '⚠️ Invalid knowledge graph data structure. Please try another query.',
//           timestamp: new Date(),
//           type: 'error'
//         }]);
//         setShowGraph(false);
//         return;
//       }

//       if (nodes.length === 0) {
//         console.warn("Empty graph data: no nodes", { nodes: nodes.length });
//         setMessages(m => [...m, {
//           from: 'bot',
//           text: '⚠️ No nodes available for the knowledge graph. Please try another query or check the server logs.',
//           timestamp: new Date(),
//           type: 'error'
//         }]);
//         setShowGraph(false);
//         return;
//       }

//       try {
//         // Generate unique IDs for nodes and create a mapping
//         const nodeIdMap = new Map();
//         const processedNodes = nodes.map((node, index) => {
//           const uniqueId = `node_${index}_${Date.now()}_${Math.random()}`;
//           nodeIdMap.set(node.id, uniqueId); // Map original ID to new unique ID
//           return {
//             ...node,
//             id: uniqueId,
//             font: { size: 12, color: '#1e293b' },
//             size: node.group === 'herbs' ? 25 : 20
//           };
//         });
        
//         // Process edges and map from/to IDs
//         const processedEdges = (Array.isArray(edges) ? edges : [])
//           .filter(edge => {
//             const isValid = edge.from && edge.to;
//             if (!isValid) {
//               console.warn("Invalid edge filtered out:", edge);
//             }
//             return isValid;
//           })
//           .map((edge, index) => ({
//             ...edge,
//             id: `edge_${index}_${Date.now()}_${Math.random()}`,
//             from: nodeIdMap.get(edge.from) || edge.from, // Map to new node ID
//             to: nodeIdMap.get(edge.to) || edge.to, // Map to new node ID
//             arrows: {
//               to: { enabled: true, type: 'arrow', scaleFactor: 0.75 }
//             },
//             color: { color: '#64748b', highlight: '#3b82f6' },
//             font: { size: 10, align: 'middle', color: '#1e293b' },
//             width: 2
//           }));

//         if (edges.length > 0 && processedEdges.length === 0) {
//           console.warn("All edges were filtered out due to invalid from/to fields", { originalEdges: edges });
//           setMessages(m => [...m, {
//             from: 'bot',
//             text: '⚠️ No valid edges found for the knowledge graph. Displaying nodes only. Check server logs for edge data issues.',
//             timestamp: new Date(),
//             type: 'warning'
//           }]);
//         }

//         console.log("Creating graph with:", { 
//           nodes: processedNodes.length, 
//           edges: processedEdges.length,
//           nodeIds: processedNodes.map(n => n.id).slice(0, 5),
//           edgeIds: processedEdges.map(e => e.id).slice(0, 5),
//           edgeDetails: processedEdges.map(e => ({ from: e.from, to: e.to })).slice(0, 5)
//         });

//         // Create new DataSet instances
//         const visNodes = new DataSet([]);
//         const visEdges = new DataSet([]);
        
//         // Add processed nodes and edges
//         visNodes.add(processedNodes);
//         visEdges.add(processedEdges);
        
//         const options = {
//           nodes: {
//             borderWidth: 1,
//             shadow: {
//               enabled: true,
//               size: 5,
//               x: 2,
//               y: 2
//             },
//             shape: 'dot'
//           },
//           edges: {
//             width: 2,
//             arrows: {
//               to: {
//                 enabled: true,
//                 type: 'arrow',
//                 scaleFactor: 0.75
//               }
//             },
//             color: {
//               color: '#64748b',
//               highlight: '#3b82f6',
//               opacity: 1.0
//             },
//             smooth: {
//               enabled: true,
//               type: 'continuous'
//             }
//           },
//           physics: {
//             forceAtlas2Based: {
//               gravitationalConstant: -50,
//               centralGravity: 0.005,
//               springLength: 100,
//               springConstant: 0.18,
//               avoidOverlap: 0.5
//             },
//             maxVelocity: 50,
//             solver: 'forceAtlas2Based',
//             timestep: 0.35,
//             stabilization: {
//               enabled: true,
//               iterations: 1000
//             }
//           },
//           interaction: { 
//             zoomView: true, 
//             dragView: true, 
//             multiselect: true,
//             hover: true
//           },
//           layout: { improvedLayout: true }
//         };
        
//         networkRef.current = new VisNetwork(containerRef.current, { nodes: visNodes, edges: visEdges }, options);
//         networkRef.current.stabilize(1000);
        
//         console.log("Network created successfully");
//       } catch (e) {
//         console.error("Failed to initialize network:", e);
//         setMessages(m => [...m, {
//           from: 'bot',
//           text: `⚠️ Error rendering graph: ${e.message}. Try refreshing or checking the server logs.`,
//           timestamp: new Date(),
//           type: 'error'
//         }]);
//         setShowGraph(false);
//       }
//     }
//   }, [showGraph, currentGraphData])

//   const fetchFullKG = async () => {
//     setGraphLoading(true)
//     try {
//       const res = await fetch(`${API_URL}/api/kg/full`, {
//         method: 'GET',
//         headers: { 'Content-Type': 'application/json' }
//       })
//       if (!res.ok) {
//         throw new Error(`Server error: ${res.status}`)
//       }
//       const data = await res.json()
//       if (data.error) {
//         throw new Error(data.error)
//       }
      
//       // Validate data structure
//       if (!data.nodes || !Array.isArray(data.nodes)) {
//         throw new Error("Invalid knowledge graph data structure from server: nodes missing or not an array")
//       }
      
//       if (data.nodes.length === 0) {
//         throw new Error("Received empty knowledge graph nodes")
//       }
      
//       // Generate unique IDs and validate edges
//       const nodeIdMap = new Map();
//       const processedNodes = data.nodes.map((node, index) => {
//         const uniqueId = `node_${index}_${Date.now()}_${Math.random()}`;
//         nodeIdMap.set(node.id, uniqueId);
//         return {
//           ...node,
//           id: uniqueId
//         };
//       });
      
//       const processedEdges = (Array.isArray(data.edges) ? data.edges : [])
//         .filter(edge => {
//           const isValid = edge.from && edge.to;
//           if (!isValid) {
//             console.warn("Invalid edge filtered out in fetchFullKG:", edge);
//           }
//           return isValid;
//         })
//         .map((edge, index) => ({
//           ...edge,
//           id: `edge_${index}_${Date.now()}_${Math.random()}`,
//           from: nodeIdMap.get(edge.from) || edge.from,
//           to: nodeIdMap.get(edge.to) || edge.to
//         }));
      
//       const processedData = { nodes: processedNodes, edges: processedEdges };
      
//       setFullGraphData(processedData)
//       setCurrentGraphData(processedData)
//       setGraphType('full')
//       setShowGraph(true)
//     } catch (e) {
//       console.error("Failed to fetch full KG:", e)
//       setMessages(m => [...m, {
//         from: 'bot',
//         text: `⚠️ Failed to load full Knowledge Graph: ${e.message}. Please check the server at ${API_URL} and try again.`,
//         timestamp: new Date(),
//         type: 'error'
//       }])
//     } finally {
//       setGraphLoading(false)
//     }
//   }

//   const send = async () => {
//     if (!input.trim() || loading) return
    
//     const userMsg = {
//       from: 'user', 
//       text: input.trim(), 
//       timestamp: new Date(),
//       type: 'user'
//     }
//     setMessages(m => [...m, userMsg])
//     const currentInput = input.trim()
//     setInput('')
//     setLoading(true)
//     setIsTyping(true)
//     setShowGraph(false)
    
//     try {
//       await new Promise(resolve => setTimeout(resolve, 500))
      
//       const res = await fetch(`${API_URL}/api/chat`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ query: currentInput })
//       })
      
//       if (!res.ok) {
//         throw new Error(`Server error: ${res.status}`)
//       }
      
//       const data = await res.json()
//       if (data.error) {
//         throw new Error(data.error)
//       }
      
//       // Log visualization data for debugging
//       if (data.kg_data?.visualization) {
//         console.log("Visualization data received:", {
//           nodes: data.kg_data.visualization.nodes,
//           edges: data.kg_data.visualization.edges,
//           nodeIds: data.kg_data.visualization.nodes.map(n => n.id),
//           edgeIds: data.kg_data.visualization.edges.map(e => e.id),
//           edgeDetails: data.kg_data.visualization.edges?.map(e => ({ from: e.from, to: e.to }))
//         });
//       }
      
//       const botText = formatResults(data)
      
//       setMessages(m => [...m, {
//         from: 'bot', 
//         text: botText, 
//         timestamp: new Date(),
//         type: data.confidence === 'high' ? 'results' : 'no-results',
//         kg_data: data.kg_data
//       }])
//     } catch (e) {
//       console.error("API Error:", e)
//       setMessages(m => [...m, {
//         from: 'bot', 
//         text: `🔌 Connection Issue\n\nI'm having trouble connecting to the knowledge base: ${e.message}\n\nPlease check if the server is running at ${API_URL} and try again.`,
//         timestamp: new Date(),
//         type: 'error'
//       }])
//     } finally {
//       setLoading(false)
//       setIsTyping(false)
//     }
//   }

//   const formatResults = (data) => {
//     if (data.error) {
//       return `❌ Query Error\n\n${data.detail || data.error}\n\nTry rephrasing your question or ask about specific herbs like turmeric, ashwagandha, or neem.`
//     }
    
//     let responseText = data.response || 'No response available.'

//     // Always add KG sources section if KG data exists (regardless of errors)
//     if (data.kg_data && (
//         (data.kg_data.entities && data.kg_data.entities.length > 0) || 
//         (data.kg_data.relationships && Object.keys(data.kg_data.relationships).length > 0)
//       )) {
//       responseText += '\n\n📚 Sources from Knowledge Graph:'
      
//       // Display entities found
//       if (data.kg_data.entities && data.kg_data.entities.length > 0) {
//         responseText += '\n\n🔍 Entities Found:'
//         data.kg_data.entities.slice(0, 5).forEach(entity => {
//           const description = entity.details?.description?.[0] || 'Traditional Ayurvedic knowledge'
//           responseText += `\n• ${entity.label} (${entity.type}): ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}`
//         })
//       }
      
//       // Display relationships in a more readable format
//       if (data.kg_data.relationships && Object.keys(data.kg_data.relationships).length > 0) {
//         responseText += '\n\n🔗 Knowledge Connections:'
        
//         Object.entries(data.kg_data.relationships).forEach(([relationshipType, items]) => {
//           if (!Array.isArray(items) || items.length === 0) return
          
//           // Format relationship type to be more readable
//           const formattedRelationType = formatRelationshipType(relationshipType)
          
//           responseText += `\n\n${formattedRelationType}:`
          
//           // Group items by their properties for better display
//           const groupedItems = groupRelationshipItems(items, relationshipType)
          
//           Object.entries(groupedItems).forEach(([key, relatedItems]) => {
//             if (relatedItems.length > 0) {
//               const itemsList = relatedItems.slice(0, 3).join(', ')
//               const extraCount = relatedItems.length > 3 ? ` (+${relatedItems.length - 3} more)` : ''
//               responseText += `\n  ▸ ${key}: ${itemsList}${extraCount}`
//             }
//           })
//         })
//       }
      
//       // Add visualization hint
//       if (data.kg_data.visualization?.nodes?.length > 0) {
//         responseText += '\n\n💡 Click "View Knowledge Graph" below to see visual connections!'
//       }
//     }

//     return responseText
//   }

//   // Helper function to format relationship types
//   const formatRelationshipType = (relationshipType) => {
//     const typeMap = {
//       'treatedBy': '🌿 Diseases Treated By Herbs',
//       'treats': '🎯 Herbs That Treat',
//       'hasProperty': '⚗️ Herb Properties',
//       'recommendedFor': '💊 Recommended For Conditions',
//       'contraindicated': '⚠️ Contraindications',
//       'interactsWith': '🔄 Interactions',
//       'usedIn': '📝 Used In Formulations',
//       'belongsTo': '📂 Categories',
//       'hasIngredient': '🧪 Contains Ingredients',
//       'similarTo': '🤝 Similar Herbs',
//       'partOf': '🏥 Part Of System',
//       'causedBy': '🎯 Caused By',
//       'symptomOf': '🔍 Symptom Of',
//       'associatedWith': '🔗 Associated With'
//     }
    
//     return typeMap[relationshipType] || `🔗 ${relationshipType.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()}`
//   }

//   // Helper function to group relationship items for better display
//   const groupRelationshipItems = (items, relationshipType) => {
//     const grouped = {}
    
//     items.forEach(item => {
//       let groupKey = 'Items'
//       let displayValue = item.label || 'Unknown'
      
//       // Customize grouping based on relationship type and available properties
//       if (relationshipType === 'treatedBy') {
//         if (item.conditionLabel && item.herbLabel) {
//           groupKey = item.conditionLabel
//           displayValue = item.herbLabel
//         } else if (item.herbLabel) {
//           groupKey = 'Herbs'
//           displayValue = item.herbLabel
//         } else if (item.conditionLabel) {
//           groupKey = 'Conditions'
//           displayValue = item.conditionLabel
//         }
//       } else if (relationshipType === 'treats') {
//         if (item.herbLabel && item.conditionLabel) {
//           groupKey = item.herbLabel
//           displayValue = item.conditionLabel
//         } else if (item.conditionLabel) {
//           groupKey = 'Conditions'
//           displayValue = item.conditionLabel
//         } else if (item.herbLabel) {
//           groupKey = 'Herbs'
//           displayValue = item.herbLabel
//         }
//       } else if (relationshipType === 'recommendedFor') {
//         if (item.herbLabel && item.conditionLabel) {
//           groupKey = item.herbLabel
//           displayValue = item.conditionLabel
//         } else if (item.herbLabel) {
//           groupKey = 'Herbs'
//           displayValue = item.herbLabel
//         }
//       } else if (relationshipType === 'hasProperty') {
//         if (item.herbLabel && item.propertyLabel) {
//           groupKey = item.herbLabel
//           displayValue = item.propertyLabel
//         } else if (item.propertyLabel) {
//           groupKey = 'Properties'
//           displayValue = item.propertyLabel
//         }
//       } else {
//         // For other relationship types, try to extract meaningful grouping
//         if (item.herbLabel) {
//           groupKey = item.herbLabel
//           displayValue = item.conditionLabel || item.propertyLabel || item.label || 'Related item'
//         } else if (item.conditionLabel) {
//           groupKey = item.conditionLabel
//           displayValue = item.herbLabel || item.label || 'Related item'
//         } else {
//           groupKey = 'Related Items'
//           displayValue = item.label || JSON.stringify(item).substring(0, 50)
//         }
//       }
      
//       if (!grouped[groupKey]) {
//         grouped[groupKey] = []
//       }
      
//       // Avoid duplicates
//       if (!grouped[groupKey].includes(displayValue)) {
//         grouped[groupKey].push(displayValue)
//       }
//     })
    
//     return grouped
//   }




//   const showQueryGraph = (kgData) => {
//     console.log("Attempting to show query graph:", kgData)
    
//     // Clean up any existing network first
//     if (networkRef.current) {
//       try {
//         networkRef.current.destroy()
//         networkRef.current = null
//       } catch (e) {
//         console.warn("Error cleaning up network:", e)
//       }
//     }
    
//     if (!kgData || !kgData.visualization) {
//       console.error("No visualization data available:", kgData)
//       setMessages(m => [...m, {
//         from: 'bot',
//         text: '⚠️ No visualization data available for this query.',
//         timestamp: new Date(),
//         type: 'error'
//       }])
//       return
//     }

//     const { nodes, edges } = kgData.visualization
    
//     if (!nodes || !Array.isArray(nodes)) {
//       console.error("Invalid visualization data structure: nodes missing or not an array", kgData.visualization)
//       setMessages(m => [...m, {
//         from: 'bot',
//         text: '⚠️ Invalid knowledge graph data structure.',
//         timestamp: new Date(),
//         type: 'error'
//       }])
//       return
//     }

//     if (nodes.length === 0) {
//       console.warn("Empty visualization data: no nodes", { nodes: nodes.length })
//       setMessages(m => [...m, {
//         from: 'bot',
//         text: '⚠️ No nodes available for visualization.',
//         timestamp: new Date(),
//         type: 'error'
//       }])
//       return
//     }

//     // Generate unique node IDs and create a mapping
//     const nodeIdMap = new Map();
//     const processedNodes = nodes.map((node, index) => {
//       const uniqueId = `node_${index}_${Date.now()}_${Math.random()}`;
//       nodeIdMap.set(node.id, uniqueId);
//       return {
//         ...node,
//         id: uniqueId
//       };
//     });

//     // Process edges and map from/to IDs
//     const validEdges = (Array.isArray(edges) ? edges : [])
//       .filter(edge => {
//         const isValid = edge.from && edge.to;
//         if (!isValid) {
//           console.warn("Invalid edge filtered out in showQueryGraph:", edge);
//         }
//         return isValid;
//       })
//       .map((edge, index) => ({
//         ...edge,
//         id: `edge_${index}_${Date.now()}_${Math.random()}`,
//         from: nodeIdMap.get(edge.from) || edge.from,
//         to: nodeIdMap.get(edge.to) || edge.to
//       }));

//     if (edges?.length > 0 && validEdges.length === 0) {
//       console.warn("All edges were filtered out due to invalid from/to fields", { originalEdges: edges });
//       setMessages(m => [...m, {
//         from: 'bot',
//         text: '⚠️ No valid edges found for the knowledge graph. Displaying nodes only. Check server logs for edge data issues.',
//         timestamp: new Date(),
//         type: 'warning'
//       }]);
//     }

//     console.log("Setting up query graph with:", { 
//       nodes: processedNodes.length, 
//       edges: validEdges.length,
//       edgeDetails: validEdges.map(e => ({ from: e.from, to: e.to })).slice(0, 5)
//     })
    
//     // Create graph data with processed nodes and edges
//     const graphDataCopy = {
//       nodes: processedNodes,
//       edges: validEdges
//     }
    
//     setCurrentGraphData(graphDataCopy)
//     setGraphType('query')
//     setShowGraph(true)
//   }

//   const formatTime = (timestamp) => {
//     const now = new Date()
//     const diff = now - timestamp
    
//     if (diff < 60000) return 'Just now'
//     if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
//     return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
//   }

//   const quickQuestions = [
//     { text: "Herbs for stress relief", icon: "🧘" },
//     { text: "Natural digestive aids", icon: "🌿" },
//     { text: "Immunity boosting herbs", icon: "🛡️" },
//     { text: "Sleep promoting remedies", icon: "🌙" },
//     { text: "Anti-inflammatory herbs", icon: "🔥" },
//     { text: "Energy boosting adaptogens", icon: "⚡" }
//   ]

//   const getMessageIcon = (message) => {
//     switch (message.type) {
//       case 'welcome': return <Heart size={16} className="text-rose-400" />
//       case 'results': return <Sparkles size={16} className="text-emerald-400" />
//       case 'error': return <Zap size={16} className="text-amber-400" />
//       case 'warning': return <Zap size={16} className="text-yellow-400" />
//       default: return <Leaf size={16} />
//     }
//   }

//   const getMessageStyle = (message) => {
//     const baseClasses = "message-bubble"
    
//     if (message.from === 'user') {
//       return `${baseClasses} user-message`
//     }
    
//     switch (message.type) {
//       case 'welcome':
//         return `${baseClasses} bot-message welcome-message`
//       case 'results':
//         return `${baseClasses} bot-message results-message`
//       case 'no-results':
//         return `${baseClasses} bot-message no-results-message`
//       case 'error':
//         return `${baseClasses} bot-message error-message`
//       case 'warning':
//         return `${baseClasses} bot-message warning-message`
//       default:
//         return `${baseClasses} bot-message`
//     }
//   }

//   return (
//     <div className="app-container">
//       {/* Animated Background */}
//       <div className="background-animation">
//         <div className="floating-leaf leaf-1">🍃</div>
//         <div className="floating-leaf leaf-2">🌿</div>
//         <div className="floating-leaf leaf-3">🍃</div>
//         <div className="floating-leaf leaf-4">🌱</div>
//       </div>

//       {/* Graph Visualization Modal */}
//       {showGraph && (
//         <div className="graph-modal">
//           <div className="graph-modal-content">
//             <button className="graph-close-button" onClick={() => {
//               setShowGraph(false)
//               // Clean up network when closing
//               if (networkRef.current) {
//                 try {
//                   networkRef.current.destroy()
//                   networkRef.current = null
//                 } catch (e) {
//                   console.warn("Error cleaning up network on close:", e)
//                 }
//               }
//             }}>
//               Close
//             </button>
//             <h3 className="graph-title">{graphType === 'full' ? 'Full Knowledge Graph' : 'Query Knowledge Graph'}</h3>
//             {graphLoading ? (
//               <div className="graph-loading">Loading graph...</div>
//             ) : (
//               <div ref={containerRef} className="graph-container" />
//             )}
//           </div>
//         </div>
//       )}

//       {/* Header Section */}
//       <header className="app-header">
//         <div className="header-content">
//           <div className="brand-section">
//             <div className="brand-icon">
//               <Leaf className="leaf-icon" />
//               <div className="icon-glow"></div>
//             </div>
//             <div className="brand-text">
//               <h1 className="brand-title">Ayurvedic Wisdom</h1>
//               <p className="brand-subtitle">Ancient Knowledge, Modern Discovery</p>
//             </div>
//           </div>
//           <div className="header-stats">
//             <div className="stat-item">
//               <MessageCircle size={16} />
//               <span>{messages.length} messages</span>
//             </div>
//             <button className="header-button" onClick={fetchFullKG} disabled={graphLoading}>
//               <Network size={16} /> {graphLoading ? 'Loading...' : 'View Full KG'}
//             </button>
//           </div>
//         </div>
//       </header>

//       {/* Main Chat Container */}
//       <main className="chat-container">
//         <div className="chat-window">
//           {/* Messages Area */}
//           <div className="messages-container">
//             {messages.map((message, index) => (
//               <div 
//                 key={index} 
//                 className={`message-wrapper ${message.from === 'user' ? 'user-wrapper' : 'bot-wrapper'}`}
//               >
//                 <div className="message-content">
//                   {message.from === 'bot' && (
//                     <div className="bot-avatar">
//                       <Bot size={18} />
//                       {getMessageIcon(message)}
//                     </div>
//                   )}
                  
//                   <div className={getMessageStyle(message)}>
//                     <div className="message-text">
//                       {message.text}
//                       {message.kg_data?.visualization?.nodes?.length > 0 && (
//                         <button
//                           className="view-graph-button"
//                           onClick={() => showQueryGraph(message.kg_data)}
//                         >
//                           <Network size={16} /> View Knowledge Graph
//                         </button>
//                       )}
//                     </div>
//                     <div className="message-meta">
//                       <Clock size={12} />
//                       <span>{formatTime(message.timestamp)}</span>
//                     </div>
//                   </div>
                  
//                   {message.from === 'user' && (
//                     <div className="user-avatar">
//                       <User size={18} />
//                     </div>
//                   )}
//                 </div>
//               </div>
//             ))}
            
//             {/* Typing Indicator */}
//             {isTyping && (
//               <div className="message-wrapper bot-wrapper">
//                 <div className="message-content">
//                   <div className="bot-avatar">
//                     <Bot size={18} />
//                   </div>
//                   <div className="typing-indicator">
//                     <div className="typing-dots">
//                       <span></span>
//                       <span></span>
//                       <span></span>
//                     </div>
//                     <span className="typing-text">Consulting ancient texts...</span>
//                   </div>
//                 </div>
//               </div>
//             )}
            
//             <div ref={messagesEndRef} />
//           </div>

//           {/* Quick Questions */}
//           {messages.length === 1 && !loading && (
//             <div className="quick-questions">
//               <h3 className="quick-title">
//                 <Sparkles size={16} />
//                 Popular Questions
//               </h3>
//               <div className="questions-grid">
//                 {quickQuestions.map((question, idx) => (
//                   <button
//                     key={idx}
//                     onClick={() => setInput(question.text)}
//                     className="question-card"
//                   >
//                     <span className="question-icon">{question.icon}</span>
//                     <span className="question-text">{question.text}</span>
//                   </button>
//                 ))}
//               </div>
//             </div>
//           )}

//           {/* Input Area */}
//           <div className="input-section">
//             <div className="input-container">
//               <div className="input-wrapper">
//                 <MessageCircle className="input-icon" size={20} />
//                 <input
//                   ref={inputRef}
//                   type="text"
//                   value={input}
//                   onChange={(e) => setInput(e.target.value)}
//                   onKeyDown={(e) => {
//                     if (e.key === 'Enter' && !e.shiftKey) {
//                       e.preventDefault()
//                       send()
//                     }
//                   }}
//                   placeholder="Ask about herbs, remedies, or wellness practices..."
//                   disabled={loading}
//                   className="message-input"
//                   maxLength={500}
//                 />
//                 <div className="input-actions">
//                   <span className="char-counter">{input.length}/500</span>
//                   <button
//                     onClick={send}
//                     disabled={loading || !input.trim()}
//                     className="send-button"
//                   >
//                     {loading ? (
//                       <Sparkles className="send-icon spinning" size={18} />
//                     ) : (
//                       <Send className="send-icon" size={18} />
//                     )}
//                   </button>
//                 </div>
//               </div>
//             </div>
            
//             <div className="input-footer">
//               <p className="disclaimer">
//                 🌿 Powered by traditional Ayurvedic knowledge • Always consult healthcare professionals for medical advice
//               </p>
//             </div>
//           </div>
//         </div>
//       </main>
//     </div>
//   )
// }
























// import React, { useState, useRef, useEffect } from 'react'
// import { Send, Leaf, MessageCircle, Sparkles, Clock, Bot, User, Zap, Heart, Network } from 'lucide-react'
// import { Network as VisNetwork } from 'vis-network'
// import { DataSet } from 'vis-data'

// const API_URL = import.meta.env?.VITE_API_URL || 'http://127.0.0.1:5000'

// export default function App() {
//   const [messages, setMessages] = useState([
//     {
//       from: 'bot', 
//       text: 'Namaste! 🙏 Welcome to Ayurvedic Wisdom - your gateway to ancient healing knowledge.\n\nI can help you discover:\n• Traditional herbs and their properties\n• Natural remedies for common ailments\n• Ayurvedic principles and practices\n• Wellness guidance from ancient texts\n\nTry asking: "What herbs help with stress?" or "Remedies for better digestion"',
//       timestamp: new Date(),
//       type: 'welcome'
//     }
//   ])
//   const [input, setInput] = useState('')
//   const [loading, setLoading] = useState(false)
//   const [isTyping, setIsTyping] = useState(false)
//   const [showGraph, setShowGraph] = useState(false)
//   const [graphType, setGraphType] = useState(null) // 'query' or 'full'
//   const [currentGraphData, setCurrentGraphData] = useState(null) // Current graph data to display
//   const [fullGraphData, setFullGraphData] = useState(null)
//   const [graphLoading, setGraphLoading] = useState(false)
//   const messagesEndRef = useRef(null)
//   const inputRef = useRef(null)
//   const networkRef = useRef(null)
//   const containerRef = useRef(null)

//   const scrollToBottom = () => {
//     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
//   }

//   useEffect(() => {
//     scrollToBottom()
//   }, [messages])

//   useEffect(() => {
//     inputRef.current?.focus()
//   }, [])

//   useEffect(() => {
//     if (showGraph && containerRef.current && currentGraphData) {
//       const { nodes, edges } = currentGraphData
      
//       // Clean up existing network first
//       if (networkRef.current) {
//         try {
//           networkRef.current.destroy()
//           networkRef.current = null
//         } catch (e) {
//           console.warn("Error destroying previous network:", e)
//         }
//       }

//       // Clear container
//       if (containerRef.current) {
//         containerRef.current.innerHTML = ''
//       }
      
//       // Validate data structure
//       if (!nodes || !edges || !Array.isArray(nodes) || !Array.isArray(edges)) {
//         console.error("Invalid graph data structure:", currentGraphData)
//         setMessages(m => [...m, {
//           from: 'bot',
//           text: '⚠️ Invalid knowledge graph data structure. Please try another query.',
//           timestamp: new Date(),
//           type: 'error'
//         }])
//         setShowGraph(false)
//         return
//       }

//       if (nodes.length === 0 || edges.length === 0) {
//         console.warn("Empty graph data:", { nodes: nodes.length, edges: edges.length })
//         setMessages(m => [...m, {
//           from: 'bot',
//           text: '⚠️ No data available for the knowledge graph. Please try another query or check the server logs.',
//           timestamp: new Date(),
//           type: 'error'
//         }])
//         setShowGraph(false)
//         return
//       }

//       try {
//         // Create unique IDs to avoid conflicts
//         const processedNodes = nodes.map((node, index) => ({
//           ...node,
//           id: node.id || `node_${index}_${Date.now()}`, // Ensure unique ID
//           font: { size: 12, color: '#1e293b' },
//           size: node.group === 'herbs' ? 25 : 20
//         }))
        
//         const processedEdges = edges.map((edge, index) => ({
//           ...edge,
//           id: edge.id || `edge_${index}_${Date.now()}`, // Ensure unique ID
//           arrows: 'to',
//           color: { color: '#94a3b8' },
//           font: { size: 10, align: 'middle' }
//         }))

//         console.log("Creating graph with:", { 
//           nodes: processedNodes.length, 
//           edges: processedEdges.length,
//           nodeIds: processedNodes.map(n => n.id).slice(0, 5),
//           edgeIds: processedEdges.map(e => e.id).slice(0, 5)
//         })

//         const visNodes = new DataSet(processedNodes)
//         const visEdges = new DataSet(processedEdges)
        
//         const options = {
//           nodes: {
//             borderWidth: 1,
//             shadow: true
//           },
//           edges: {
//             width: 2,
//             arrows: { to: { enabled: true, scaleFactor: 0.5 } }
//           },
//           physics: {
//             forceAtlas2Based: {
//               gravitationalConstant: -50,
//               centralGravity: 0.005,
//               springLength: 100,
//               springConstant: 0.18
//             },
//             maxVelocity: 50,
//             solver: 'forceAtlas2Based',
//             timestep: 0.35
//           },
//           interaction: { 
//             zoomView: true, 
//             dragView: true, 
//             multiselect: true,
//             hover: true
//           },
//           layout: { improvedLayout: true }
//         }
        
//         networkRef.current = new VisNetwork(containerRef.current, { nodes: visNodes, edges: visEdges }, options)
//         networkRef.current.stabilize(500)
        
//         console.log("Network created successfully")
//       } catch (e) {
//         console.error("Failed to initialize network:", e)
//         setMessages(m => [...m, {
//           from: 'bot',
//           text: `⚠️ Error rendering graph: ${e.message}. Try refreshing or checking the server logs.`,
//           timestamp: new Date(),
//           type: 'error'
//         }])
//         setShowGraph(false)
//       }
//     }
//   }, [showGraph, currentGraphData])

//   const fetchFullKG = async () => {
//     setGraphLoading(true)
//     try {
//       const res = await fetch(`${API_URL}/api/kg/full`, {
//         method: 'GET',
//         headers: { 'Content-Type': 'application/json' }
//       })
//       if (!res.ok) {
//         throw new Error(`Server error: ${res.status}`)
//       }
//       const data = await res.json()
//       if (data.error) {
//         throw new Error(data.error)
//       }
      
//       // Validate data structure
//       if (!data.nodes || !data.edges || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
//         throw new Error("Invalid knowledge graph data structure from server")
//       }
      
//       if (data.nodes.length === 0 || data.edges.length === 0) {
//         throw new Error("Received empty knowledge graph data")
//       }
      
//       setFullGraphData(data)
//       setCurrentGraphData(data) // Set as current data to display
//       setGraphType('full')
//       setShowGraph(true)
//     } catch (e) {
//       console.error("Failed to fetch full KG:", e)
//       setMessages(m => [...m, {
//         from: 'bot',
//         text: `⚠️ Failed to load full Knowledge Graph: ${e.message}. Please check the server at ${API_URL} and try again.`,
//         timestamp: new Date(),
//         type: 'error'
//       }])
//     } finally {
//       setGraphLoading(false)
//     }
//   }

//   const send = async () => {
//     if (!input.trim() || loading) return
    
//     const userMsg = {
//       from: 'user', 
//       text: input.trim(), 
//       timestamp: new Date(),
//       type: 'user'
//     }
//     setMessages(m => [...m, userMsg])
//     const currentInput = input.trim()
//     setInput('')
//     setLoading(true)
//     setIsTyping(true)
//     setShowGraph(false)
    
//     try {
//       await new Promise(resolve => setTimeout(resolve, 500))
      
//       const res = await fetch(`${API_URL}/api/chat`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ query: currentInput })
//       })
      
//       if (!res.ok) {
//         throw new Error(`Server error: ${res.status}`)
//       }
      
//       const data = await res.json()
//       if (data.error) {
//         throw new Error(data.error)
//       }
//       const botText = formatResults(data)
      
//       setMessages(m => [...m, {
//         from: 'bot', 
//         text: botText, 
//         timestamp: new Date(),
//         type: data.confidence === 'high' ? 'results' : 'no-results',
//         kg_data: data.kg_data
//       }])
//     } catch (e) {
//       console.error("API Error:", e)
//       setMessages(m => [...m, {
//         from: 'bot', 
//         text: `🔌 Connection Issue\n\nI'm having trouble connecting to the knowledge base: ${e.message}\n\nPlease check if the server is running at ${API_URL} and try again.`,
//         timestamp: new Date(),
//         type: 'error'
//       }])
//     } finally {
//       setLoading(false)
//       setIsTyping(false)
//     }
//   }

//   const formatResults = (data) => {
//     if (data.error) {
//       return `❌ Query Error\n\n${data.detail || data.error}\n\nTry rephrasing your question or ask about specific herbs like turmeric, ashwagandha, or neem.`
//     }
    
//     let responseText = data.response || 'No response available.'

//     // Always add KG sources section if KG data exists (regardless of errors)
//     if (data.kg_data && (
//         (data.kg_data.entities && data.kg_data.entities.length > 0) || 
//         (data.kg_data.relationships && Object.keys(data.kg_data.relationships).length > 0)
//       )) {
//       responseText += '\n\n📚 Sources from Knowledge Graph:'
      
//       if (data.kg_data.entities && data.kg_data.entities.length > 0) {
//         responseText += '\nEntities Found:'
//         data.kg_data.entities.slice(0, 3).forEach(entity => {
//           const description = entity.details?.description?.[0] || 'No description available'
//           responseText += `\n- ${entity.label} (${entity.type}): ${description}`
//         })
//       }
      
//       if (data.kg_data.relationships && Object.keys(data.kg_data.relationships).length > 0) {
//         responseText += '\nRelationships:'
//         Object.entries(data.kg_data.relationships).slice(0, 2).forEach(([key, items]) => {
//           const cleanKey = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()
//           if (Array.isArray(items) && items.length > 0) {
//             const relationshipItems = items.slice(0, 2).map(item => 
//               item.conditionLabel || item.herbLabel || item.label || 'Unknown'
//             ).join(', ')
//             responseText += `\n- ${cleanKey}: ${relationshipItems}`
//           }
//         })
//       }
//     }

//     return responseText
//   }

//   const showQueryGraph = (kgData) => {
//     console.log("Attempting to show query graph:", kgData)
    
//     // Clean up any existing network first
//     if (networkRef.current) {
//       try {
//         networkRef.current.destroy()
//         networkRef.current = null
//       } catch (e) {
//         console.warn("Error cleaning up network:", e)
//       }
//     }
    
//     if (!kgData || !kgData.visualization) {
//       console.error("No visualization data available:", kgData)
//       setMessages(m => [...m, {
//         from: 'bot',
//         text: '⚠️ No visualization data available for this query.',
//         timestamp: new Date(),
//         type: 'error'
//       }])
//       return
//     }

//     const { nodes, edges } = kgData.visualization
    
//     if (!nodes || !edges || !Array.isArray(nodes) || !Array.isArray(edges)) {
//       console.error("Invalid visualization data structure:", kgData.visualization)
//       setMessages(m => [...m, {
//         from: 'bot',
//         text: '⚠️ Invalid knowledge graph data structure.',
//         timestamp: new Date(),
//         type: 'error'
//       }])
//       return
//     }

//     if (nodes.length === 0 || edges.length === 0) {
//       console.warn("Empty visualization data:", { nodes: nodes.length, edges: edges.length })
//       setMessages(m => [...m, {
//         from: 'bot',
//         text: '⚠️ No nodes or edges available for visualization.',
//         timestamp: new Date(),
//         type: 'error'
//       }])
//       return
//     }

//     console.log("Setting up query graph with:", { nodes: nodes.length, edges: edges.length })
    
//     // Create a deep copy to avoid reference issues
//     const graphDataCopy = {
//       nodes: JSON.parse(JSON.stringify(nodes)),
//       edges: JSON.parse(JSON.stringify(edges))
//     }
    
//     setCurrentGraphData(graphDataCopy)
//     setGraphType('query')
//     setShowGraph(true)
//   }

//   const formatTime = (timestamp) => {
//     const now = new Date()
//     const diff = now - timestamp
    
//     if (diff < 60000) return 'Just now'
//     if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
//     return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
//   }

//   const quickQuestions = [
//     { text: "Herbs for stress relief", icon: "🧘" },
//     { text: "Natural digestive aids", icon: "🌿" },
//     { text: "Immunity boosting herbs", icon: "🛡️" },
//     { text: "Sleep promoting remedies", icon: "🌙" },
//     { text: "Anti-inflammatory herbs", icon: "🔥" },
//     { text: "Energy boosting adaptogens", icon: "⚡" }
//   ]

//   const getMessageIcon = (message) => {
//     switch (message.type) {
//       case 'welcome': return <Heart size={16} className="text-rose-400" />
//       case 'results': return <Sparkles size={16} className="text-emerald-400" />
//       case 'error': return <Zap size={16} className="text-amber-400" />
//       default: return <Leaf size={16} />
//     }
//   }

//   const getMessageStyle = (message) => {
//     const baseClasses = "message-bubble"
    
//     if (message.from === 'user') {
//       return `${baseClasses} user-message`
//     }
    
//     switch (message.type) {
//       case 'welcome':
//         return `${baseClasses} bot-message welcome-message`
//       case 'results':
//         return `${baseClasses} bot-message results-message`
//       case 'no-results':
//         return `${baseClasses} bot-message no-results-message`
//       case 'error':
//         return `${baseClasses} bot-message error-message`
//       default:
//         return `${baseClasses} bot-message`
//     }
//   }

//   return (
//     <div className="app-container">
//       {/* Animated Background */}
//       <div className="background-animation">
//         <div className="floating-leaf leaf-1">🍃</div>
//         <div className="floating-leaf leaf-2">🌿</div>
//         <div className="floating-leaf leaf-3">🍃</div>
//         <div className="floating-leaf leaf-4">🌱</div>
//       </div>

//       {/* Graph Visualization Modal */}
//       {showGraph && (
//         <div className="graph-modal">
//           <div className="graph-modal-content">
//             <button className="graph-close-button" onClick={() => {
//               setShowGraph(false)
//               // Clean up network when closing
//               if (networkRef.current) {
//                 try {
//                   networkRef.current.destroy()
//                   networkRef.current = null
//                 } catch (e) {
//                   console.warn("Error cleaning up network on close:", e)
//                 }
//               }
//             }}>
//               Close
//             </button>
//             <h3 className="graph-title">{graphType === 'full' ? 'Full Knowledge Graph' : 'Query Knowledge Graph'}</h3>
//             {graphLoading ? (
//               <div className="graph-loading">Loading graph...</div>
//             ) : (
//               <div ref={containerRef} className="graph-container" />
//             )}
//           </div>
//         </div>
//       )}

//       {/* Header Section */}
//       <header className="app-header">
//         <div className="header-content">
//           <div className="brand-section">
//             <div className="brand-icon">
//               <Leaf className="leaf-icon" />
//               <div className="icon-glow"></div>
//             </div>
//             <div className="brand-text">
//               <h1 className="brand-title">Ayurvedic Wisdom</h1>
//               <p className="brand-subtitle">Ancient Knowledge, Modern Discovery</p>
//             </div>
//           </div>
//           <div className="header-stats">
//             <div className="stat-item">
//               <MessageCircle size={16} />
//               <span>{messages.length} messages</span>
//             </div>
//             <button className="header-button" onClick={fetchFullKG} disabled={graphLoading}>
//               <Network size={16} /> {graphLoading ? 'Loading...' : 'View Full KG'}
//             </button>
//           </div>
//         </div>
//       </header>

//       {/* Main Chat Container */}
//       <main className="chat-container">
//         <div className="chat-window">
//           {/* Messages Area */}
//           <div className="messages-container">
//             {messages.map((message, index) => (
//               <div 
//                 key={index} 
//                 className={`message-wrapper ${message.from === 'user' ? 'user-wrapper' : 'bot-wrapper'}`}
//               >
//                 <div className="message-content">
//                   {message.from === 'bot' && (
//                     <div className="bot-avatar">
//                       <Bot size={18} />
//                       {getMessageIcon(message)}
//                     </div>
//                   )}
                  
//                   <div className={getMessageStyle(message)}>
//                     <div className="message-text">
//                       {message.text}
//                       {message.kg_data?.visualization?.nodes?.length > 0 && (
//                         <button
//                           className="view-graph-button"
//                           onClick={() => showQueryGraph(message.kg_data)}
//                         >
//                           <Network size={16} /> View Knowledge Graph
//                         </button>
//                       )}
//                     </div>
//                     <div className="message-meta">
//                       <Clock size={12} />
//                       <span>{formatTime(message.timestamp)}</span>
//                     </div>
//                   </div>
                  
//                   {message.from === 'user' && (
//                     <div className="user-avatar">
//                       <User size={18} />
//                     </div>
//                   )}
//                 </div>
//               </div>
//             ))}
            
//             {/* Typing Indicator */}
//             {isTyping && (
//               <div className="message-wrapper bot-wrapper">
//                 <div className="message-content">
//                   <div className="bot-avatar">
//                     <Bot size={18} />
//                   </div>
//                   <div className="typing-indicator">
//                     <div className="typing-dots">
//                       <span></span>
//                       <span></span>
//                       <span></span>
//                     </div>
//                     <span className="typing-text">Consulting ancient texts...</span>
//                   </div>
//                 </div>
//               </div>
//             )}
            
//             <div ref={messagesEndRef} />
//           </div>

//           {/* Quick Questions */}
//           {messages.length === 1 && !loading && (
//             <div className="quick-questions">
//               <h3 className="quick-title">
//                 <Sparkles size={16} />
//                 Popular Questions
//               </h3>
//               <div className="questions-grid">
//                 {quickQuestions.map((question, idx) => (
//                   <button
//                     key={idx}
//                     onClick={() => setInput(question.text)}
//                     className="question-card"
//                   >
//                     <span className="question-icon">{question.icon}</span>
//                     <span className="question-text">{question.text}</span>
//                   </button>
//                 ))}
//               </div>
//             </div>
//           )}

//           {/* Input Area */}
//           <div className="input-section">
//             <div className="input-container">
//               <div className="input-wrapper">
//                 <MessageCircle className="input-icon" size={20} />
//                 <input
//                   ref={inputRef}
//                   type="text"
//                   value={input}
//                   onChange={(e) => setInput(e.target.value)}
//                   onKeyDown={(e) => {
//                     if (e.key === 'Enter' && !e.shiftKey) {
//                       e.preventDefault()
//                       send()
//                     }
//                   }}
//                   placeholder="Ask about herbs, remedies, or wellness practices..."
//                   disabled={loading}
//                   className="message-input"
//                   maxLength={500}
//                 />
//                 <div className="input-actions">
//                   <span className="char-counter">{input.length}/500</span>
//                   <button
//                     onClick={send}
//                     disabled={loading || !input.trim()}
//                     className="send-button"
//                   >
//                     {loading ? (
//                       <Sparkles className="send-icon spinning" size={18} />
//                     ) : (
//                       <Send className="send-icon" size={18} />
//                     )}
//                   </button>
//                 </div>
//               </div>
//             </div>
            
//             <div className="input-footer">
//               <p className="disclaimer">
//                 🌿 Powered by traditional Ayurvedic knowledge • Always consult healthcare professionals for medical advice
//               </p>
//             </div>
//           </div>
//         </div>
//       </main>
//     </div>
//   )
// }









////////////////////////////////////////////////////////////////////////////////////////












// import React, { useState, useRef, useEffect } from 'react'
// import { Send, Leaf, MessageCircle, Sparkles, Clock, Bot, User, Zap, Heart, Network } from 'lucide-react'
// import { Network as VisNetwork } from 'vis-network'
// import { DataSet } from 'vis-data'

// const API_URL = import.meta.env?.VITE_API_URL || 'http://127.0.0.1:5000'

// export default function App() {
//   const [messages, setMessages] = useState([
//     {
//       from: 'bot', 
//       text: 'Namaste! 🙏 Welcome to Ayurvedic Wisdom - your gateway to ancient healing knowledge.\n\nI can help you discover:\n• Traditional herbs and their properties\n• Natural remedies for common ailments\n• Ayurvedic principles and practices\n• Wellness guidance from ancient texts\n\nTry asking: "What herbs help with stress?" or "Remedies for better digestion"',
//       timestamp: new Date(),
//       type: 'welcome'
//     }
//   ])
//   const [input, setInput] = useState('')
//   const [loading, setLoading] = useState(false)
//   const [isTyping, setIsTyping] = useState(false)
//   const [showGraph, setShowGraph] = useState(false)
//   const [graphType, setGraphType] = useState(null) // 'query' or 'full'
//   const [fullGraphData, setFullGraphData] = useState(null)
//   const [graphLoading, setGraphLoading] = useState(false)
//   const messagesEndRef = useRef(null)
//   const inputRef = useRef(null)
//   const networkRef = useRef(null)
//   const containerRef = useRef(null)

//   const scrollToBottom = () => {
//     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
//   }

//   useEffect(() => {
//     scrollToBottom()
//   }, [messages])

//   useEffect(() => {
//     inputRef.current?.focus()
//   }, [])

//   useEffect(() => {
//     if (showGraph && containerRef.current && (graphType === 'query' || graphType === 'full')) {
//       let nodes, edges;
//       if (graphType === 'full' && fullGraphData) {
//         ({ nodes, edges } = fullGraphData)
//       } else if (graphType === 'query' && messages[messages.length - 1]?.kg_data?.visualization) {
//         ({ nodes, edges } = messages[messages.length - 1].kg_data.visualization)
//       } else {
//         return
//       }
//       if (!nodes.length || !edges.length) {
//         setMessages(m => [...m, {
//           from: 'bot',
//           text: '⚠️ No data available for the knowledge graph. Please try another query or check the server logs.',
//           timestamp: new Date(),
//           type: 'error'
//         }])
//         setShowGraph(false)
//         return
//       }
//       const visNodes = new DataSet(nodes.map(node => ({
//         ...node,
//         font: { size: 12, color: '#1e293b' },
//         size: node.group === 'herbs' ? 25 : 20
//       })))
//       const visEdges = new DataSet(edges.map(edge => ({
//         ...edge,
//         arrows: 'to',
//         color: { color: '#94a3b8' },
//         font: { size: 10, align: 'middle' }
//       })))
//       const options = {
//         nodes: {
//           borderWidth: 1,
//           shadow: true
//         },
//         edges: {
//           width: 2,
//           arrows: { to: { enabled: true, scaleFactor: 0.5 } }
//         },
//         physics: {
//           forceAtlas2Based: {
//             gravitationalConstant: -50,
//             centralGravity: 0.005,
//             springLength: 100,
//             springConstant: 0.18
//           },
//           maxVelocity: 50,
//           solver: 'forceAtlas2Based',
//           timestep: 0.35
//         },
//         interaction: { 
//           zoomView: true, 
//           dragView: true, 
//           multiselect: true,
//           hover: true
//         },
//         layout: { improvedLayout: true }
//       }
//       try {
//         networkRef.current = new VisNetwork(containerRef.current, { nodes: visNodes, edges: visEdges }, options)
//         networkRef.current.stabilize(500)
//       } catch (e) {
//         console.error("Failed to initialize network:", e)
//         setMessages(m => [...m, {
//           from: 'bot',
//           text: `⚠️ Error rendering graph: ${e.message}. Try refreshing or checking the server logs.`,
//           timestamp: new Date(),
//           type: 'error'
//         }])
//       }
//     }
//   }, [showGraph, graphType, fullGraphData])

//   const fetchFullKG = async () => {
//     setGraphLoading(true)
//     try {
//       const res = await fetch(`${API_URL}/api/kg/full`, {
//         method: 'GET',
//         headers: { 'Content-Type': 'application/json' }
//       })
//       if (!res.ok) {
//         throw new Error(`Server error: ${res.status}`)
//       }
//       const data = await res.json()
//       if (data.error) {
//         throw new Error(data.error)
//       }
//       if (!data.nodes.length || !data.edges.length) {
//         throw new Error("Received empty knowledge graph data")
//       }
//       setFullGraphData(data)
//       setGraphType('full')
//       setShowGraph(true)
//     } catch (e) {
//       console.error("Failed to fetch full KG:", e)
//       setMessages(m => [...m, {
//         from: 'bot',
//         text: `⚠️ Failed to load full Knowledge Graph: ${e.message}. Please check the server at ${API_URL} and try again.`,
//         timestamp: new Date(),
//         type: 'error'
//       }])
//     } finally {
//       setGraphLoading(false)
//     }
//   }

//   const send = async () => {
//     if (!input.trim() || loading) return
    
//     const userMsg = {
//       from: 'user', 
//       text: input.trim(), 
//       timestamp: new Date(),
//       type: 'user'
//     }
//     setMessages(m => [...m, userMsg])
//     const currentInput = input.trim()
//     setInput('')
//     setLoading(true)
//     setIsTyping(true)
//     setShowGraph(false)
    
//     try {
//       await new Promise(resolve => setTimeout(resolve, 500))
      
//       const res = await fetch(`${API_URL}/api/chat`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ query: currentInput })
//       })
      
//       if (!res.ok) {
//         throw new Error(`Server error: ${res.status}`)
//       }
      
//       const data = await res.json()
//       if (data.error) {
//         throw new Error(data.error)
//       }
//       const botText = formatResults(data)
      
//       setMessages(m => [...m, {
//         from: 'bot', 
//         text: botText, 
//         timestamp: new Date(),
//         type: data.confidence === 'high' ? 'results' : 'no-results',
//         kg_data: data.kg_data
//       }])
//     } catch (e) {
//       setMessages(m => [...m, {
//         from: 'bot', 
//         text: `🔌 Connection Issue\n\nI'm having trouble connecting to the knowledge base: ${e.message}\n\nPlease check if the server is running at ${API_URL} and try again.`,
//         timestamp: new Date(),
//         type: 'error'
//       }])
//     } finally {
//       setLoading(false)
//       setIsTyping(false)
//     }
//   }

//   const formatResults = (data) => {
//     if (data.error) {
//       return `❌ Query Error\n\n${data.detail || data.error}\n\nTry rephrasing your question or ask about specific herbs like turmeric, ashwagandha, or neem.`
//     }
    
//     let responseText = data.response || 'No response available.'

//     // Always add KG sources section if KG data exists (regardless of errors)
//     if (data.kg_data && (data.kg_data.entities?.length > 0 || Object.keys(data.kg_data.relationships || {}).length > 0)) {
//       responseText += '\n\n📚 Sources from Knowledge Graph:'
      
//       if (data.kg_data.entities?.length > 0) {
//         responseText += '\nEntities Found:'
//         data.kg_data.entities.slice(0, 3).forEach(entity => {
//           const description = entity.details?.description?.[0] || 'No description available'
//           responseText += `\n- ${entity.label} (${entity.type}): ${description}`
//         })
//       }
      
//       if (Object.keys(data.kg_data.relationships || {}).length > 0) {
//         responseText += '\nRelationships:'
//         Object.entries(data.kg_data.relationships).slice(0, 2).forEach(([key, items]) => {
//           const cleanKey = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()
//           const relationshipItems = items.slice(0, 2).map(item => 
//             item.conditionLabel || item.herbLabel || item.label || 'Unknown'
//           ).join(', ')
//           responseText += `\n- ${cleanKey}: ${relationshipItems}`
//         })
//       }

//       // Add "View Knowledge Graph" note if visualization data exists
//       if (data.kg_data.visualization?.nodes?.length > 0) {
//         responseText += '\n\nView Knowledge Graph'
//       }
//     }

//     return responseText
//   }

//   const formatTime = (timestamp) => {
//     const now = new Date()
//     const diff = now - timestamp
    
//     if (diff < 60000) return 'Just now'
//     if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
//     return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
//   }

//   const quickQuestions = [
//     { text: "Herbs for stress relief", icon: "🧘" },
//     { text: "Natural digestive aids", icon: "🌿" },
//     { text: "Immunity boosting herbs", icon: "🛡️" },
//     { text: "Sleep promoting remedies", icon: "🌙" },
//     { text: "Anti-inflammatory herbs", icon: "🔥" },
//     { text: "Energy boosting adaptogens", icon: "⚡" }
//   ]

//   const getMessageIcon = (message) => {
//     switch (message.type) {
//       case 'welcome': return <Heart size={16} className="text-rose-400" />
//       case 'results': return <Sparkles size={16} className="text-emerald-400" />
//       case 'error': return <Zap size={16} className="text-amber-400" />
//       default: return <Leaf size={16} />
//     }
//   }

//   const getMessageStyle = (message) => {
//     const baseClasses = "message-bubble"
    
//     if (message.from === 'user') {
//       return `${baseClasses} user-message`
//     }
    
//     switch (message.type) {
//       case 'welcome':
//         return `${baseClasses} bot-message welcome-message`
//       case 'results':
//         return `${baseClasses} bot-message results-message`
//       case 'no-results':
//         return `${baseClasses} bot-message no-results-message`
//       case 'error':
//         return `${baseClasses} bot-message error-message`
//       default:
//         return `${baseClasses} bot-message`
//     }
//   }

//   return (
//     <div className="app-container">
//       {/* Animated Background */}
//       <div className="background-animation">
//         <div className="floating-leaf leaf-1">🍃</div>
//         <div className="floating-leaf leaf-2">🌿</div>
//         <div className="floating-leaf leaf-3">🍃</div>
//         <div className="floating-leaf leaf-4">🌱</div>
//       </div>

//       {/* Graph Visualization Modal */}
//       {showGraph && (
//         <div className="graph-modal">
//           <div className="graph-modal-content">
//             <button className="graph-close-button" onClick={() => setShowGraph(false)}>
//               Close
//             </button>
//             <h3 className="graph-title">{graphType === 'full' ? 'Full Knowledge Graph' : 'Query Knowledge Graph'}</h3>
//             {graphLoading ? (
//               <div className="graph-loading">Loading graph...</div>
//             ) : (
//               <div ref={containerRef} className="graph-container" />
//             )}
//           </div>
//         </div>
//       )}

//       {/* Header Section */}
//       <header className="app-header">
//         <div className="header-content">
//           <div className="brand-section">
//             <div className="brand-icon">
//               <Leaf className="leaf-icon" />
//               <div className="icon-glow"></div>
//             </div>
//             <div className="brand-text">
//               <h1 className="brand-title">Ayurvedic Wisdom</h1>
//               <p className="brand-subtitle">Ancient Knowledge, Modern Discovery</p>
//             </div>
//           </div>
//           <div className="header-stats">
//             <div className="stat-item">
//               <MessageCircle size={16} />
//               <span>{messages.length} messages</span>
//             </div>
//             <button className="header-button" onClick={fetchFullKG} disabled={graphLoading}>
//               <Network size={16} /> {graphLoading ? 'Loading...' : 'View Full KG'}
//             </button>
//           </div>
//         </div>
//       </header>

//       {/* Main Chat Container */}
//       <main className="chat-container">
//         <div className="chat-window">
//           {/* Messages Area */}
//           <div className="messages-container">
//             {messages.map((message, index) => (
//               <div 
//                 key={index} 
//                 className={`message-wrapper ${message.from === 'user' ? 'user-wrapper' : 'bot-wrapper'}`}
//               >
//                 <div className="message-content">
//                   {message.from === 'bot' && (
//                     <div className="bot-avatar">
//                       <Bot size={18} />
//                       {getMessageIcon(message)}
//                     </div>
//                   )}
                  
//                   <div className={getMessageStyle(message)}>
//                     <div className="message-text">
//                       {message.text}
//                       {message.kg_data?.visualization?.nodes?.length > 0 && (
//                         <button
//                           className="view-graph-button"
//                           onClick={() => {
//                             setGraphType('query')
//                             setShowGraph(true)
//                           }}
//                         >
//                           <Network size={16} /> View Knowledge Graph
//                         </button>
//                       )}
//                     </div>
//                     <div className="message-meta">
//                       <Clock size={12} />
//                       <span>{formatTime(message.timestamp)}</span>
//                     </div>
//                   </div>
                  
//                   {message.from === 'user' && (
//                     <div className="user-avatar">
//                       <User size={18} />
//                     </div>
//                   )}
//                 </div>
//               </div>
//             ))}
            
//             {/* Typing Indicator */}
//             {isTyping && (
//               <div className="message-wrapper bot-wrapper">
//                 <div className="message-content">
//                   <div className="bot-avatar">
//                     <Bot size={18} />
//                   </div>
//                   <div className="typing-indicator">
//                     <div className="typing-dots">
//                       <span></span>
//                       <span></span>
//                       <span></span>
//                     </div>
//                     <span className="typing-text">Consulting ancient texts...</span>
//                   </div>
//                 </div>
//               </div>
//             )}
            
//             <div ref={messagesEndRef} />
//           </div>

//           {/* Quick Questions */}
//           {messages.length === 1 && !loading && (
//             <div className="quick-questions">
//               <h3 className="quick-title">
//                 <Sparkles size={16} />
//                 Popular Questions
//               </h3>
//               <div className="questions-grid">
//                 {quickQuestions.map((question, idx) => (
//                   <button
//                     key={idx}
//                     onClick={() => setInput(question.text)}
//                     className="question-card"
//                   >
//                     <span className="question-icon">{question.icon}</span>
//                     <span className="question-text">{question.text}</span>
//                   </button>
//                 ))}
//               </div>
//             </div>
//           )}

//           {/* Input Area */}
//           <div className="input-section">
//             <div className="input-container">
//               <div className="input-wrapper">
//                 <MessageCircle className="input-icon" size={20} />
//                 <input
//                   ref={inputRef}
//                   type="text"
//                   value={input}
//                   onChange={(e) => setInput(e.target.value)}
//                   onKeyDown={(e) => {
//                     if (e.key === 'Enter' && !e.shiftKey) {
//                       e.preventDefault()
//                       send()
//                     }
//                   }}
//                   placeholder="Ask about herbs, remedies, or wellness practices..."
//                   disabled={loading}
//                   className="message-input"
//                   maxLength={500}
//                 />
//                 <div className="input-actions">
//                   <span className="char-counter">{input.length}/500</span>
//                   <button
//                     onClick={send}
//                     disabled={loading || !input.trim()}
//                     className="send-button"
//                   >
//                     {loading ? (
//                       <Sparkles className="send-icon spinning" size={18} />
//                     ) : (
//                       <Send className="send-icon" size={18} />
//                     )}
//                   </button>
//                 </div>
//               </div>
//             </div>
            
//             <div className="input-footer">
//               <p className="disclaimer">
//                 🌿 Powered by traditional Ayurvedic knowledge • Always consult healthcare professionals for medical advice
//               </p>
//             </div>
//           </div>
//         </div>
//       </main>
//     </div>
//   )















/////////////////////////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////////////////////
















// import React, { useState, useRef, useEffect } from 'react'
// import { Send, Leaf, MessageCircle, Sparkles, Clock, Bot, User, Zap, Heart, Network } from 'lucide-react'
// import { Network as VisNetwork } from 'vis-network'
// import { DataSet } from 'vis-data'

// const API_URL = import.meta.env?.VITE_API_URL || 'http://127.0.0.1:5000'

// export default function App() {
//   const [messages, setMessages] = useState([
//     {
//       from: 'bot', 
//       text: 'Namaste! 🙏 Welcome to Ayurvedic Wisdom - your gateway to ancient healing knowledge.\n\nI can help you discover:\n• Traditional herbs and their properties\n• Natural remedies for common ailments\n• Ayurvedic principles and practices\n• Wellness guidance from ancient texts\n\nTry asking: "What herbs help with stress?" or "Remedies for better digestion"',
//       timestamp: new Date(),
//       type: 'welcome'
//     }
//   ])
//   const [input, setInput] = useState('')
//   const [loading, setLoading] = useState(false)
//   const [isTyping, setIsTyping] = useState(false)
//   const [showGraph, setShowGraph] = useState(false)
//   const [graphType, setGraphType] = useState(null) // 'query' or 'full'
//   const [fullGraphData, setFullGraphData] = useState(null)
//   const [graphLoading, setGraphLoading] = useState(false)
//   const messagesEndRef = useRef(null)
//   const inputRef = useRef(null)
//   const networkRef = useRef(null)
//   const containerRef = useRef(null)

//   const scrollToBottom = () => {
//     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
//   }

//   useEffect(() => {
//     scrollToBottom()
//   }, [messages])

//   useEffect(() => {
//     inputRef.current?.focus()
//   }, [])

//   useEffect(() => {
//     if (showGraph && containerRef.current && (graphType === 'query' || graphType === 'full')) {
//       let nodes, edges;
//       if (graphType === 'full' && fullGraphData) {
//         ({ nodes, edges } = fullGraphData)
//       } else if (graphType === 'query' && messages[messages.length - 1]?.kg_data?.visualization) {
//         ({ nodes, edges } = messages[messages.length - 1].kg_data.visualization)
//       } else {
//         return
//       }
//       if (!nodes.length || !edges.length) {
//         setMessages(m => [...m, {
//           from: 'bot',
//           text: '⚠️ No data available for the knowledge graph. Please try another query or check the server logs.',
//           timestamp: new Date(),
//           type: 'error'
//         }])
//         setShowGraph(false)
//         return
//       }
//       const visNodes = new DataSet(nodes.map(node => ({
//         ...node,
//         font: { size: 12, color: '#1e293b' },
//         size: node.group === 'herbs' ? 25 : 20
//       })))
//       const visEdges = new DataSet(edges.map(edge => ({
//         ...edge,
//         arrows: 'to',
//         color: { color: '#94a3b8' },
//         font: { size: 10, align: 'middle' }
//       })))
//       const options = {
//         nodes: {
//           borderWidth: 1,
//           shadow: true
//         },
//         edges: {
//           width: 2,
//           arrows: { to: { enabled: true, scaleFactor: 0.5 } }
//         },
//         physics: {
//           forceAtlas2Based: {
//             gravitationalConstant: -50,
//             centralGravity: 0.005,
//             springLength: 100,
//             springConstant: 0.18
//           },
//           maxVelocity: 50,
//           solver: 'forceAtlas2Based',
//           timestep: 0.35
//         },
//         interaction: { 
//           zoomView: true, 
//           dragView: true, 
//           multiselect: true,
//           hover: true
//         },
//         layout: { improvedLayout: true }
//       }
//       try {
//         networkRef.current = new VisNetwork(containerRef.current, { nodes: visNodes, edges: visEdges }, options)
//         networkRef.current.stabilize(500)
//       } catch (e) {
//         console.error("Failed to initialize network:", e)
//         setMessages(m => [...m, {
//           from: 'bot',
//           text: `⚠️ Error rendering graph: ${e.message}. Try refreshing or checking the server logs.`,
//           timestamp: new Date(),
//           type: 'error'
//         }])
//       }
//     }
//   }, [showGraph, graphType, fullGraphData])

//   const fetchFullKG = async () => {
//     setGraphLoading(true)
//     try {
//       const res = await fetch(`${API_URL}/api/kg/full`, {
//         method: 'GET',
//         headers: { 'Content-Type': 'application/json' }
//       })
//       if (!res.ok) {
//         throw new Error(`Server error: ${res.status}`)
//       }
//       const data = await res.json()
//       if (data.error) {
//         throw new Error(data.error)
//       }
//       if (!data.nodes.length || !data.edges.length) {
//         throw new Error("Received empty knowledge graph data")
//       }
//       setFullGraphData(data)
//       setGraphType('full')
//       setShowGraph(true)
//     } catch (e) {
//       console.error("Failed to fetch full KG:", e)
//       setMessages(m => [...m, {
//         from: 'bot',
//         text: `⚠️ Failed to load full Knowledge Graph: ${e.message}. Please check the server at ${API_URL} and try again.`,
//         timestamp: new Date(),
//         type: 'error'
//       }])
//     } finally {
//       setGraphLoading(false)
//     }
//   }

//   const send = async () => {
//     if (!input.trim() || loading) return
    
//     const userMsg = {
//       from: 'user', 
//       text: input.trim(), 
//       timestamp: new Date(),
//       type: 'user'
//     }
//     setMessages(m => [...m, userMsg])
//     const currentInput = input.trim()
//     setInput('')
//     setLoading(true)
//     setIsTyping(true)
//     setShowGraph(false)
    
//     try {
//       await new Promise(resolve => setTimeout(resolve, 500))
      
//       const res = await fetch(`${API_URL}/api/chat`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ query: currentInput })
//       })
      
//       if (!res.ok) {
//         throw new Error(`Server error: ${res.status}`)
//       }
      
//       const data = await res.json()
//       if (data.error) {
//         throw new Error(data.error)
//       }
//       const botText = formatResults(data)
      
//       setMessages(m => [...m, {
//         from: 'bot', 
//         text: botText, 
//         timestamp: new Date(),
//         type: data.confidence === 'high' ? 'results' : 'no-results',
//         kg_data: data.kg_data
//       }])
//     } catch (e) {
//       setMessages(m => [...m, {
//         from: 'bot', 
//         text: `🔌 Connection Issue\n\nI'm having trouble connecting to the knowledge base: ${e.message}\n\nPlease check if the server is running at ${API_URL} and try again.`,
//         timestamp: new Date(),
//         type: 'error'
//       }])
//     } finally {
//       setLoading(false)
//       setIsTyping(false)
//     }
//   }

//   const formatResults = (data) => {
//     if (data.error) {
//       return `❌ Query Error\n\n${data.detail || data.error}\n\nTry rephrasing your question or ask about specific herbs like turmeric, ashwagandha, or neem.`
//     }
    
//     let responseText = data.response || 'No response available.'

//     if (data.kg_data && (data.kg_data.entities?.length > 0 || Object.keys(data.kg_data.relationships || {}).length > 0)) {
//       responseText += '\n\n📚 Sources from Knowledge Graph:'
      
//       if (data.kg_data.entities?.length > 0) {
//         responseText += '\nEntities Found:'
//         data.kg_data.entities.forEach(entity => {
//           responseText += `\n- ${entity.label} (${entity.type}): ${entity.details.description?.[0] || 'No description available.'}`
//         })
//       }
      
//       if (Object.keys(data.kg_data.relationships || {}).length > 0) {
//         responseText += '\nRelationships:'
//         Object.entries(data.kg_data.relationships).forEach(([key, items]) => {
//           responseText += `\n- ${key}: ${items.map(item => item.conditionLabel || item.herbLabel || item.label || '').join(', ')}`
//         })
//       }
//     } else {
//       responseText += '\n\nℹ️ General Ayurvedic guidance provided.'
//     }

//     return responseText
//   }

//   const formatTime = (timestamp) => {
//     const now = new Date()
//     const diff = now - timestamp
    
//     if (diff < 60000) return 'Just now'
//     if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
//     return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
//   }

//   const quickQuestions = [
//     { text: "Herbs for stress relief", icon: "🧘" },
//     { text: "Natural digestive aids", icon: "🌿" },
//     { text: "Immunity boosting herbs", icon: "🛡️" },
//     { text: "Sleep promoting remedies", icon: "🌙" },
//     { text: "Anti-inflammatory herbs", icon: "🔥" },
//     { text: "Energy boosting adaptogens", icon: "⚡" }
//   ]

//   const getMessageIcon = (message) => {
//     switch (message.type) {
//       case 'welcome': return <Heart size={16} className="text-rose-400" />
//       case 'results': return <Sparkles size={16} className="text-emerald-400" />
//       case 'error': return <Zap size={16} className="text-amber-400" />
//       default: return <Leaf size={16} />
//     }
//   }

//   const getMessageStyle = (message) => {
//     const baseClasses = "message-bubble"
    
//     if (message.from === 'user') {
//       return `${baseClasses} user-message`
//     }
    
//     switch (message.type) {
//       case 'welcome':
//         return `${baseClasses} bot-message welcome-message`
//       case 'results':
//         return `${baseClasses} bot-message results-message`
//       case 'no-results':
//         return `${baseClasses} bot-message no-results-message`
//       case 'error':
//         return `${baseClasses} bot-message error-message`
//       default:
//         return `${baseClasses} bot-message`
//     }
//   }

//   return (
//     <div className="app-container">
//       {/* Animated Background */}
//       <div className="background-animation">
//         <div className="floating-leaf leaf-1">🍃</div>
//         <div className="floating-leaf leaf-2">🌿</div>
//         <div className="floating-leaf leaf-3">🍃</div>
//         <div className="floating-leaf leaf-4">🌱</div>
//       </div>

//       {/* Graph Visualization Modal */}
//       {showGraph && (
//         <div className="graph-modal">
//           <div className="graph-modal-content">
//             <button className="graph-close-button" onClick={() => setShowGraph(false)}>
//               Close
//             </button>
//             <h3 className="graph-title">{graphType === 'full' ? 'Full Knowledge Graph' : 'Query Knowledge Graph'}</h3>
//             {graphLoading ? (
//               <div className="graph-loading">Loading graph...</div>
//             ) : (
//               <div ref={containerRef} className="graph-container" />
//             )}
//           </div>
//         </div>
//       )}

//       {/* Header Section */}
//       <header className="app-header">
//         <div className="header-content">
//           <div className="brand-section">
//             <div className="brand-icon">
//               <Leaf className="leaf-icon" />
//               <div className="icon-glow"></div>
//             </div>
//             <div className="brand-text">
//               <h1 className="brand-title">Ayurvedic Wisdom</h1>
//               <p className="brand-subtitle">Ancient Knowledge, Modern Discovery</p>
//             </div>
//           </div>
//           <div className="header-stats">
//             <div className="stat-item">
//               <MessageCircle size={16} />
//               <span>{messages.length} messages</span>
//             </div>
//             <button className="header-button" onClick={fetchFullKG} disabled={graphLoading}>
//               <Network size={16} /> {graphLoading ? 'Loading...' : 'View Full KG'}
//             </button>
//           </div>
//         </div>
//       </header>

//       {/* Main Chat Container */}
//       <main className="chat-container">
//         <div className="chat-window">
//           {/* Messages Area */}
//           <div className="messages-container">
//             {messages.map((message, index) => (
//               <div 
//                 key={index} 
//                 className={`message-wrapper ${message.from === 'user' ? 'user-wrapper' : 'bot-wrapper'}`}
//               >
//                 <div className="message-content">
//                   {message.from === 'bot' && (
//                     <div className="bot-avatar">
//                       <Bot size={18} />
//                       {getMessageIcon(message)}
//                     </div>
//                   )}
                  
//                   <div className={getMessageStyle(message)}>
//                     <div className="message-text">
//                       {message.text}
//                       {message.kg_data?.visualization?.nodes?.length > 0 && (
//                         <button
//                           className="view-graph-button"
//                           onClick={() => {
//                             setGraphType('query')
//                             setShowGraph(true)
//                           }}
//                         >
//                           <Network size={16} /> View Knowledge Graph
//                         </button>
//                       )}
//                     </div>
//                     <div className="message-meta">
//                       <Clock size={12} />
//                       <span>{formatTime(message.timestamp)}</span>
//                     </div>
//                   </div>
                  
//                   {message.from === 'user' && (
//                     <div className="user-avatar">
//                       <User size={18} />
//                     </div>
//                   )}
//                 </div>
//               </div>
//             ))}
            
//             {/* Typing Indicator */}
//             {isTyping && (
//               <div className="message-wrapper bot-wrapper">
//                 <div className="message-content">
//                   <div className="bot-avatar">
//                     <Bot size={18} />
//                   </div>
//                   <div className="typing-indicator">
//                     <div className="typing-dots">
//                       <span></span>
//                       <span></span>
//                       <span></span>
//                     </div>
//                     <span className="typing-text">Consulting ancient texts...</span>
//                   </div>
//                 </div>
//               </div>
//             )}
            
//             <div ref={messagesEndRef} />
//           </div>

//           {/* Quick Questions */}
//           {messages.length === 1 && !loading && (
//             <div className="quick-questions">
//               <h3 className="quick-title">
//                 <Sparkles size={16} />
//                 Popular Questions
//               </h3>
//               <div className="questions-grid">
//                 {quickQuestions.map((question, idx) => (
//                   <button
//                     key={idx}
//                     onClick={() => setInput(question.text)}
//                     className="question-card"
//                   >
//                     <span className="question-icon">{question.icon}</span>
//                     <span className="question-text">{question.text}</span>
//                   </button>
//                 ))}
//               </div>
//             </div>
//           )}

//           {/* Input Area */}
//           <div className="input-section">
//             <div className="input-container">
//               <div className="input-wrapper">
//                 <MessageCircle className="input-icon" size={20} />
//                 <input
//                   ref={inputRef}
//                   type="text"
//                   value={input}
//                   onChange={(e) => setInput(e.target.value)}
//                   onKeyDown={(e) => {
//                     if (e.key === 'Enter' && !e.shiftKey) {
//                       e.preventDefault()
//                       send()
//                     }
//                   }}
//                   placeholder="Ask about herbs, remedies, or wellness practices..."
//                   disabled={loading}
//                   className="message-input"
//                   maxLength={500}
//                 />
//                 <div className="input-actions">
//                   <span className="char-counter">{input.length}/500</span>
//                   <button
//                     onClick={send}
//                     disabled={loading || !input.trim()}
//                     className="send-button"
//                   >
//                     {loading ? (
//                       <Sparkles className="send-icon spinning" size={18} />
//                     ) : (
//                       <Send className="send-icon" size={18} />
//                     )}
//                   </button>
//                 </div>
//               </div>
//             </div>
            
//             <div className="input-footer">
//               <p className="disclaimer">
//                 🌿 Powered by traditional Ayurvedic knowledge • Always consult healthcare professionals for medical advice
//               </p>
//             </div>
//           </div>
//         </div>
//       </main>
//     </div>
//   )
// }