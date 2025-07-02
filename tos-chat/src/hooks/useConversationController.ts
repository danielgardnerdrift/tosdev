import { useState, useCallback, useEffect } from 'react';
import { useAuth } from './useAuth';
import { useWorkspaceConfig } from './useWorkspaceConfig';
import { conversationManager } from '../services/conversationManager';
import { messagePersistenceService } from '../services/messagePersistence';

interface ChatMessage {
  id: number;
  sender: 'user' | 'tos' | 'system';
  content: string;
  timestamp: Date;
  toolData?: any;
}

interface ConversationControllerState {
  activeConversationId: number | null;
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
}

interface UseConversationControllerReturn {
  // State
  activeConversationId: number | null;
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  switchToConversation: (conversationId: number) => Promise<void>;
  startNewConversation: () => Promise<void>;
  clearMessages: () => void;
  refreshCurrentConversation: () => Promise<void>;
  handleConversationDeleted: (deletedConversationId: number) => void;
  
  // Message actions
  persistUserMessage: (content: string) => Promise<void>;
  persistAssistantMessage: (content: string, toolData?: any) => Promise<void>;
  
  // Callbacks
  onMessagePersisted?: () => void;
}

/**
 * Centralized API-driven conversation controller
 * - Minimal local state (only activeConversationId stored locally)
 * - All data fetched fresh from Xano APIs
 * - Immediate UI updates with proper loading states
 */
export const useConversationController = (onMessagePersisted?: () => void): UseConversationControllerReturn => {
  const { authToken, isAuthenticated, user } = useAuth();
  const { activeConfig } = useWorkspaceConfig();
  
  // Minimal state - only what's needed for UI
  const [activeConversationId, setActiveConversationId] = useState<number | null>(() => {
    // Restore only the conversation ID from localStorage
    const saved = localStorage.getItem('tos_active_conversation_id');
    return saved ? parseInt(saved) : null;
  });
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Save conversation ID to localStorage whenever it changes
  useEffect(() => {
    if (activeConversationId) {
      localStorage.setItem('tos_active_conversation_id', activeConversationId.toString());
    } else {
      localStorage.removeItem('tos_active_conversation_id');
    }
  }, [activeConversationId]);


  /**
   * Clear messages immediately (for instant UI updates)
   */
  const clearMessages = useCallback(() => {
    console.log('🧹 Clearing messages immediately');
    setMessages([]);
    setError(null);
  }, []);

  /**
   * Load messages from API for a specific conversation
   */
  const loadMessagesFromAPI = useCallback(async (conversationId: number): Promise<ChatMessage[]> => {
    if (!authToken) {
      throw new Error('No auth token available');
    }

    console.log('📡 Fetching messages from API for conversation:', conversationId);
    
    const messagesResult = await messagePersistenceService.getMessages(conversationId, authToken);
    
    if (!messagesResult.success) {
      throw new Error(messagesResult.error || 'Failed to load messages');
    }

    console.log('📡 RAW API RESPONSE for conversation', conversationId, ':', {
      success: messagesResult.success,
      messageCount: messagesResult.messages?.length || 0,
      messages: messagesResult.messages
    });

    // Convert API messages to ChatMessage format
    const chatMessages: ChatMessage[] = (messagesResult.messages || []).map((msg: any) => ({
      id: msg.id,
      sender: msg.sender === 'assistant' ? 'tos' : msg.sender,
      content: msg.content,
      timestamp: new Date(msg.created_at || msg.timestamp),
      toolData: msg.tool_data,
    }));

    console.log('✅ CONVERTED MESSAGES for conversation', conversationId, ':', {
      count: chatMessages.length,
      messages: chatMessages.map(m => ({ 
        id: m.id, 
        sender: m.sender, 
        content: m.content.substring(0, 100) + '...',
        timestamp: m.timestamp
      }))
    });
    return chatMessages;
  }, [authToken]);


  /**
   * Switch to a specific conversation
   * 1. Clear UI immediately
   * 2. Set loading state
   * 3. Fetch conversation + messages from API
   * 4. Update UI with fresh data
   */
  const switchToConversation = useCallback(async (conversationId: number) => {
    if (!authToken || !isAuthenticated) {
      console.error('❌ Cannot switch conversation - not authenticated');
      return;
    }

    console.log('🔄 SWITCHING TO CONVERSATION:', conversationId, {
      currentActiveId: activeConversationId,
      currentMessageCount: messages.length,
      timestamp: new Date().toISOString()
    });
    
    // 1. Clear UI immediately for instant feedback
    clearMessages();
    setIsLoading(true);
    setError(null);
    
    try {
      // 2. Verify conversation exists and get metadata
      const conversationResult = await conversationManager.getConversation(conversationId, authToken);
      
      if (!conversationResult.success) {
        throw new Error(conversationResult.error || 'Conversation not found');
      }

      // 3. Set as active conversation
      setActiveConversationId(conversationId);
      
      // 4. Load messages from API
      const loadedMessages = await loadMessagesFromAPI(conversationId);
      setMessages(loadedMessages);
      
      console.log('✅ Successfully switched to conversation:', conversationId);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load conversation';
      console.error('❌ Failed to switch conversation:', err);
      setError(errorMessage);
      
      // Clear active conversation on error
      setActiveConversationId(null);
      setMessages([]);
      
    } finally {
      setIsLoading(false);
    }
  }, [authToken, isAuthenticated, clearMessages, loadMessagesFromAPI]);

  /**
   * Start a new conversation
   * 1. Clear UI immediately
   * 2. Create conversation via API
   * 3. Set as active conversation
   * 4. Show welcome message
   */
  const startNewConversation = useCallback(async () => {
    if (!authToken || !isAuthenticated || !activeConfig) {
      console.error('❌ Cannot start new conversation - missing requirements');
      return;
    }

    console.log('🆕 Starting new conversation...');
    
    // 1. Clear UI immediately
    clearMessages();
    setIsLoading(true);
    setError(null);
    
    // 2. Show welcome messages immediately (no API call needed)
    const welcomeMessages: ChatMessage[] = [
      {
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
      },
      {
        id: Date.now() + 1,
        sender: 'tos',
        content: `🎉 Successfully connected to your Xano workspace!

Configuration: ${activeConfig?.config_name || 'Unknown'}
• Instance: ${activeConfig?.instance_domain || 'Unknown'}
• Workspace ID: ${activeConfig?.target_workspace_id || 'Unknown'}
• Session: Connected
• Ready to build!

I'm now ready to help you build your backend. What would you like to create first?`,
        timestamp: new Date()
      }
    ];
    
    try {
      // 3. Create conversation via API
      const result = await conversationManager.createConversationFromWorkspace(
        {
          target_workspace_id: activeConfig.target_workspace_id,
          instance_domain: activeConfig.instance_domain,
        },
        authToken,
        undefined, // No initial message
        user
      );

      if (!result.success || !result.conversation) {
        throw new Error(result.error || 'Failed to create conversation');
      }

      const conversationId = result.conversation.id!;
      console.log('✅ New conversation created:', conversationId);
      
      // 4. Set as active conversation and show welcome messages
      setActiveConversationId(conversationId);
      setMessages(welcomeMessages);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create conversation';
      console.error('❌ Failed to start new conversation:', err);
      setError(errorMessage);
      
      // Still show welcome messages even if creation failed
      setMessages(welcomeMessages);
      
    } finally {
      setIsLoading(false);
    }
  }, [authToken, isAuthenticated, activeConfig, user, clearMessages]);

  /**
   * Refresh current conversation by re-fetching from API
   */
  const refreshCurrentConversation = useCallback(async () => {
    if (activeConversationId) {
      await switchToConversation(activeConversationId);
    }
  }, [activeConversationId, switchToConversation]);

  /**
   * Handle when a conversation is deleted
   * Clear the chat if the deleted conversation is currently active
   */
  const handleConversationDeleted = useCallback((deletedConversationId: number) => {
    console.log('🗑️ Conversation deleted:', deletedConversationId, {
      currentActiveId: activeConversationId,
      wasActive: activeConversationId === deletedConversationId
    });
    
    if (activeConversationId === deletedConversationId) {
      console.log('🧹 Clearing active conversation since it was deleted');
      setActiveConversationId(null);
      setMessages([]);
      setError(null);
    }
  }, [activeConversationId]);

  /**
   * Persist user message to API and update UI
   */
  const persistUserMessage = useCallback(async (content: string) => {
    if (!authToken || !activeConversationId) {
      console.error('❌ Cannot persist message - missing requirements');
      return;
    }

    // Add message to UI immediately for instant feedback
    const userMessage: ChatMessage = {
      id: Date.now(),
      sender: 'user',
      content,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);

    try {
      const result = await messagePersistenceService.persistUserMessage(
        activeConversationId,
        content,
        authToken,
        {
          workspace_id: activeConfig?.target_workspace_id,
          session_type: 'authenticated',
        }
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to persist message');
      }

      console.log('✅ User message persisted to API');
      
      // Notify parent about message persistence (to refresh sidebar)
      if (onMessagePersisted) {
        onMessagePersisted();
      }
      
    } catch (err) {
      console.error('❌ Failed to persist user message:', err);
      // Remove the message from UI if persistence failed
      setMessages(prev => prev.filter(m => m.id !== userMessage.id));
      setError(err instanceof Error ? err.message : 'Failed to save message');
    }
  }, [authToken, activeConversationId, activeConfig]);

  /**
   * Persist assistant message to API and update UI
   */
  const persistAssistantMessage = useCallback(async (content: string, toolData?: any) => {
    if (!authToken || !activeConversationId) {
      console.error('❌ Cannot persist assistant message - missing requirements');
      return;
    }

    // Add message to UI immediately
    const assistantMessage: ChatMessage = {
      id: Date.now(),
      sender: 'tos',
      content,
      timestamp: new Date(),
      toolData
    };
    
    setMessages(prev => [...prev, assistantMessage]);

    try {
      const result = await messagePersistenceService.persistAssistantMessage(
        activeConversationId,
        content,
        authToken,
        {
          workspace_id: activeConfig?.target_workspace_id,
          has_tool_data: !!toolData,
        }
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to persist assistant message');
      }

      console.log('✅ Assistant message persisted to API');
      
      // Notify parent about message persistence (to refresh sidebar)
      if (onMessagePersisted) {
        onMessagePersisted();
      }
      
    } catch (err) {
      console.error('❌ Failed to persist assistant message:', err);
      // Remove the message from UI if persistence failed
      setMessages(prev => prev.filter(m => m.id !== assistantMessage.id));
      setError(err instanceof Error ? err.message : 'Failed to save message');
    }
  }, [authToken, activeConversationId, activeConfig]);

  return {
    // State
    activeConversationId,
    messages,
    isLoading,
    error,
    
    // Actions
    switchToConversation,
    startNewConversation,
    clearMessages,
    refreshCurrentConversation,
    handleConversationDeleted,
    
    // Message actions
    persistUserMessage,
    persistAssistantMessage,
  };
};