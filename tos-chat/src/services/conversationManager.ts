interface ConversationData {
  id?: number;
  title?: string;
  workspace_id?: number;
  instance_domain?: string;
  status?: 'active' | 'archived' | 'deleted';
  user_id?: number;
  last_message_at?: string;
  message_count?: number;
  created_at?: string;
  updated_at?: string;
}

interface CreateConversationData {
  title?: string;
  workspace_id?: number;
  instance_domain?: string;
  status?: 'active' | 'archived';
  user_id?: number | null;
}

interface UpdateConversationData {
  title?: string;
  last_message_at?: string;
  message_count?: number;
  status?: 'active' | 'archived' | 'deleted';
}

class ConversationManager {
  private baseUrl = 'https://api.autosnap.cloud/api:o_u0lDDs';

  async createConversation(
    data: CreateConversationData,
    authToken: string,
    user?: any
  ): Promise<{ success: boolean; conversation?: ConversationData; error?: string }> {
    try {
      const conversationData = {
        title: data.title || this.generateDefaultTitle(),
        workspace_id: data.workspace_id,
        instance_domain: data.instance_domain,
        status: data.status || 'active',
        user_id: data.user_id || user?.id || null,
      };

      console.log('📤 Sending conversation data to API:', conversationData);

      const response = await fetch(`${this.baseUrl}/conversation`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(conversationData),
      });

      if (!response.ok) {
        throw new Error(`Failed to create conversation: ${response.status} ${response.statusText}`);
      }

      const conversation = await response.json();
      
      console.log('✅ Conversation created:', {
        id: conversation.id,
        title: conversation.title,
        workspace_id: conversation.workspace_id
      });

      return {
        success: true,
        conversation,
      };
    } catch (error) {
      console.error('❌ Failed to create conversation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async updateConversation(
    conversationId: number,
    updates: UpdateConversationData,
    authToken: string
  ): Promise<{ success: boolean; conversation?: ConversationData; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/conversation/${conversationId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Failed to update conversation: ${response.status} ${response.statusText}`);
      }

      const conversation = await response.json();
      
      return {
        success: true,
        conversation,
      };
    } catch (error) {
      console.error('❌ Failed to update conversation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getConversation(
    conversationId: number,
    authToken: string
  ): Promise<{ success: boolean; conversation?: ConversationData; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/conversation/get/${conversationId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get conversation: ${response.status} ${response.statusText}`);
      }

      const conversation = await response.json();
      
      return {
        success: true,
        conversation,
      };
    } catch (error) {
      console.error('❌ Failed to get conversation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async incrementMessageCount(
    conversationId: number,
    authToken: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get current conversation to increment message count
      const { success, conversation, error } = await this.getConversation(conversationId, authToken);
      
      if (!success || !conversation) {
        throw new Error(error || 'Failed to get conversation for message count update');
      }

      const newMessageCount = (conversation.message_count || 0) + 1;
      
      const updateResult = await this.updateConversation(
        conversationId,
        {
          message_count: newMessageCount,
          last_message_at: new Date().toISOString(),
        },
        authToken
      );

      return {
        success: updateResult.success,
        error: updateResult.error,
      };
    } catch (error) {
      console.error('❌ Failed to increment message count:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  generateTitleFromMessage(message: string): string {
    // Clean the message and generate a meaningful title
    const cleanMessage = message.trim();
    
    // Remove common prefixes
    const cleaned = cleanMessage
      .replace(/^(please|can you|could you|help me|i want to|i need to)\s+/i, '')
      .replace(/^(create|build|make|add|setup|configure)\s+/i, '');

    // Take first 50 characters and add ellipsis if needed
    let title = cleaned.length > 50 
      ? cleaned.substring(0, 47) + '...'
      : cleaned;

    // Capitalize first letter
    title = title.charAt(0).toUpperCase() + title.slice(1);

    // Fallback if title is too short or just punctuation
    if (title.length < 10 || /^[^a-zA-Z0-9]*$/.test(title)) {
      title = this.generateDefaultTitle();
    }

    return title;
  }

  generateDefaultTitle(): string {
    const adjectives = ['New', 'Quick', 'Latest', 'Recent', 'Current'];
    const nouns = ['Chat', 'Conversation', 'Discussion', 'Session', 'Workspace'];
    
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    
    return `${adjective} ${noun}`;
  }

  async updateConversationTitle(
    conversationId: number,
    firstUserMessage: string,
    authToken: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const title = this.generateTitleFromMessage(firstUserMessage);
      
      const result = await this.updateConversation(
        conversationId,
        { title },
        authToken
      );

      if (result.success) {
        console.log(`✅ Conversation title updated to: "${title}"`);
      }

      return {
        success: result.success,
        error: result.error,
      };
    } catch (error) {
      console.error('❌ Failed to update conversation title:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async archiveConversation(
    conversationId: number,
    authToken: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.updateConversation(
      conversationId,
      { status: 'archived' },
      authToken
    ).then(result => ({
      success: result.success,
      error: result.error,
    }));
  }

  async deleteConversation(
    conversationId: number,
    authToken: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/conversation/${conversationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete conversation: ${response.status} ${response.statusText}`);
      }

      console.log(`✅ Conversation ${conversationId} deleted successfully`);

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Failed to delete conversation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Utility method to create conversation from current workspace config
  async createConversationFromWorkspace(
    workspaceConfig: { target_workspace_id?: string; instance_domain?: string },
    authToken: string,
    initialMessage?: string,
    user?: any
  ): Promise<{ success: boolean; conversation?: ConversationData; error?: string }> {
    const title = initialMessage 
      ? this.generateTitleFromMessage(initialMessage)
      : this.generateDefaultTitle();

    console.log('🔍 Creating conversation from workspace with user:', {
      hasUser: !!user,
      userId: user?.id,
      workspaceId: workspaceConfig.target_workspace_id,
      title
    });

    return this.createConversation(
      {
        title,
        workspace_id: workspaceConfig.target_workspace_id 
          ? parseInt(workspaceConfig.target_workspace_id) 
          : undefined,
        instance_domain: workspaceConfig.instance_domain,
        status: 'active',
        user_id: user?.id || null,
      },
      authToken,
      user
    );
  }

  // Method to handle anonymous to authenticated user migration
  async migrateAnonymousConversation(
    sessionData: {
      messages: any[];
      workspaceId?: string;
      instanceDomain?: string;
    },
    authToken: string
  ): Promise<{ success: boolean; conversationId?: number; error?: string }> {
    try {
      // Extract first user message for title generation
      const firstUserMessage = sessionData.messages.find(m => m.sender === 'user')?.content;
      
      // Create new conversation
      const createResult = await this.createConversation(
        {
          title: firstUserMessage 
            ? this.generateTitleFromMessage(firstUserMessage)
            : 'Migrated Session',
          workspace_id: sessionData.workspaceId ? parseInt(sessionData.workspaceId) : undefined,
          instance_domain: sessionData.instanceDomain,
          status: 'active',
          user_id: null, // Anonymous migration
        },
        authToken
      );

      if (!createResult.success || !createResult.conversation) {
        throw new Error(createResult.error || 'Failed to create conversation during migration');
      }

      const conversationId = createResult.conversation.id!;

      // Note: Message migration would be handled by the messagePersistence service
      // This method just creates the conversation container

      console.log(`✅ Anonymous session migrated to conversation ${conversationId}`);

      return {
        success: true,
        conversationId,
      };
    } catch (error) {
      console.error('❌ Failed to migrate anonymous conversation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Singleton instance
export const conversationManager = new ConversationManager();

export type { ConversationData, CreateConversationData, UpdateConversationData };