import React from 'react';
import { X, MessageSquare, Settings } from 'lucide-react';
import { useSidebar } from '../../contexts/SidebarContext';
import ChatHistoryTab from './ChatHistoryTab';
import SettingsTab from './SettingsTab';

interface SidebarProps {
  onLoadConversation?: (conversationId: number) => void;
  onConfigSelect?: (config: any) => void;
  onNewConversation?: () => void;
  onDeleteConversation?: (conversationId: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onLoadConversation, onConfigSelect, onNewConversation, onDeleteConversation }) => {
  const { isOpen, activeTab, setActiveTab, toggleSidebar } = useSidebar();

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Mobile backdrop */}
      <div 
        className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={toggleSidebar}
      />
      
      {/* Sidebar */}
      <div className="fixed right-0 top-0 bottom-0 w-80 bg-white border-l border-slate-200 flex flex-col z-50 lg:relative lg:w-96">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white">
          <h2 className="text-lg font-semibold text-slate-800">Workspace</h2>
          <button
            onClick={toggleSidebar}
            className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-white">
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'history'
                ? 'text-[#fe3500] border-b-2 border-[#fe3500] bg-[#fe3500]/5'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Chat History
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'settings'
                ? 'text-[#fe3500] border-b-2 border-[#fe3500] bg-[#fe3500]/5'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'history' ? (
            <ChatHistoryTab 
              onLoadConversation={onLoadConversation} 
              onNewConversation={onNewConversation} 
              onDeleteConversation={onDeleteConversation}
              forceRefresh={true} 
            />
          ) : (
            <SettingsTab onConfigSelect={onConfigSelect} />
          )}
        </div>
      </div>
    </>
  );
};

export default Sidebar;