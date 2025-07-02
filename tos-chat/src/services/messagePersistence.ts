import { useAuth } from '../hooks/useAuth';

interface MessageData {
  conversation_id: number;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  message_type: 'text' | 'tool_execution' | 'error';
  tool_data?: {
    tool_name: string;
    parameters: any;
    result: any;
    execution_time_ms?: number;
  };
  metadata?: {
    workspace_id?: number;
    session_id?: string;
    timestamp: string;
    user_agent?: string;
    ip_address?: string;
  };
}

interface PersistenceOptions {
  retryCount?: number;
  priority?: 'high' | 'medium' | 'low';
  immediate?: boolean;
}

class MessagePersistenceService {
  private baseUrl = 'https://api.autosnap.cloud/api:o_u0lDDs';
  private retryAttempts = 3;
  private retryDelay = 1000; // ms

  async persistMessage(
    messageData: MessageData, 
    authToken: string, 
    options: PersistenceOptions = {}
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    const { retryCount = 0, immediate = false } = options;

    // Validate conversation_id
    if (!messageData.conversation_id || messageData.conversation_id <= 0) {
      console.warn('⚠️ Invalid conversation_id, skipping message persistence:', messageData.conversation_id);
      return {
        success: false,
        error: 'Invalid conversation_id'
      };
    }

    try {
      // Add timestamp if not provided
      if (!messageData.metadata?.timestamp) {
        messageData.metadata = {
          ...messageData.metadata,
          timestamp: new Date().toISOString(),
          user_agent: navigator.userAgent,
        };
      }

      console.log('📨 Attempting to persist message:', {
        url: `${this.baseUrl}/message`,
        conversation_id: messageData.conversation_id,
        sender: messageData.sender,
        message_type: messageData.message_type,
        hasContent: !!messageData.content,
        contentLength: messageData.content?.length || 0,
        hasAuthToken: !!authToken,
        tokenLength: authToken?.length || 0,
        fullMessageData: messageData
      });

      // Prepare the data in the format the API expects
      const apiData = {
        sender: messageData.sender,
        content: messageData.content,
        message_type: messageData.message_type,
        tool_data: messageData.tool_data ? JSON.stringify(messageData.tool_data) : null,
        response_time_ms: 0,
        metadata: messageData.metadata ? JSON.stringify(messageData.metadata) : null,
        conversation_id: messageData.conversation_id,
        parent_message_id: null
      };

      console.log('📤 Sending to message API:', apiData);

      const response = await fetch(`${this.baseUrl}/message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Message API error response:', errorText);
        throw new Error(`Failed to persist message: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      console.log(`✅ Message persisted successfully:`, {
        messageId: result.id,
        conversationId: messageData.conversation_id,
        sender: messageData.sender,
        type: messageData.message_type
      });

      return {
        success: true,
        messageId: result.id,
      };
    } catch (error) {
      console.error(`❌ Failed to persist message (attempt ${retryCount + 1}):`, error);

      // Retry logic with exponential backoff
      if (retryCount < this.retryAttempts) {
        const delay = this.retryDelay * Math.pow(2, retryCount);
        
        if (immediate) {
          // For immediate retries, use setTimeout
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.persistMessage(messageData, authToken, { 
            ...options, 
            retryCount: retryCount + 1 
          });
        } else {
          // For queued messages, schedule retry
          setTimeout(() => {
            this.persistMessage(messageData, authToken, { 
              ...options, 
              retryCount: retryCount + 1 
            });
          }, delay);
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getMessages(
    conversationId: number, 
    authToken: string,
    options: { offset?: number; limit?: number } = {}
  ): Promise<{ success: boolean; messages?: any[]; error?: string }> {
    try {
      const url = `${this.baseUrl}/message/all/${conversationId}`;

      console.log('🚨 CALLING XANO MESSAGE API:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.status} ${response.statusText}`);
      }

      const messages = await response.json();
      
      console.log('🚨 XANO RESPONSE for conversation', conversationId, ':', {
        url,
        responseCount: Array.isArray(messages) ? messages.length : (messages.items?.length || 0),
        actualMessages: Array.isArray(messages) ? messages : messages.items || [],
        conversationIds: (Array.isArray(messages) ? messages : messages.items || []).map(m => m.conversation_id)
      });
      
      return {
        success: true,
        messages: Array.isArray(messages) ? messages : messages.items || [],
      };
    } catch (error) {
      console.error('❌ Failed to fetch messages:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async persistUserMessage(
    conversationId: number,
    content: string,
    authToken: string,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    const messageData: MessageData = {
      conversation_id: conversationId,
      sender: 'user',
      content,
      message_type: 'text',
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
      },
    };

    return this.persistMessage(messageData, authToken, { immediate: true });
  }

  async persistAssistantMessage(
    conversationId: number,
    content: string,
    authToken: string,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    const messageData: MessageData = {
      conversation_id: conversationId,
      sender: 'assistant',
      content,
      message_type: 'text',
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
      },
    };

    return this.persistMessage(messageData, authToken, { immediate: true });
  }

  async persistToolExecution(
    conversationId: number,
    toolName: string,
    parameters: any,
    result: any,
    authToken: string,
    executionTimeMs?: number,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    const messageData: MessageData = {
      conversation_id: conversationId,
      sender: 'assistant',
      content: `Tool executed: ${toolName}`,
      message_type: 'tool_execution',
      tool_data: {
        tool_name: toolName,
        parameters,
        result,
        execution_time_ms: executionTimeMs,
      },
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
      },
    };

    return this.persistMessage(messageData, authToken, { immediate: false });
  }

  async persistError(
    conversationId: number,
    error: string,
    authToken: string,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    const messageData: MessageData = {
      conversation_id: conversationId,
      sender: 'system',
      content: error,
      message_type: 'error',
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
      },
    };

    return this.persistMessage(messageData, authToken, { immediate: true });
  }

  // Utility method to extract tool information from MCP responses
  extractToolDataFromResponse(response: any): {
    toolName?: string;
    parameters?: any;
    result?: any;
  } | null {
    try {
      // Handle N8N webhook response format
      if (response?.success && response?.message?.tool_call) {
        return {
          toolName: response.message.tool_call.name || 'unknown',
          parameters: response.message.tool_call.parameters || {},
          result: response.message.tool_call.result || response.message.tool_call,
        };
      }

      // Handle MCP response format
      if (response?.jsonrpc && response?.result?.content?.[0]?.text) {
        try {
          const mcpResult = JSON.parse(response.result.content[0].text);
          if (mcpResult.success) {
            return {
              toolName: 'mcp_tool',
              parameters: {},
              result: mcpResult,
            };
          }
        } catch {
          // If JSON parsing fails, treat as regular response
        }
      }

      return null;
    } catch (error) {
      console.error('Error extracting tool data:', error);
      return null;
    }
  }
}

// Singleton instance
export const messagePersistenceService = new MessagePersistenceService();

export type { MessageData, PersistenceOptions };