import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader, Settings, Code, Users, MessageCircle, ShoppingBag, RefreshCw, LogOut, Database, Zap, CheckCircle, XCircle, Globe, FolderOpen, Shield, Activity, FileText, Layers, UserPlus, LogIn, Menu, X } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SidebarProvider, useSidebar } from './contexts/SidebarContext';
import { useWorkspaceConfig } from './hooks/useWorkspaceConfig';
import { useConversations } from './hooks/useConversations';
import { useConversationController } from './hooks/useConversationController';
import AuthModal from './components/auth/AuthModal';
import Sidebar from './components/sidebar/Sidebar';

// Icon mapping for consistent display
const iconMap = {
  '📋': <Database className="w-4 h-4 text-blue-600" />,
  '🚀': <Zap className="w-4 h-4 text-purple-600" />,
  '⚡': <Activity className="w-4 h-4 text-yellow-600" />,
  '🎉': <CheckCircle className="w-4 h-4 text-green-600" />,
  '📊': <Layers className="w-4 h-4 text-indigo-600" />,
  '🔧': <FileText className="w-4 h-4 text-gray-600" />,
  '📁': <FolderOpen className="w-4 h-4 text-orange-600" />,
  '🔐': <Shield className="w-4 h-4 text-red-600" />,
  '📍': <Activity className="w-4 h-4 text-pink-600" />,
  '✅': <CheckCircle className="w-4 h-4 text-green-600" />,
  '❌': <XCircle className="w-4 h-4 text-red-600" />,
  '🌐': <Globe className="w-4 h-4 text-cyan-600" />,
  '📚': <Database className="w-4 h-4 text-blue-600" />,
  '📝': <FileText className="w-4 h-4 text-gray-600" />,
  '🆔': <Activity className="w-4 h-4 text-indigo-600" />,
  '🔄': <RefreshCw className="w-4 h-4 text-blue-600" />,
  '✨': <Zap className="w-4 h-4 text-yellow-600" />,
  '👋': <User className="w-4 h-4 text-gray-600" />
};

// Simple markdown renderer component
const MessageContent = ({ content }) => {
  // Ensure content is a string
  if (typeof content !== 'string') {
    console.error('MessageContent received non-string content:', content);
    return <div className="text-red-500">Error: Invalid message content</div>;
  }
  
  // Split content into lines and process each
  const lines = content.split('\n');
  const elements = [];
  let inCodeBlock = false;
  let codeLines = [];
  let codeLanguage = '';
  
  lines.forEach((line, index) => {
    // Check for code blocks
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLanguage = line.slice(3).trim() || 'text';
        codeLines = [];
      } else {
        // End of code block
        elements.push(
          <pre key={`code-${index}`} className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto my-2">
            <code>{codeLines.join('\n')}</code>
          </pre>
        );
        inCodeBlock = false;
        codeLines = [];
      }
      return;
    }
    
    if (inCodeBlock) {
      codeLines.push(line);
      return;
    }
    
    // Process inline formatting
    let processedLine = line;
    
    // Bold text
    processedLine = processedLine.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>');
    
    // Code inline
    processedLine = processedLine.replace(/`(.+?)`/g, '<code class="bg-slate-100 px-1 py-0.5 rounded text-xs">$1</code>');
    
    // Check for icon at start of line and replace with React icon
    const firstChar = line.charAt(0);
    if (iconMap[firstChar]) {
      elements.push(
        <div key={index} className="flex items-start gap-2">
          <span className="mt-0.5 flex-shrink-0">{iconMap[firstChar]}</span>
          <div 
            className="flex-1"
            dangerouslySetInnerHTML={{ __html: processedLine.slice(1) }}
          />
        </div>
      );
      return;
    }
    
    // Bullet points
    if (processedLine.trim().startsWith('•')) {
      processedLine = `<span class="ml-4">${processedLine}</span>`;
    }
    
    elements.push(
      <div 
        key={index} 
        className={line.trim() === '' ? 'h-2' : ''}
        dangerouslySetInnerHTML={{ __html: processedLine }}
      />
    );
  });
  
  return <div className="space-y-1 markdown-content">{elements}</div>;
};

const TosChat = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { isOpen: sidebarOpen, toggleSidebar, setActiveTab } = useSidebar();
  const { activeConfig } = useWorkspaceConfig();
  const { getMostRecentConversation, fetchConversations, createConversation, incrementMessageCount } = useConversations();
  
  // Use the new conversation controller with message persistence callback
  const {
    activeConversationId,
    messages: controllerMessages,
    isLoading: controllerLoading,
    switchToConversation,
    startNewConversation: controllerStartNew,
    handleConversationDeleted,
    persistUserMessage,
    persistAssistantMessage
  } = useConversationController(() => {
    // Callback when message is persisted - update message count optimistically
    console.log('🔄 Message persisted callback - updating message count...');
    if (activeConversationId) {
      incrementMessageCount(activeConversationId.toString());
    }
  });
  
  // State declarations - moved up before useEffect
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Sync controller messages with local state
  useEffect(() => {
    setMessages(controllerMessages);
  }, [controllerMessages]);
  
  // Sync controller loading state
  useEffect(() => {
    if (controllerLoading !== undefined) {
      setIsLoading(controllerLoading);
    }
  }, [controllerLoading]);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalTab, setAuthModalTab] = useState('login');
  const [connectionAttempted, setConnectionAttempted] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [sessionExpiresAt, setSessionExpiresAt] = useState(null);
  
  // Connection settings
  const [xanoToken, setXanoToken] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [instanceDomain, setInstanceDomain] = useState('');
  const [showQuickstart, setShowQuickstart] = useState(true);

  // Initialize conversation on page load - SIMPLIFIED with new controller
  useEffect(() => {
    console.log('🚀 Initializing conversation on page load...', {
      isAuthenticated,
      activeConversationId,
      userName: user?.name,
      messagesCount: controllerMessages.length
    });
    
    if (!isAuthenticated) {
      // Show welcome message for non-authenticated users
      setMessages([{
        id: Date.now(),
        sender: 'tos',
        content: `👋 Welcome to Tos! I'm your AI backend developer assistant. 

I can help you build complete Xano backends including:
• User authentication systems
• Database tables and schemas  
• API endpoints and logic
• Real-time features
• E-commerce functionality

Create an account to save your workspaces and sync across devices!`,
        timestamp: new Date()
      }]);
      return;
    }

    // If there's an active conversation ID and messages are loaded, don't override them
    if (activeConversationId && controllerMessages.length > 0) {
      console.log('📂 Active conversation with messages loaded, skipping welcome messages');
      return;
    }

    // If no active conversation, check if any conversations exist
    if (!activeConversationId) {
      const mostRecent = getMostRecentConversation();
      
      if (!mostRecent && isConnected) {
        // No conversations exist
        setMessages([{
          id: Date.now(),
          sender: 'tos',
          content: `📝 **No conversations exist**

Please create a new conversation to start chatting! Click the "New Conversation" button in the sidebar.`,
          timestamp: new Date()
        }]);
      } else if (!mostRecent && !isConnected) {
        // Not connected
        setMessages([{
          id: Date.now(),
          sender: 'tos',
          content: `👋 Welcome back${user?.name ? `, ${user.name}` : ''}! Connect your Xano workspace to get started.`,
          timestamp: new Date()
        }]);
      } else if (mostRecent && isConnected) {
        // Conversations exist but none active
        setMessages([{
          id: Date.now(),
          sender: 'tos',
          content: `👋 Welcome back${user?.name ? `, ${user.name}` : ''}! Select a conversation from the sidebar or create a new one.`,
          timestamp: new Date()
        }]);
      }
    }
  }, [isAuthenticated, activeConversationId, isConnected, user?.name, controllerMessages.length]);

  // Removed confusing migration prompt logic

  // Load a conversation from chat history using new controller
  const handleLoadConversation = async (conversationId) => {
    if (!isAuthenticated) return;
    
    console.log('🚨 HANDLE LOAD CONVERSATION CALLED WITH ID:', conversationId, typeof conversationId);
    console.log('🚨 CURRENT ACTIVE CONVERSATION ID:', activeConversationId);
    
    await switchToConversation(conversationId);
    
    // Close sidebar on mobile after selecting conversation
    if (window.innerWidth < 1024) {
      toggleSidebar();
    }
    
    // No need to refresh sidebar when just switching conversations
  };

  // Handle conversation deletion with controller integration
  const handleConversationDelete = async (conversationId) => {
    console.log('🗑️ Handling conversation deletion:', conversationId);
    
    // Notify controller about deletion (will clear chat if it's the active conversation)
    handleConversationDeleted(parseInt(conversationId));
    
    // No need to refresh sidebar - useConversations deleteConversation already removes from local state
  };

  // Removed migration handler function
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load saved credentials on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('tos_xano_token');
    const savedWorkspaceId = localStorage.getItem('tos_workspace_id');
    const savedInstanceDomain = localStorage.getItem('tos_instance_domain');
    const savedSessionExpiry = localStorage.getItem('tos_session_expires_at');
    
    if (savedToken) setXanoToken(savedToken);
    if (savedWorkspaceId) setWorkspaceId(savedWorkspaceId);
    if (savedInstanceDomain) setInstanceDomain(savedInstanceDomain);
    if (savedSessionExpiry) setSessionExpiresAt(savedSessionExpiry);
    
    // Expose function to clear connection state (for use in workspace config)
    window.clearConnectionState = () => {
      setConnectionAttempted(false);
      setConnectionError(null);
    };
    
    // Cleanup
    return () => {
      delete window.clearConnectionState;
    };
  }, []);

  // Session expiry monitoring and auto-refresh
  useEffect(() => {
    if (!sessionExpiresAt || !isConnected) return;

    const checkSessionExpiry = () => {
      const now = new Date();
      const expiryTime = new Date(sessionExpiresAt);
      const timeUntilExpiry = expiryTime - now;
      const fifteenMinutes = 15 * 60 * 1000; // 15 minutes in milliseconds

      // If session expires in less than 15 minutes, try to refresh
      if (timeUntilExpiry > 0 && timeUntilExpiry < fifteenMinutes) {
        console.log('⏰ Session expiring soon, attempting refresh...');
        handleSessionRefresh();
      } else if (timeUntilExpiry <= 0) {
        console.log('⏰ Session expired, disconnecting...');
        handleSessionExpiry();
      }
    };

    // Check immediately and then every 5 minutes
    checkSessionExpiry();
    const interval = setInterval(checkSessionExpiry, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [sessionExpiresAt, isConnected]);

  // Handle session refresh
  const handleSessionRefresh = async () => {
    if (!activeConfig) return;

    try {
      console.log('🔄 Refreshing session...');
      await connectWithConfig(activeConfig);
    } catch (error) {
      console.error('❌ Failed to refresh session:', error);
      handleSessionExpiry();
    }
  };

  // Handle session expiry
  const handleSessionExpiry = () => {
    console.log('🔌 Session expired, disconnecting...');
    setIsConnected(false);
    setSessionId(null);
    setSessionExpiresAt(null);
    setConnectionAttempted(false);
    
    // Show user-friendly message
    const expiryMessage = {
      id: Date.now(),
      sender: 'tos',
      content: `⏰ **Session Expired**: Your connection to Xano has expired after 24 hours for security.

Click the connection status to reconnect to your workspace, or the system will automatically reconnect when you send a message.`,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, expiryMessage]);
  };

  // Auto-connect when active workspace config is available
  useEffect(() => {
    // Only attempt connection if:
    // 1. User is authenticated
    // 2. There's an active config
    // 3. Not already connected
    // 4. Not currently loading
    // 5. Haven't attempted connection yet (to prevent loops)
    // 6. No recent connection error
    // 7. Active config has all required fields
    if (
      isAuthenticated && 
      activeConfig && 
      !isConnected && 
      !isLoading && 
      !connectionAttempted && 
      !connectionError &&
      activeConfig.xano_metadata_api_key && activeConfig.xano_metadata_api_key.trim() !== '' &&
      activeConfig.target_workspace_id &&
      activeConfig.instance_domain && activeConfig.instance_domain.trim() !== ''
    ) {
      console.log(`🔄 Auto-connecting to workspace: ${activeConfig.config_name}`);
      setConnectionAttempted(true);
      connectWithConfig(activeConfig);
    } else if (activeConfig && (!activeConfig.xano_metadata_api_key || activeConfig.xano_metadata_api_key.trim() === '' || !activeConfig.target_workspace_id || !activeConfig.instance_domain || activeConfig.instance_domain.trim() === '')) {
      console.warn('⚠️ Active workspace config is incomplete, skipping auto-connect:', {
        config_name: activeConfig.config_name,
        has_api_key: !!activeConfig.xano_metadata_api_key,
        has_workspace_id: !!activeConfig.target_workspace_id,
        has_instance_domain: !!activeConfig.instance_domain,
        api_key_value: activeConfig.xano_metadata_api_key ? '***' + activeConfig.xano_metadata_api_key.slice(-4) : 'missing',
        workspace_id_value: activeConfig.target_workspace_id,
        instance_domain_value: activeConfig.instance_domain
      });
    }
  }, [isAuthenticated, activeConfig, isConnected, isLoading, connectionAttempted, connectionError]);

  // Enhanced workspace switching: Auto-reconnect when manually connecting with different workspace
  const connectWithConfigAndSwitch = async (config) => {
    console.log(`🔄 Switching to workspace: ${config.config_name}`);
    
    // If currently connected to a different workspace, disconnect first
    if (isConnected && activeConfig && activeConfig.id !== config.id) {
      console.log(`📤 Disconnecting from current workspace: ${activeConfig.config_name}`);
      handleDisconnect();
      
      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Reset connection state for fresh connection
    setConnectionAttempted(false);
    setConnectionError(null);
    
    // Connect to the new workspace
    return await connectWithConfig(config);
  };

  // Connect using workspace configuration
  const connectWithConfig = async (config) => {
    if (!config) {
      console.error('No workspace config provided');
      return false;
    }

    // Validate required fields (check for empty strings too)
    if (!config.xano_metadata_api_key || config.xano_metadata_api_key.trim() === '' || 
        !config.target_workspace_id || 
        !config.instance_domain || config.instance_domain.trim() === '') {
      console.error('Invalid workspace config - missing required fields:', {
        hasApiKey: !!config.xano_metadata_api_key,
        hasWorkspaceId: !!config.target_workspace_id,
        hasInstanceDomain: !!config.instance_domain,
        config
      });
      
      const errorMsg = 'Invalid workspace configuration. Please check your settings.';
      setConnectionError(errorMsg);
      
      const errorMessage = {
        id: Date.now(),
        sender: 'tos',
        content: `❌ **Configuration Error**: Missing required fields in workspace configuration.

Please go to Settings → Workspace Configurations and ensure all fields are filled:
• Anthropic API Key
• Xano Metadata API Key
• Target Workspace ID
• Instance Domain`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      
      return false;
    }

    setIsLoading(true);
    setConnectionError(null);
    
    // Log what we're sending
    console.log('🔌 Attempting connection with config:', {
      config_name: config.config_name,
      workspace_id: config.target_workspace_id,
      instance_domain: config.instance_domain,
      has_api_key: !!config.xano_metadata_api_key
    });
    
    try {
      const requestBody = {
        xano_token: config.xano_metadata_api_key,
        workspace_id: parseInt(config.target_workspace_id),
        instance_domain: config.instance_domain
      };
      
      console.log('📤 Sending connection request:', {
        ...requestBody,
        xano_token: requestBody.xano_token ? '***' + requestBody.xano_token.slice(-4) : 'missing'
      });
      
      const response = await fetch('http://localhost:3001/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      
      if (data.success) {
        setSessionId(data.session_id);
        setIsConnected(true);
        setConnectionError(null);
        
        // Calculate session expiry (24 hours from now)
        const expiryTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
        setSessionExpiresAt(expiryTime.toISOString());
        
        // Update state with config values
        setXanoToken(config.xano_metadata_api_key);
        setWorkspaceId(config.target_workspace_id);
        setInstanceDomain(config.instance_domain);
        
        // Save credentials to localStorage (for backward compatibility)
        localStorage.setItem('tos_xano_token', config.xano_metadata_api_key);
        localStorage.setItem('tos_workspace_id', config.target_workspace_id);
        localStorage.setItem('tos_instance_domain', config.instance_domain);
        localStorage.setItem('tos_active_config_id', config.id);
        localStorage.setItem('tos_session_expires_at', expiryTime.toISOString());
        
        // DO NOT CREATE CONVERSATIONS AUTOMATICALLY!
        // Conversations should only be created by explicit user action

        const successMessage = {
          id: Date.now(),
          sender: 'tos',
          content: `🎉 Successfully connected to your Xano workspace! 

Configuration: ${config.config_name}
• Instance: ${config.instance_domain}
• Workspace ID: ${config.target_workspace_id}
• Session: ${data.session_id}
• Expires: ${expiryTime.toLocaleString()}

I'm now ready to help you build your backend. What would you like to create first?`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, successMessage]);
        
        return true;
      } else {
        const errorMsg = data.error || 'Unknown error';
        setConnectionError(errorMsg);
        
        // Don't show alert for rate limit errors - just show in UI
        if (errorMsg.includes('Too many requests')) {
          console.log('Rate limited, will not retry automatically');
          const rateLimitMessage = {
            id: Date.now(),
            sender: 'tos',
            content: `⚠️ **Rate limit reached**: Too many connection attempts. Please wait a moment before trying again.

You can manually reconnect by:
1. Going to Settings → Workspace Configurations
2. Clicking "Set Active" on your desired configuration

Or wait a few moments and refresh the page.`,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, rateLimitMessage]);
        } else {
          alert(`Connection failed: ${errorMsg}`);
        }
        
        return false;
      }
    } catch (error) {
      const errorMsg = error.message || 'Unknown error';
      setConnectionError(errorMsg);
      
      console.error('Connection error:', error);
      alert(`Connection error: ${errorMsg}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  };


  // Send message to N8N webhook
  const sendMessage = async (content) => {
    if (!content.trim()) return;

    const userMessage = {
      id: Date.now(),
      sender: 'user',
      content: content.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Persist user message if authenticated using controller
    if (isAuthenticated && activeConversationId) {
      try {
        await persistUserMessage(content.trim());
      } catch (error) {
        console.error('Failed to persist user message:', error);
      }
    }

    if (!sessionId) {
      const errorMessage = {
        id: Date.now() + 1,
        sender: 'tos',
        content: `❌ Please connect to your Xano workspace first using the settings panel on the right.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
      return;
    }

    try {
      // Debug: Log what we're sending to N8N
      console.log('Sending to N8N:', { message: content.trim(), session_id: sessionId });
      
      const response = await fetch('http://localhost:5678/webhook/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          message: content.trim(),
          session_id: sessionId,
          conversation_id: activeConversationId // Include conversation context
        })
      });

      const data = await response.json();
      
      // Debug: Log the actual response structure
      console.log('N8N Response:', JSON.stringify(data, null, 2));
      
      // Extract response from N8N workflow structure
      let botResponse = 'I received your message but had trouble processing it.';
      let toolData = null;
      
      if (data?.success && data?.message) {
        // New N8N format - direct object
        if (data.message.use_tool && data.message.tool_call) {
          // Tool was used - format the tool results
          botResponse = formatToolResults(data.message.tool_call);
          toolData = data.message.tool_call;
        } else {
          // Conversational response - use the direct response
          botResponse = data.message.response || 'No response received';
        }
      } else if (data?.jsonrpc && data?.result?.content?.[0]?.text) {
        // MCP response format from N8N
        try {
          const mcpResult = JSON.parse(data.result.content[0].text);
          if (mcpResult.success) {
            botResponse = formatToolResults(mcpResult);
            toolData = mcpResult;
          } else {
            // Format error message better
            botResponse = `❌ **Error:** ${mcpResult.error || 'An error occurred'}`;
            
            // Add helpful context for specific errors
            if (mcpResult.error?.includes('Unable to locate request')) {
              botResponse += `\n\n💡 **Tip:** The API group might not exist. Try listing your API groups first with "show my API groups" to see what's available.`;
            }
          }
        } catch {
          botResponse = data.result.content[0].text;
        }
      } else if (Array.isArray(data) && data[0]?.success && data[0]?.message) {
        // Fallback for array format
        const responseData = data[0];
        if (responseData.message.use_tool && responseData.message.tool_call) {
          botResponse = formatToolResults(responseData.message.tool_call);
          toolData = responseData.message.tool_call;
        } else {
          botResponse = responseData.message.response || 'No response received';
        }
      } else if (data?.response || data?.message) {
        // Fallback for other response formats
        botResponse = data.response || data.message;
      }

      const tosMessage = {
        id: Date.now() + 1,
        sender: 'tos',
        content: botResponse,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, tosMessage]);

      // Persist assistant message if authenticated using controller
      if (isAuthenticated && activeConversationId) {
        try {
          await persistAssistantMessage(botResponse, toolData);
        } catch (error) {
          console.error('Failed to persist assistant message:', error);
        }
      }
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        sender: 'tos',
        content: `❌ Connection error: ${error.message}

Make sure your N8N workflow is running at localhost:5678`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Format tool results for display
  const formatToolResults = (result) => {
    // Table Schema Display
    if (result.schema) {
      const fields = result.fields || [];
      const fieldsList = fields.length > 0 
        ? fields.map(f => `  • ${f.name} (${f.type}${f.required ? ', required' : ''})`)
                .join('\n')
        : '  No fields defined';
      
      return `📋 **Table Schema: ${result.table_name}**

📊 **Details:**
• Table ID: ${result.table_id}
• Created: ${new Date(result.schema.created_at).toLocaleDateString()}
• Authentication: ${result.schema.auth ? '✅ Enabled' : '❌ Disabled'}
• Total Fields: ${fields.length}

🔧 **Fields:**
${fieldsList}

${result.indexes?.length ? `\n📑 **Indexes:** ${result.indexes.length} configured` : ''}`;
    }
    
    // Tables List Display
    if (result.tables) {
      const tablesByAuth = result.tables.reduce((acc, table) => {
        const key = table.auth ? 'authenticated' : 'public';
        if (!acc[key]) acc[key] = [];
        acc[key].push(table);
        return acc;
      }, {});
      
      let tablesList = `📚 **Your Xano Tables** (${result.tables.length} found)\n`;
      
      if (tablesByAuth.authenticated?.length) {
        tablesList += `\n🔐 **Authenticated Tables:**\n`;
        tablesList += tablesByAuth.authenticated
          .map(t => `  • ${t.name} (ID: ${t.id})`)
          .join('\n');
      }
      
      if (tablesByAuth.public?.length) {
        tablesList += `\n\n🌐 **Public Tables:**\n`;
        tablesList += tablesByAuth.public
          .map(t => `  • ${t.name} (ID: ${t.id})`)
          .join('\n');
      }
      
      tablesList += `\n\nReady to work with any of these tables! Just ask me to get a schema or create something new.`;
      return tablesList;
    }
    
    // API Groups Display
    if (result.api_groups) {
      return `🚀 **API Groups** (${result.api_groups.length} found)

${result.api_groups.map(group => 
  `📁 **${group.name}**
  • ID: ${group.id}
  • Path: ${group.path || '/'}
  • Endpoints: ${group.endpoints?.length || 0}
  • Description: ${group.description || 'No description'}`
).join('\n\n')}

💡 **Tip:** Use the exact group name or ID when creating endpoints.`;
    }
    
    // XanoScript Generation Display
    if (result.xanoscript) {
      return `⚡ **Generated XanoScript**

📝 **Description:** ${result.description || 'Custom XanoScript'}

\`\`\`javascript
${result.xanoscript}
\`\`\`

✅ Ready to use in your Xano functions!`;
    }
    
    // Table Creation Result
    if (result.table_created) {
      return `🎉 **Table Created Successfully!**

📋 **Table:** ${result.table_name}
🆔 **Table ID:** ${result.table_id}
${result.fields?.length ? `📊 **Fields:** ${result.fields.length} fields created` : ''}

✅ Your new table is ready to use. You can now create API endpoints for it!`;
    }
    
    // API Endpoint Creation Result
    if (result.endpoint_created) {
      return `🚀 **API Endpoint Created!**

📍 **Path:** ${result.path}
🔧 **Method:** ${result.method}
📁 **Group:** ${result.group || 'Default'}
🔐 **Authentication:** ${result.requires_auth ? 'Required' : 'Public'}

✅ Your endpoint is live and ready to use!`;
    }

    // Workspace Functions List Display
    if (result.functions) {
      return `⚡ **Workspace Functions** (${result.functions.length} found)

${result.functions.map(func => 
  `🔧 **${func.name}**
  • ID: ${func.id}
  • Type: ${func.type || 'Custom'}
  • Description: ${func.description || 'No description'}`
).join('\n\n')}

💡 **Tip:** Use function IDs to get detailed logic or create new functions.`;
    }

    // Function Details Display
    if (result.function_data && result.script) {
      return `⚡ **Function Details: ${result.name}**

📝 **Description:** ${result.description || 'No description'}
🆔 **Function ID:** ${result.function_id}

🔧 **XanoScript:**
\`\`\`javascript
${result.script}
\`\`\`

✅ Function logic retrieved successfully!`;
    }

    // API Endpoints List Display
    if (result.endpoints) {
      return `🌐 **API Endpoints** (${result.endpoints.length} found)

${result.endpoints.map(endpoint => 
  `📡 **${endpoint.name || endpoint.path}**
  • ID: ${endpoint.id}
  • Method: ${endpoint.verb || endpoint.method}
  • Path: ${endpoint.path || '/'}
  • Auth: ${endpoint.auth ? '🔐 Required' : '🌐 Public'}`
).join('\n\n')}

💡 **Tip:** Use endpoint IDs to get the XanoScript logic.`;
    }

    // API Endpoint Logic Display
    if (result.endpoint_data && result.script) {
      return `🌐 **Endpoint Logic: ${result.name}**

🔧 **Method:** ${result.verb}
📍 **Path:** ${result.path}
🆔 **Endpoint ID:** ${result.api_id}

🔧 **XanoScript:**
\`\`\`javascript
${result.script}
\`\`\`

✅ Endpoint logic retrieved successfully!`;
    }

    // Workspace Tasks List Display
    if (result.tasks) {
      return `⏰ **Background Tasks** (${result.tasks.length} found)

${result.tasks.map(task => 
  `📅 **${task.name}**
  • ID: ${task.id}
  • Status: ${task.status || 'Unknown'}
  • Schedule: ${task.schedule || 'Not scheduled'}
  • Description: ${task.description || 'No description'}`
).join('\n\n')}

💡 **Tip:** Use task IDs to get the XanoScript logic.`;
    }

    // Task Logic Display
    if (result.task_data && result.script) {
      return `⏰ **Task Logic: ${result.name}**

📅 **Schedule:** ${result.schedule || 'Not scheduled'}
🆔 **Task ID:** ${result.task_id}

🔧 **XanoScript:**
\`\`\`javascript
${result.script}
\`\`\`

✅ Task logic retrieved successfully!`;
    }

    // Function Creation Result
    if (result.function_id && result.success) {
      return `⚡ **Workspace Function Created!**

🔧 **Function:** ${result.function_name}
🆔 **Function ID:** ${result.function_id}

✅ Your custom function is ready to use in your Xano workspace!`;
    }

    // Default message
    return result.message || '✅ Task completed successfully!';
  };

  // Quick action templates
  const quickActions = [
    {
      icon: <Users className="w-4 h-4" />,
      title: "User Authentication",
      description: "Create user registration, login, and session management",
      prompt: "Create a complete user authentication system with registration, login, and password reset functionality"
    },
    {
      icon: <MessageCircle className="w-4 h-4" />,
      title: "Social Media App",
      description: "Build posts, comments, likes, and user profiles",
      prompt: "Create a social media backend with user profiles, posts, comments, likes, and a news feed API"
    },
    {
      icon: <MessageCircle className="w-4 h-4" />,
      title: "Chat App",
      description: "Real-time messaging with channels and DMs",
      prompt: "Build a chat application backend with real-time messaging, channels, direct messages, and message history"
    },
    {
      icon: <ShoppingBag className="w-4 h-4" />,
      title: "Shopify Backend",
      description: "E-commerce with products, orders, and payments",
      prompt: "Create an e-commerce backend with products, inventory, shopping cart, orders, and payment processing"
    }
  ];

  const handleQuickAction = (prompt) => {
    sendMessage(prompt);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  // Quickstart state moved to top of component

  // Start a new conversation using new controller
  const startNewConversation = async () => {
    console.log('🚀 startNewConversation called through controller', {
      isConnected,
      isAuthenticated
    });
    
    if (!isConnected || !isAuthenticated) {
      console.log('🚫 Cannot start new conversation - not connected or authenticated');
      return;
    }
    
    try {
      // Create a new session first
      const response = await fetch('http://localhost:3001/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          xano_token: xanoToken,
          workspace_id: parseInt(workspaceId),
          instance_domain: instanceDomain
        })
      });

      const data = await response.json();
      
      if (!data.success) {
        alert(`Failed to create new session: ${data.error}`);
        return;
      }

      setSessionId(data.session_id);

      // Use controller to start new conversation
      console.log('🚀 Starting new conversation through controller...');
      await controllerStartNew();
      
      // Refresh sidebar to show new conversation
      if (window.tosForceRefresh) {
        window.tosForceRefresh();
        
        setTimeout(() => {
          console.log('🔄 Second refresh call...');
          window.tosForceRefresh();
        }, 200);
      }
      
      console.log('✅ New conversation started successfully');
    } catch (error) {
      console.error('Error creating new conversation:', error);
      alert(`Error creating new conversation: ${error.message}`);
    }
  };

  // Disconnect from Xano
  const handleDisconnect = () => {
    if (confirm('Are you sure you want to disconnect? This will clear your saved credentials.')) {
      // Clear localStorage
      localStorage.removeItem('tos_xano_token');
      localStorage.removeItem('tos_workspace_id');
      localStorage.removeItem('tos_instance_domain');
      localStorage.removeItem('tos_session_expires_at');
      
      // Reset state
      setXanoToken('');
      setWorkspaceId('');
      setInstanceDomain('');
      setSessionId(null);
      setIsConnected(false);
      setConnectionAttempted(false);
      setConnectionError(null);
      setSessionExpiresAt(null);
      setMessages([{
        id: Date.now(),
        sender: 'tos',
        content: `👋 You've been disconnected. Connect your Xano workspace using the settings panel to continue.`,
        timestamp: new Date()
      }]);
    }
  };

  // Manual retry connection
  const handleRetryConnection = () => {
    if (activeConfig) {
      setConnectionAttempted(false);
      setConnectionError(null);
      connectWithConfig(activeConfig);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header/Nav Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 fixed top-0 left-0 right-0 z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img 
              src="https://i.postimg.cc/HxBPZ2Mg/Toss-400-x-100-px-600-x-400-px-2.png" 
              alt="Tos Logo" 
              className="h-8 w-auto"
            />
            <span className="text-sm text-slate-600">AI Backend Developer</span>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Connection Toggle */}
            <div className="flex items-center gap-2 bg-slate-100 rounded-full p-1">
              <button
                onClick={isConnected ? handleDisconnect : () => {
                  setActiveTab('settings');
                  if (!sidebarOpen) toggleSidebar();
                }}
                disabled={isLoading || (connectionError && connectionError.includes('Too many requests'))}
                className={`relative flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  isConnected 
                    ? 'bg-white text-green-700 shadow-sm' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <div className="flex flex-col items-start">
                  <span className="leading-none">
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                  {isConnected && activeConfig && (
                    <span className="text-xs text-green-600/80 leading-none">
                      {activeConfig.config_name}
                    </span>
                  )}
                </div>
              </button>
              {isConnected && (
                <button
                  onClick={handleDisconnect}
                  disabled={isLoading}
                  className="p-1.5 text-slate-500 hover:text-red-600 transition-colors"
                  title="Disconnect"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            
            {/* Retry button for rate limit errors */}
            {connectionError && connectionError.includes('Too many requests') && (
              <button
                onClick={handleRetryConnection}
                disabled={isLoading}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 transition-colors disabled:opacity-50"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            )}
            
            {/* New Chat Button */}
            {isConnected && (
              <button 
                onClick={startNewConversation}
                disabled={isLoading}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                New Chat
              </button>
            )}
            
            {/* Sign In/Up buttons for non-authenticated users */}
            {!isAuthenticated && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setAuthModalTab('login');
                    setShowAuthModal(true);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setAuthModalTab('register');
                    setShowAuthModal(true);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[#fe3500] text-white rounded-lg hover:bg-[#e63000] transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Sign Up
                </button>
              </div>
            )}
            
            {/* Sidebar Toggle */}
            <button 
              onClick={toggleSidebar}
              className={`p-2 rounded-lg transition-colors ${sidebarOpen ? 'bg-[#fe3500] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              title="Toggle sidebar"
            >
              <Menu className="w-4 h-4" />
            </button>
            
            {/* User Profile Dropdown */}
            {isAuthenticated && (
              <div className="relative">
                <button
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="w-8 h-8 bg-[#fe3500] rounded-full flex items-center justify-center hover:bg-[#e63000] transition-colors"
                  title="User menu"
                >
                  <User className="w-4 h-4 text-white" />
                </button>
                
                {showUserDropdown && (
                  <>
                    {/* Backdrop to close dropdown */}
                    <div 
                      className="fixed inset-0 z-40"
                      onClick={() => setShowUserDropdown(false)}
                    />
                    
                    {/* Dropdown Menu */}
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-2 z-50">
                      <div className="px-4 py-2 border-b border-slate-100">
                        <div className="font-medium text-sm text-slate-800">{user?.name}</div>
                        <div className="text-xs text-slate-600">{user?.email}</div>
                      </div>
                      
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          logout();
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex pt-20 pb-20">
        {/* Main Chat Area */}
        <div className={`flex-1 flex flex-col relative ${sidebarOpen ? 'lg:pr-96' : ''}`}>
          {/* Quick Actions Bar */}
          {isConnected && (
            <div className="bg-white border-b border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-800">Quick Start Templates</h3>
                <button
                  onClick={() => setShowQuickstart(q => !q)}
                  className="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200"
                >
                  {showQuickstart ? 'Hide' : 'Show'}
                </button>
              </div>
              {showQuickstart && (
                <div className="flex gap-3 overflow-x-auto">
                  {quickActions.map((action, index) => (
                    <button
                      key={index}
                      onClick={() => handleQuickAction(action.prompt)}
                      className="flex-shrink-0 p-3 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors group min-w-48"
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-[#fe3500] mt-0.5">
                          {action.icon}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="text-sm font-medium text-slate-800 group-hover:text-[#fe3500] transition-colors">
                            {action.title}
                          </div>
                          <div className="text-xs text-slate-600 mt-1">
                            {action.description}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.sender === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  message.sender === 'user' 
                    ? 'bg-slate-700' 
                    : 'bg-gradient-to-r from-[#fe3500] to-[#ff6b35]'
                }`}>
                  {message.sender === 'user' ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
                </div>
                
                <div className={`flex-1 max-w-2xl ${message.sender === 'user' ? 'text-right' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-sm font-medium ${
                      message.sender === 'user' ? 'text-slate-700' : 'text-[#fe3500]'
                    }`}>
                      {message.sender === 'user' ? 'You' : 'Tos'}
                    </span>
                    <span className="text-xs text-slate-500">
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  
                  <div className={`rounded-2xl px-4 py-3 text-sm ${
                    message.sender === 'user'
                      ? 'bg-slate-800 text-slate-100 ml-auto inline-block'
                      : 'bg-white border border-slate-200'
                  }`}>
                    <div>
                      {message.sender === 'user' ? (
                        <div className="whitespace-pre-wrap">{message.content}</div>
                      ) : (
                        <MessageContent content={message.content} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#fe3500] to-[#ff6b35] flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-[#fe3500]">Tos</span>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 inline-block">
                    <div className="flex items-center gap-2">
                      <Loader className="w-4 h-4 animate-spin text-[#fe3500]" />
                      <span className="text-sm text-slate-600">Thinking...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-slate-200 p-4 bg-white fixed bottom-0 left-0 right-0 z-20">
            <div className="flex items-center gap-3 max-w-3xl mx-auto">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={!activeConversationId ? 
                  "Create a new conversation to start chatting..." :
                  isConnected ? 
                    `Ask me to build tables, APIs, or any backend feature${activeConfig ? ` for ${activeConfig.config_name}` : ''}...` : 
                    "Connect to Xano first to start chatting..."
                }
                className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#fe3500] focus:border-transparent text-sm"
                disabled={isLoading || !activeConversationId}
                readOnly={!activeConversationId}
              />
              <button
                onClick={() => sendMessage(inputValue)}
                disabled={isLoading || !inputValue.trim() || !activeConversationId}
                className="bg-[#fe3500] text-white p-3 rounded-xl hover:bg-[#e63000] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <Sidebar 
          onLoadConversation={handleLoadConversation} 
          onConfigSelect={connectWithConfigAndSwitch}
          onNewConversation={startNewConversation}
          onDeleteConversation={handleConversationDelete}
        />
      </div>

      {/* Authentication Modal */}
      <AuthModal 
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultTab={authModalTab}
      />

      {/* Removed migration prompt modal */}
    </div>
  );
};

// Main App component with providers
const App = () => {
  return (
    <AuthProvider>
      <SidebarProvider>
        <TosChat />
      </SidebarProvider>
    </AuthProvider>
  );
};

export default App;