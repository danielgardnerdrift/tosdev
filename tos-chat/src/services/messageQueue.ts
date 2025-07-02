interface QueuedMessage {
  id: string;
  messageData: any;
  authToken: string;
  timestamp: number;
  retryCount: number;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

interface QueuedConversationUpdate {
  id: string;
  conversationId: number;
  updates: any;
  authToken: string;
  timestamp: number;
  retryCount: number;
}

class MessageQueue {
  private messageQueue: QueuedMessage[] = [];
  private conversationQueue: QueuedConversationUpdate[] = [];
  private isProcessing = false;
  private maxRetries = 3;
  private batchSize = 5;
  private processingInterval = 2000; // 2 seconds
  private isOnline = navigator.onLine;

  constructor() {
    this.initializeOnlineListener();
    this.loadFromStorage();
    this.startProcessing();
  }

  private initializeOnlineListener() {
    window.addEventListener('online', () => {
      console.log('🌐 Back online - resuming message queue processing');
      this.isOnline = true;
      this.processQueue();
    });

    window.addEventListener('offline', () => {
      console.log('📴 Gone offline - queuing messages for later');
      this.isOnline = false;
    });
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private saveToStorage() {
    try {
      localStorage.setItem('tos_message_queue', JSON.stringify({
        messages: this.messageQueue,
        conversations: this.conversationQueue,
      }));
    } catch (error) {
      console.error('Failed to save message queue to storage:', error);
    }
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem('tos_message_queue');
      if (stored) {
        const { messages = [], conversations = [] } = JSON.parse(stored);
        this.messageQueue = messages;
        this.conversationQueue = conversations;
        
        console.log(`📥 Loaded ${messages.length} messages and ${conversations.length} conversation updates from storage`);
      }
    } catch (error) {
      console.error('Failed to load message queue from storage:', error);
    }
  }

  queueMessage(
    messageData: any,
    authToken: string,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): string {
    const queuedMessage: QueuedMessage = {
      id: this.generateId(),
      messageData,
      authToken,
      timestamp: Date.now(),
      retryCount: 0,
      priority,
      status: 'pending',
    };

    // Insert based on priority
    if (priority === 'high') {
      this.messageQueue.unshift(queuedMessage);
    } else {
      this.messageQueue.push(queuedMessage);
    }

    this.saveToStorage();
    
    console.log(`📤 Queued message with priority ${priority}:`, {
      id: queuedMessage.id,
      sender: messageData.sender,
      type: messageData.message_type
    });

    // Process immediately if online and not already processing
    if (this.isOnline && !this.isProcessing) {
      this.processQueue();
    }

    return queuedMessage.id;
  }

  queueConversationUpdate(
    conversationId: number,
    updates: any,
    authToken: string
  ): string {
    const queuedUpdate: QueuedConversationUpdate = {
      id: this.generateId(),
      conversationId,
      updates,
      authToken,
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.conversationQueue.push(queuedUpdate);
    this.saveToStorage();

    console.log(`📤 Queued conversation update:`, {
      id: queuedUpdate.id,
      conversationId,
      updates: Object.keys(updates)
    });

    return queuedUpdate.id;
  }

  private async startProcessing() {
    setInterval(() => {
      if (this.isOnline && !this.isProcessing && this.hasQueuedItems()) {
        this.processQueue();
      }
    }, this.processingInterval);
  }

  private hasQueuedItems(): boolean {
    return this.messageQueue.some(m => m.status === 'pending') || 
           this.conversationQueue.length > 0;
  }

  private async processQueue() {
    if (this.isProcessing || !this.isOnline) {
      return;
    }

    this.isProcessing = true;

    try {
      // Process conversation updates first (they're usually metadata)
      await this.processConversationUpdates();
      
      // Then process messages in batches
      await this.processMessages();
    } catch (error) {
      console.error('Error processing queue:', error);
    } finally {
      this.isProcessing = false;
      this.saveToStorage();
    }
  }

  private async processConversationUpdates() {
    const { conversationManager } = await import('./conversationManager');
    
    const updates = this.conversationQueue.splice(0, this.batchSize);
    
    for (const update of updates) {
      try {
        const result = await conversationManager.updateConversation(
          update.conversationId,
          update.updates,
          update.authToken
        );

        if (result.success) {
          console.log(`✅ Processed conversation update ${update.id}`);
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (error) {
        console.error(`❌ Failed to process conversation update ${update.id}:`, error);
        
        // Retry logic
        if (update.retryCount < this.maxRetries) {
          update.retryCount++;
          this.conversationQueue.push(update);
        } else {
          console.error(`💀 Giving up on conversation update ${update.id} after ${this.maxRetries} retries`);
        }
      }
    }
  }

  private async processMessages() {
    const { messagePersistenceService } = await import('./messagePersistence');
    
    const pendingMessages = this.messageQueue
      .filter(m => m.status === 'pending')
      .slice(0, this.batchSize);

    for (const message of pendingMessages) {
      message.status = 'processing';
      
      try {
        const result = await messagePersistenceService.persistMessage(
          message.messageData,
          message.authToken,
          { retryCount: message.retryCount }
        );

        if (result.success) {
          message.status = 'completed';
          console.log(`✅ Processed queued message ${message.id}`);
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (error) {
        console.error(`❌ Failed to process queued message ${message.id}:`, error);
        
        // Retry logic
        if (message.retryCount < this.maxRetries) {
          message.retryCount++;
          message.status = 'pending';
        } else {
          message.status = 'failed';
          console.error(`💀 Giving up on message ${message.id} after ${this.maxRetries} retries`);
        }
      }
    }

    // Clean up completed and failed messages
    this.messageQueue = this.messageQueue.filter(m => 
      m.status !== 'completed' && 
      !(m.status === 'failed' && m.retryCount >= this.maxRetries)
    );
  }

  // Method to handle authentication state changes
  updateAuthTokens(oldToken: string | null, newToken: string) {
    let updatedCount = 0;

    // Update message queue
    this.messageQueue.forEach(message => {
      if (!oldToken || message.authToken === oldToken) {
        message.authToken = newToken;
        updatedCount++;
      }
    });

    // Update conversation queue
    this.conversationQueue.forEach(update => {
      if (!oldToken || update.authToken === oldToken) {
        update.authToken = newToken;
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      console.log(`🔄 Updated ${updatedCount} queued items with new auth token`);
      this.saveToStorage();
      
      // Process queue with new token
      if (this.isOnline) {
        this.processQueue();
      }
    }
  }

  // Get queue status for debugging
  getQueueStatus(): {
    messages: { pending: number; processing: number; failed: number };
    conversations: number;
    isOnline: boolean;
    isProcessing: boolean;
  } {
    const messageStatus = this.messageQueue.reduce(
      (acc, msg) => {
        acc[msg.status]++;
        return acc;
      },
      { pending: 0, processing: 0, completed: 0, failed: 0 }
    );

    return {
      messages: {
        pending: messageStatus.pending,
        processing: messageStatus.processing,
        failed: messageStatus.failed,
      },
      conversations: this.conversationQueue.length,
      isOnline: this.isOnline,
      isProcessing: this.isProcessing,
    };
  }

  // Force process queue (for manual retry)
  forceProcess() {
    console.log('🔄 Force processing message queue...');
    this.processQueue();
  }

  // Clear failed messages
  clearFailedMessages() {
    const failedCount = this.messageQueue.filter(m => m.status === 'failed').length;
    this.messageQueue = this.messageQueue.filter(m => m.status !== 'failed');
    this.saveToStorage();
    
    console.log(`🗑️ Cleared ${failedCount} failed messages from queue`);
    return failedCount;
  }

  // Method to batch message persistence (for efficiency)
  async batchPersistMessages(messages: any[], authToken: string): Promise<void> {
    messages.forEach(messageData => {
      this.queueMessage(messageData, authToken, 'medium');
    });
  }
}

// Singleton instance
export const messageQueue = new MessageQueue();

export type { QueuedMessage, QueuedConversationUpdate };