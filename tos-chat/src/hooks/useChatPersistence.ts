import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useWorkspaceConfig } from './useWorkspaceConfig';
import { messagePersistenceService } from '../services/messagePersistence';
import { conversationManager } from '../services/conversationManager';
import { messageQueue } from '../services/messageQueue';

interface ChatMessage {
  id: number;
  sender: 'user' | 'tos' | 'system';
  content: string;
  timestamp: Date;
  toolData?: any;
}

interface ConversationContext {
  conversationId: number | null;
  isNewConversation: boolean;
  messageCount: number;
}

interface UseChatPersistenceReturn {
  conversationContext: ConversationContext;
  persistUserMessage: (content: string, tempMessageId: number) => Promise<void>;
  persistAssistantMessage: (content: string, toolData?: any) => Promise<void>;
  loadConversation: (conversationId: number) => Promise<ChatMessage[]>;
  createNewConversation: (initialMessage?: string) => Promise<number | null>;
  createNewConversationImmediately: () => Promise<number | null>;
  updateConversationTitle: (title: string) => Promise<void>;
  migrateAnonymousSession: (messages: ChatMessage[]) => Promise<number | null>;
  resetConversationContext: () => void;
  isLoading: boolean;
  error: string | null;
}

export const useChatPersistence = (onConversationCreated?: () => void, onMessagePersisted?: () => void): UseChatPersistenceReturn => {
  const { authToken, isAuthenticated, user } = useAuth();
  const { activeConfig } = useWorkspaceConfig();
  
  const [conversationContext, setConversationContext] = useState<ConversationContext>(() => {
    // Try to restore conversation context from localStorage
    const saved = localStorage.getItem('tos_active_conversation');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        console.log('📂 Restored conversation context from localStorage:', parsed);
        
        // SAFEGUARD: Validate the restored context to prevent corruption
        if (parsed && typeof parsed.conversationId === 'number' && parsed.conversationId > 0) {
          console.log('✅ Valid conversation context restored');
          return parsed;
        } else {
          console.warn('⚠️ Invalid conversation context in localStorage, clearing it');
          localStorage.removeItem('tos_active_conversation');
        }
      } catch (e) {
        console.error('Failed to parse saved conversation context:', e);
        localStorage.removeItem('tos_active_conversation');
      }
    }
    return {
      conversationId: null,
      isNewConversation: true,
      messageCount: 0,
    };
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track if we've already generated a title for this conversation
  const titleGeneratedRef = useRef(false);
  
  // SAFEGUARD: Prevent conversation creation during app initialization
  const appStartTimeRef = useRef(Date.now());
  const isAppInitializingRef = useRef(true);
  
  useEffect(() => {
    // Allow conversation creation after 2 seconds of app load
    const timer = setTimeout(() => {
      isAppInitializingRef.current = false;
      console.log('✅ App initialization complete, conversation creation allowed');
    }, 2000);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Update message queue auth tokens when auth state changes
  useEffect(() => {
    if (isAuthenticated && authToken) {
      messageQueue.updateAuthTokens(null, authToken);
    }
  }, [isAuthenticated, authToken]);

  // Save conversation context to localStorage whenever it changes
  useEffect(() => {
    if (conversationContext.conversationId) {
      localStorage.setItem('tos_active_conversation', JSON.stringify(conversationContext));
      console.log('💾 Saved conversation context to localStorage:', conversationContext);
    } else {
      localStorage.removeItem('tos_active_conversation');
    }
  }, [conversationContext]);

  const createNewConversation = useCallback(async (initialMessage?: string): Promise<number | null> => {
    if (!isAuthenticated || !authToken) {
      console.log('📝 Not authenticated - skipping conversation creation');
      return null;
    }

    // SAFEGUARD: Prevent conversation creation during app initialization unless it's from explicit user action
    if (isAppInitializingRef.current && !initialMessage) {
      console.log('🚫 App still initializing, preventing automatic conversation creation');
      return null;
    }

    // SAFEGUARD: Log conversation creation attempt with stack trace to identify source
    console.log('🚀 Creating new conversation with:', {
      hasActiveConfig: !!activeConfig,
      workspaceId: activeConfig?.target_workspace_id,
      instanceDomain: activeConfig?.instance_domain,
      hasUser: !!user,
      userId: user?.id,
      initialMessage: initialMessage?.substring(0, 50) + '...',
      stack: new Error().stack
    });

    setIsLoading(true);
    setError(null);

    try {
      const result = await conversationManager.createConversationFromWorkspace(
        {
          target_workspace_id: activeConfig?.target_workspace_id,
          instance_domain: activeConfig?.instance_domain,
        },
        authToken,
        initialMessage,
        user
      );

      if (result.success && result.conversation) {
        const conversationId = result.conversation.id!;
        
        setConversationContext({
          conversationId,
          isNewConversation: true,
          messageCount: 0,
        });
        
        titleGeneratedRef.current = false;
        
        console.log(`✅ Created new conversation: ${conversationId}`);
        
        // Notify parent component that a conversation was created
        if (onConversationCreated) {
          onConversationCreated();
        }
        
        return conversationId;
      } else {
        throw new Error(result.error || 'Failed to create conversation');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create conversation';
      setError(errorMessage);
      console.error('❌ Failed to create conversation:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, authToken, activeConfig, user]);

  const persistUserMessage = useCallback(async (content: string, tempMessageId: number): Promise<void> => {
    if (!isAuthenticated || !authToken) {
      console.log('📝 Not authenticated - skipping message persistence');
      return;
    }

    // SAFEGUARD: Log message persistence with stack trace to identify unexpected calls
    console.log('💬 Persisting user message:', {
      content: content.substring(0, 50) + '...',
      currentConversationId: conversationContext.conversationId,
      isNewConversation: conversationContext.isNewConversation,
      messageCount: conversationContext.messageCount,
      stack: new Error().stack
    });

    try {
      // Create conversation if this is the first message
      let currentConversationId = conversationContext.conversationId;
      
      if (!currentConversationId) {
        console.log('🆕 No conversation ID, creating new conversation...');
        currentConversationId = await createNewConversation(content);
        if (!currentConversationId) {
          throw new Error('Failed to create conversation for message');
        }
        console.log('✅ Created conversation with ID:', currentConversationId);
      }

      // Generate conversation title from first user message
      if (conversationContext.isNewConversation && !titleGeneratedRef.current) {
        titleGeneratedRef.current = true;
        // Don't await this - let it happen in background
        conversationManager.updateConversationTitle(currentConversationId, content, authToken)
          .catch(err => console.error('Failed to update conversation title:', err));
      }

      // Persist the message
      const result = await messagePersistenceService.persistUserMessage(
        currentConversationId,
        content,
        authToken,
        {
          temp_message_id: tempMessageId,
          workspace_id: activeConfig?.target_workspace_id,
          session_type: 'authenticated',
        }
      );

      if (result.success) {
        // Update conversation context
        setConversationContext(prev => {
          const newMessageCount = prev.messageCount + 1;
          
          // Queue conversation metadata update with correct count
          messageQueue.queueConversationUpdate(
            currentConversationId,
            {
              last_message_at: new Date().toISOString(),
              message_count: newMessageCount,
            },
            authToken
          );
          
          return {
            ...prev,
            conversationId: currentConversationId,
            isNewConversation: false,
            messageCount: newMessageCount,
          };
        });
        
        // Trigger callback to refresh conversation list in sidebar
        if (onMessagePersisted) {
          onMessagePersisted();
        }
      } else {
        console.error('Failed to persist user message:', result.error);
      }
    } catch (err) {
      console.error('❌ Error persisting user message:', err);
    }
  }, [isAuthenticated, authToken, conversationContext, activeConfig, createNewConversation]);

  const persistAssistantMessage = useCallback(async (content: string, toolData?: any): Promise<void> => {
    if (!isAuthenticated || !authToken || !conversationContext.conversationId) {
      console.log('📝 Not authenticated or no conversation - skipping assistant message persistence');
      return;
    }

    try {
      // Determine if this is a tool execution or regular message
      if (toolData) {
        // Extract tool information from the response
        const extractedToolData = messagePersistenceService.extractToolDataFromResponse(toolData);
        
        if (extractedToolData) {
          // Persist as tool execution
          await messagePersistenceService.persistToolExecution(
            conversationContext.conversationId,
            extractedToolData.toolName || 'unknown',
            extractedToolData.parameters || {},
            extractedToolData.result || {},
            authToken,
            undefined, // execution time not available from UI
            {
              workspace_id: activeConfig?.target_workspace_id,
              original_response: toolData,
            }
          );
        }
      }

      // Always persist the assistant's text response
      const result = await messagePersistenceService.persistAssistantMessage(
        conversationContext.conversationId,
        content,
        authToken,
        {
          workspace_id: activeConfig?.target_workspace_id,
          has_tool_data: !!toolData,
        }
      );

      if (result.success) {
        // Update conversation context
        setConversationContext(prev => {
          const newMessageCount = prev.messageCount + 1;
          
          // Queue conversation metadata update with correct count
          messageQueue.queueConversationUpdate(
            conversationContext.conversationId,
            {
              last_message_at: new Date().toISOString(),
              message_count: newMessageCount,
            },
            authToken
          );
          
          return {
            ...prev,
            messageCount: newMessageCount,
          };
        });
        
        // Trigger callback to refresh conversation list in sidebar
        if (onMessagePersisted) {
          onMessagePersisted();
        }
      } else {
        console.error('Failed to persist assistant message:', result.error);
      }
    } catch (err) {
      console.error('❌ Error persisting assistant message:', err);
    }
  }, [isAuthenticated, authToken, conversationContext, activeConfig]);

  const loadConversation = useCallback(async (conversationId: number): Promise<ChatMessage[]> => {
    if (!isAuthenticated || !authToken) {
      console.log('📝 Not authenticated - cannot load conversation');
      return [];
    }

    console.log('📖 Loading conversation:', conversationId);

    setIsLoading(true);
    setError(null);

    try {
      // Get conversation details
      console.log('🔍 Fetching conversation details...');
      const conversationResult = await conversationManager.getConversation(conversationId, authToken);
      
      if (!conversationResult.success) {
        console.error('❌ Failed to get conversation details:', conversationResult.error);
        throw new Error(conversationResult.error || 'Failed to load conversation');
      }

      console.log('✅ Conversation details loaded:', conversationResult.conversation);

      // Get messages for the conversation
      console.log('🔍 Fetching messages for conversation...');
      const messagesResult = await messagePersistenceService.getMessages(conversationId, authToken);
      
      if (!messagesResult.success) {
        console.error('❌ Failed to get messages:', messagesResult.error);
        throw new Error(messagesResult.error || 'Failed to load messages');
      }

      console.log('✅ Messages loaded:', {
        count: messagesResult.messages?.length || 0,
        messages: messagesResult.messages
      });

      // Convert to ChatMessage format
      const chatMessages: ChatMessage[] = (messagesResult.messages || []).map((msg: any) => ({
        id: msg.id,
        sender: msg.sender === 'assistant' ? 'tos' : msg.sender,
        content: msg.content,
        timestamp: new Date(msg.created_at || msg.timestamp),
        toolData: msg.tool_data,
      }));

      console.log('🔄 Converted chat messages:', chatMessages);

      // Update conversation context
      setConversationContext({
        conversationId,
        isNewConversation: false,
        messageCount: chatMessages.length,
      });

      titleGeneratedRef.current = true; // Existing conversation already has title

      console.log(`✅ Loaded conversation ${conversationId} with ${chatMessages.length} messages`);
      
      return chatMessages;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load conversation';
      setError(errorMessage);
      console.error('❌ Failed to load conversation:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, authToken]);

  const updateConversationTitle = useCallback(async (title: string): Promise<void> => {
    if (!isAuthenticated || !authToken || !conversationContext.conversationId) {
      return;
    }

    try {
      const result = await conversationManager.updateConversation(
        conversationContext.conversationId,
        { title },
        authToken
      );

      if (!result.success) {
        console.error('Failed to update conversation title:', result.error);
      }
    } catch (err) {
      console.error('❌ Error updating conversation title:', err);
    }
  }, [isAuthenticated, authToken, conversationContext.conversationId]);

  const migrateAnonymousSession = useCallback(async (messages: ChatMessage[]): Promise<number | null> => {
    if (!isAuthenticated || !authToken) {
      console.log('📝 Not authenticated - cannot migrate session');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create conversation for migration
      const firstUserMessage = messages.find(m => m.sender === 'user')?.content;
      
      const migrationResult = await conversationManager.migrateAnonymousConversation(
        {
          messages,
          workspaceId: activeConfig?.target_workspace_id,
          instanceDomain: activeConfig?.instance_domain,
        },
        authToken
      );

      if (!migrationResult.success || !migrationResult.conversationId) {
        throw new Error(migrationResult.error || 'Failed to create conversation during migration');
      }

      const conversationId = migrationResult.conversationId;

      // Batch persist all messages
      const messageDataArray = messages.map(msg => ({
        conversation_id: conversationId,
        sender: msg.sender === 'tos' ? 'assistant' : msg.sender,
        content: msg.content,
        message_type: msg.toolData ? 'tool_execution' : 'text',
        tool_data: msg.toolData,
        metadata: {
          timestamp: msg.timestamp.toISOString(),
          migrated_from_anonymous: true,
          workspace_id: activeConfig?.target_workspace_id,
        },
      }));

      await messageQueue.batchPersistMessages(messageDataArray, authToken);

      // Update conversation context
      setConversationContext({
        conversationId,
        isNewConversation: false,
        messageCount: messages.length,
      });

      console.log(`✅ Migrated ${messages.length} messages to conversation ${conversationId}`);
      
      return conversationId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to migrate session';
      setError(errorMessage);
      console.error('❌ Failed to migrate anonymous session:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, authToken, activeConfig]);

  const resetConversationContext = useCallback(() => {
    console.log('🔄 Resetting conversation context');
    setConversationContext({
      conversationId: null,
      isNewConversation: true,
      messageCount: 0,
    });
    titleGeneratedRef.current = false;
  }, []);

  const createNewConversationImmediately = useCallback(async (): Promise<number | null> => {
    if (!isAuthenticated || !authToken) {
      console.log('📝 Not authenticated - cannot create immediate conversation');
      return null;
    }

    // This function is only called from explicit user actions (New Chat button), so bypass the initialization check
    
    // SAFEGUARD: Log immediate conversation creation with stack trace
    console.log('🚀 Creating new conversation immediately for UI', {
      hasActiveConfig: !!activeConfig,
      workspaceId: activeConfig?.target_workspace_id,
      stack: new Error().stack
    });

    // Clear any existing conversation context first
    setConversationContext({
      conversationId: null,
      isNewConversation: true,
      messageCount: 0,
    });
    titleGeneratedRef.current = false;

    setIsLoading(true);
    setError(null);

    try {
      // Create conversation with default title
      const result = await conversationManager.createConversationFromWorkspace(
        {
          target_workspace_id: activeConfig?.target_workspace_id,
          instance_domain: activeConfig?.instance_domain,
        },
        authToken,
        undefined, // No initial message - will use default title
        user
      );

      if (result.success && result.conversation) {
        const conversationId = result.conversation.id!;
        
        // Set this as the active conversation
        setConversationContext({
          conversationId,
          isNewConversation: true,
          messageCount: 0,
        });
        
        titleGeneratedRef.current = false;
        
        console.log(`✅ Created immediate conversation: ${conversationId}`);
        
        // Notify parent component that a conversation was created
        if (onConversationCreated) {
          console.log('🔔 Calling onConversationCreated callback...');
          onConversationCreated();
        } else {
          console.warn('⚠️ No onConversationCreated callback provided');
        }
        
        return conversationId;
      } else {
        throw new Error(result.error || 'Failed to create conversation');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create conversation';
      setError(errorMessage);
      console.error('❌ Failed to create immediate conversation:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, authToken, activeConfig, user]);

  const setActiveConversation = useCallback((conversationId: number) => {
    console.log('🎯 Setting active conversation:', conversationId);
    setConversationContext({
      conversationId,
      isNewConversation: true,
      messageCount: 0,
    });
  }, []);

  return {
    conversationContext,
    persistUserMessage,
    persistAssistantMessage,
    loadConversation,
    createNewConversation,
    createNewConversationImmediately,
    updateConversationTitle,
    migrateAnonymousSession,
    resetConversationContext,
    setActiveConversation,
    isLoading,
    error,
  };
};

export type { ChatMessage, ConversationContext };