import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SidebarState {
  isOpen: boolean;
  activeTab: 'history' | 'settings';
}

interface SidebarContextType extends SidebarState {
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setActiveTab: (tab: 'history' | 'settings') => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

interface SidebarProviderProps {
  children: ReactNode;
}

export const SidebarProvider: React.FC<SidebarProviderProps> = ({ children }) => {
  const [sidebarState, setSidebarState] = useState<SidebarState>({
    isOpen: true,
    activeTab: 'history'
  });

  const toggleSidebar = () => {
    setSidebarState(prev => ({ ...prev, isOpen: !prev.isOpen }));
  };

  const setSidebarOpen = (open: boolean) => {
    setSidebarState(prev => ({ ...prev, isOpen: open }));
  };

  const setActiveTab = (tab: 'history' | 'settings') => {
    setSidebarState(prev => ({ ...prev, activeTab: tab }));
  };

  const contextValue: SidebarContextType = {
    ...sidebarState,
    toggleSidebar,
    setSidebarOpen,
    setActiveTab,
  };

  return (
    <SidebarContext.Provider value={contextValue}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

export type { SidebarState, SidebarContextType };