import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import { useWorkspaceConfig } from './useWorkspaceConfig';

interface Conversation {
  id: string;
  title: string;
  workspace_name: string;
  workspace_id: string;
  last_message: string;
  last_message_time: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

interface ConversationGroup {
  workspace_name: string;
  workspace_id: string;
  conversations: Conversation[];
}

interface UseConversationsReturn {
  conversations: Conversation[];
  conversationGroups: ConversationGroup[];
  isLoading: boolean;
  error: string | null;
  fetchConversations: () => Promise<void>;
  createConversation: (title: string, workspaceId: string) => Promise<Conversation | null>;
  updateConversation: (id: string, updates: Partial<Conversation>) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  getMostRecentConversation: () => Conversation | null;
  incrementMessageCount: (conversationId: string) => void;
}

// API Client for conversations
class ConversationApiClient {
  private baseUrl = 'https://api.autosnap.cloud/api:o_u0lDDs';

  async getConversations(authToken: string, configs: any[] = []): Promise<Conversation[]> {
    const response = await fetch(`${this.baseUrl}/conversation`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch conversations: ${response.status}`);
    }

    const rawData = await response.json();
    console.log('🔍 Raw conversations from API:', rawData);
    
    // Map and normalize the data
    const conversations = Array.isArray(rawData) ? rawData.map((conv: any) => {
      console.log('📦 Raw conversation fields:', Object.keys(conv).join(', '));
      console.log('📋 Sample conversation:', conv);
      
      // Try to find workspace name from configs
      const workspaceId = conv.workspace_id?.toString() || conv.workspace?.id?.toString() || 'unknown';
      const workspaceConfig = configs.find(config => config.target_workspace_id === workspaceId);
      const workspaceName = workspaceConfig?.config_name || conv.workspace_name || conv.workspace?.name || `Workspace ${workspaceId}`;
      
      return {
        id: conv.id?.toString() || '',
        title: conv.title || 'Untitled Conversation',
        workspace_name: workspaceName,
        workspace_id: workspaceId,
        last_message: conv.last_message || '',
        last_message_time: conv.last_message_at || conv.updated_at || new Date().toISOString(),
        message_count: conv.message_count || 0,
        created_at: conv.created_at || new Date().toISOString(),
        updated_at: conv.updated_at || new Date().toISOString()
      };
    }) : [];
    
    console.log('✅ Mapped conversations:', conversations);
    return conversations;
  }

  async createConversation(authToken: string, title: string, workspaceId: string, user?: any): Promise<Conversation> {
    const response = await fetch(`${this.baseUrl}/conversation`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        workspace_id: workspaceId,
        user_id: user?.id || null,
        status: 'active',
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create conversation: ${response.status}`);
    }

    return await response.json();
  }

  async updateConversation(authToken: string, id: string, updates: Partial<Conversation>): Promise<Conversation> {
    const response = await fetch(`${this.baseUrl}/conversation/${id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error(`Failed to update conversation: ${response.status}`);
    }

    return await response.json();
  }

  async getConversation(authToken: string, id: string): Promise<Conversation> {
    const response = await fetch(`${this.baseUrl}/conversation/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch conversation: ${response.status}`);
    }

    return await response.json();
  }

  async deleteConversation(authToken: string, id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/conversation/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete conversation: ${response.status}`);
    }
  }
}

const conversationApiClient = new ConversationApiClient();

export const useConversations = (): UseConversationsReturn => {
  const { authToken, isAuthenticated, user } = useAuth();
  const { configs } = useWorkspaceConfig();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Group conversations by workspace
  const conversationGroups: ConversationGroup[] = useMemo(() => {
    console.log('🔄 Creating conversationGroups from conversations:', conversations.length);
    const groups = conversations.reduce((groups, conversation) => {
      const existingGroup = groups.find(g => g.workspace_id === conversation.workspace_id);
      
      if (existingGroup) {
        existingGroup.conversations.push(conversation);
      } else {
        groups.push({
          workspace_name: conversation.workspace_name,
          workspace_id: conversation.workspace_id,
          conversations: [conversation],
        });
      }
      
      return groups;
    }, [] as ConversationGroup[]);
    
    console.log('✅ conversationGroups created:', {
      groupCount: groups.length,
      totalConversations: groups.reduce((sum, group) => sum + group.conversations.length, 0)
    });
    
    return groups;
  }, [conversations]);

  const fetchConversations = useCallback(async () => {
    if (!isAuthenticated || !authToken) {
      setConversations([]);
      return;
    }

    console.log('📡 Fetching conversations from API...');
    setIsLoading(true);
    setError(null);

    try {
      const fetchedConversations = await conversationApiClient.getConversations(authToken, configs);
      
      // Sort conversations by created_at descending (newest first)
      const sortedConversations = fetchedConversations.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      console.log('📊 API returned conversations:', sortedConversations.length);
      
      // Prevent overwriting existing conversations if API returns empty unexpectedly
      if (sortedConversations.length === 0 && conversations.length > 0) {
        console.warn('⚠️ API returned no conversations but we have existing ones, keeping current state');
        return;
      }
      
      setConversations(sortedConversations);
      console.log('✅ Conversations updated in state');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch conversations');
      console.error('❌ Error fetching conversations:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, authToken, configs, conversations.length]);

  const createConversation = async (title: string, workspaceId: string): Promise<Conversation | null> => {
    if (!isAuthenticated || !authToken) {
      setError('Authentication required to create conversation');
      return null;
    }

    try {
      const rawConversation = await conversationApiClient.createConversation(authToken, title, workspaceId, user);
      
      // Map the raw conversation to include workspace_name for proper grouping
      const workspaceConfig = configs.find(config => config.target_workspace_id === workspaceId);
      const mappedConversation: Conversation = {
        id: rawConversation.id?.toString() || '',
        title: rawConversation.title || title,
        workspace_name: workspaceConfig?.config_name || `Workspace ${workspaceId}`,
        workspace_id: workspaceId,
        last_message: '',
        last_message_time: rawConversation.created_at || new Date().toISOString(),
        message_count: 0,
        created_at: rawConversation.created_at || new Date().toISOString(),
        updated_at: rawConversation.updated_at || new Date().toISOString()
      };
      
      console.log('🎯 Conversation created, forcing refresh from API like refresh button...');
      
      // Wait a moment for the API to process, then refresh like the refresh button
      setTimeout(() => {
        console.log('🔄 Refreshing conversations after delay...');
        fetchConversations();
      }, 200);
      
      // Also try immediate refresh
      fetchConversations();
      
      return mappedConversation;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create conversation');
      console.error('Error creating conversation:', err);
      return null;
    }
  };

  const updateConversation = async (id: string, updates: Partial<Conversation>): Promise<void> => {
    if (!isAuthenticated || !authToken) {
      setError('Authentication required to update conversation');
      return;
    }

    try {
      const updatedConversation = await conversationApiClient.updateConversation(authToken, id, updates);
      setConversations(prev => 
        prev.map(conv => conv.id === id ? updatedConversation : conv)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update conversation');
      console.error('Error updating conversation:', err);
    }
  };

  const deleteConversation = async (id: string): Promise<void> => {
    if (!isAuthenticated || !authToken) {
      setError('Authentication required to delete conversation');
      return;
    }

    console.log('🗑️ Starting deletion of conversation:', id);
    console.log('📊 Current conversations count:', conversations.length);

    try {
      // Optimistically remove from UI first
      const prevConversations = conversations;
      setConversations(prev => {
        const filtered = prev.filter(conv => conv.id !== id);
        console.log('📊 Conversations after deletion:', filtered.length);
        return filtered;
      });

      // Then delete from API
      await conversationApiClient.deleteConversation(authToken, id);
      console.log(`✅ Conversation ${id} deleted successfully from API`);
    } catch (err) {
      console.error('❌ Failed to delete conversation from API, reverting:', err);
      // Revert optimistic update on API failure
      setConversations(prevConversations);
      setError(err instanceof Error ? err.message : 'Failed to delete conversation');
    }
  };

  // Fetch conversations when authentication status changes
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const getMostRecentConversation = useCallback((): Conversation | null => {
    if (conversations.length === 0) return null;
    
    // Sort by last_message_time to get the most recent
    const sortedConversations = [...conversations].sort((a, b) => 
      new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()
    );
    
    return sortedConversations[0];
  }, [conversations]);

  // Optimistically increment message count for a specific conversation
  const incrementMessageCount = useCallback((conversationId: string) => {
    console.log('📈 Incrementing message count for conversation:', conversationId);
    
    setConversations(prev => prev.map(conv => 
      conv.id === conversationId 
        ? { 
            ...conv, 
            message_count: conv.message_count + 1,
            last_message_time: new Date().toISOString()
          }
        : conv
    ));
  }, []);

  return {
    conversations,
    conversationGroups,
    isLoading,
    error,
    fetchConversations,
    createConversation,
    updateConversation,
    deleteConversation,
    getMostRecentConversation,
    incrementMessageCount,
  };
};

export type { Conversation, ConversationGroup };