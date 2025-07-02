import React, { useState, useEffect } from 'react';
import { Search, MessageSquare, Plus, Clock, Loader, RefreshCw, Trash2 } from 'lucide-react';
import { useConversations } from '../../hooks/useConversations';
import { useAuth } from '../../hooks/useAuth';

interface ChatHistoryTabProps {
  onLoadConversation?: (conversationId: number) => void;
  onNewConversation?: () => void;
  onDeleteConversation?: (conversationId: string) => void;
  forceRefresh?: () => void;
}

const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays}d ago`;
  
  return date.toLocaleDateString();
};

const ChatHistoryTab: React.FC<ChatHistoryTabProps> = ({ onLoadConversation, onNewConversation, onDeleteConversation, forceRefresh }) => {
  const { isAuthenticated } = useAuth();
  const { conversationGroups, isLoading, error, fetchConversations, deleteConversation } = useConversations();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);

  // Auto-select the most recent conversation when list updates
  useEffect(() => {
    console.log('🔍 ChatHistoryTab: conversationGroups updated:', {
      groupCount: conversationGroups.length,
      totalConversations: conversationGroups.reduce((sum, group) => sum + group.conversations.length, 0)
    });
    
    if (conversationGroups.length > 0 && !selectedConversationId) {
      const allConversations = conversationGroups.flatMap(group => group.conversations);
      const mostRecent = allConversations.sort((a, b) => 
        new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()
      )[0];
      
      if (mostRecent) {
        setSelectedConversationId(parseInt(mostRecent.id));
        console.log('🎯 Auto-selected most recent conversation:', mostRecent.id);
      }
    }
  }, [conversationGroups, selectedConversationId]);

  // Filter conversations based on search query
  const filteredGroups = conversationGroups.map(group => ({
    ...group,
    conversations: group.conversations.filter(conversation =>
      conversation.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conversation.last_message.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(group => group.conversations.length > 0);

  const handleConversationClick = (conversationId: string) => {
    const numericId = parseInt(conversationId);
    setSelectedConversationId(numericId);
    onLoadConversation?.(numericId);
  };

  const handleRefresh = () => {
    console.log('🔄 REFRESH BUTTON CLICKED - calling fetchConversations...');
    fetchConversations();
  };

  // Expose the refresh function so it can be called externally
  useEffect(() => {
    if (forceRefresh) {
      // Replace the forceRefresh function with our handleRefresh
      window.tosForceRefresh = handleRefresh;
    }
  }, [forceRefresh]);

  const handleNewConversation = async () => {
    if (!onNewConversation) return;
    
    setIsCreatingConversation(true);
    try {
      await onNewConversation();
      
      // Clear current selection so the auto-select effect will pick the new conversation
      setSelectedConversationId(null);
      
      // Small delay to ensure the conversation appears in the list
      setTimeout(() => {
        setIsCreatingConversation(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to create new conversation:', error);
      setIsCreatingConversation(false);
    }
  };

  const handleDeleteConversation = async (conversationId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent conversation from being selected
    
    if (confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
      try {
        await deleteConversation(conversationId);
        
        // Notify parent component about the deletion (will clear chat if active)
        if (onDeleteConversation) {
          onDeleteConversation(conversationId);
        }
      } catch (error) {
        console.error('Failed to delete conversation:', error);
      }
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
        <MessageSquare className="w-12 h-12 text-slate-300 mb-4" />
        <h3 className="text-sm font-medium text-slate-700 mb-2">Sign In Required</h3>
        <p className="text-xs text-slate-500">
          Sign in to view and manage your chat history across devices.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Search & Actions */}
      <div className="p-4 border-b border-slate-200 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#fe3500] focus:border-transparent"
            />
          </div>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50"
            title="Refresh conversations"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        <button 
          onClick={handleNewConversation}
          disabled={isCreatingConversation}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 text-sm bg-[#fe3500] text-white rounded-md hover:bg-[#e63000] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCreatingConversation ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              New Conversation
            </>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader className="w-6 h-6 animate-spin text-[#fe3500]" />
          </div>
        ) : error ? (
          <div className="p-4 text-center">
            <p className="text-sm text-red-600 mb-2">Failed to load conversations</p>
            <p className="text-xs text-slate-500 mb-3">{error}</p>
            <button
              onClick={handleRefresh}
              className="text-sm text-[#fe3500] hover:underline"
            >
              Try again
            </button>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
            <MessageSquare className="w-12 h-12 text-slate-300 mb-4" />
            <h3 className="text-sm font-medium text-slate-700 mb-2">
              {searchQuery ? 'No matching conversations' : 'No conversations yet'}
            </h3>
            <p className="text-xs text-slate-500">
              {searchQuery 
                ? 'Try adjusting your search terms'
                : 'Start a new conversation to see your chat history here'
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredGroups.map((group) => (
              <div key={group.workspace_id} className="p-4">
                {/* Always show workspace header for clarity */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-[#fe3500] rounded-full"></div>
                  <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                    {group.workspace_name}
                  </h4>
                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    {group.conversations.length} chat{group.conversations.length !== 1 ? 's' : ''}
                  </span>
                  <div className="flex-1 h-px bg-slate-200"></div>
                </div>

                {/* Conversations */}
                <div className="space-y-2">
                  {group.conversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      className={`relative group rounded-lg border transition-colors ${
                        selectedConversationId === parseInt(conversation.id)
                          ? 'bg-[#fe3500]/5 border-[#fe3500]/20'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <button
                        onClick={() => handleConversationClick(conversation.id)}
                        className="w-full text-left p-3"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h5 className="text-sm font-medium text-slate-800 truncate">
                            {conversation.title}
                          </h5>
                          <div className="flex items-center gap-1 text-xs text-slate-500 shrink-0">
                            <Clock className="w-3 h-3" />
                            {formatRelativeTime(conversation.last_message_time)}
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 overflow-hidden" style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical'
                        }}>
                          {conversation.last_message}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-slate-500">
                            {conversation.message_count} messages
                          </span>
                        </div>
                      </button>
                      
                      {/* Delete button - only visible on hover */}
                      <button
                        onClick={(e) => handleDeleteConversation(conversation.id, e)}
                        className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded shadow-sm"
                        title="Delete conversation"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatHistoryTab;