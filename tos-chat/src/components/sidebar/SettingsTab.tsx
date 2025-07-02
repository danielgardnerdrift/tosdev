import React, { useState } from 'react';
import { ChevronDown, ChevronRight, User, Building, Settings as SettingsIcon, Loader } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import WorkspaceConfig from './WorkspaceConfig';

interface SettingsSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
}

interface SettingsTabProps {
  onConfigSelect?: (config: any) => void;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ onConfigSelect }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [sections, setSections] = useState<SettingsSection[]>([
    {
      id: 'workspace',
      title: 'Workspace Configurations',
      icon: <Building className="w-4 h-4" />,
      isOpen: true
    },
    {
      id: 'profile',
      title: 'User Profile',
      icon: <User className="w-4 h-4" />,
      isOpen: false
    },
    {
      id: 'preferences',
      title: 'App Preferences',
      icon: <SettingsIcon className="w-4 h-4" />,
      isOpen: false
    }
  ]);

  const toggleSection = (sectionId: string) => {
    setSections(prev => prev.map(section => ({
      ...section,
      isOpen: section.id === sectionId ? !section.isOpen : section.isOpen
    })));
  };

  const renderSectionContent = (sectionId: string) => {
    switch (sectionId) {
      case 'workspace':
        return (
          <div className="p-4">
            <WorkspaceConfig onConfigSelect={onConfigSelect} />
          </div>
        );
      
      case 'profile':
        return (
          <div className="p-4">
            {isAuthenticated ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Name</label>
                  <div className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md">
                    {user?.name}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                  <div className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md">
                    {user?.email}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Member Since</label>
                  <div className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md">
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-500">
                <User className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">Sign in to view profile settings</p>
              </div>
            )}
          </div>
        );
      
      case 'preferences':
        return (
          <div className="p-4">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Theme</label>
                <select className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#fe3500] focus:border-transparent">
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Chat Font Size</label>
                <select className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#fe3500] focus:border-transparent">
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-700">Auto-save conversations</label>
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded border-slate-300 text-[#fe3500] focus:ring-[#fe3500]"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-700">Show typing indicators</label>
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded border-slate-300 text-[#fe3500] focus:ring-[#fe3500]"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-700">Enable notifications</label>
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-[#fe3500] focus:ring-[#fe3500]"
                />
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-200">
              <button className="w-full px-3 py-2 text-sm text-slate-600 border border-slate-300 rounded-md hover:bg-slate-50 transition-colors">
                Reset to Defaults
              </button>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader className="w-6 h-6 animate-spin text-[#fe3500]" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="divide-y divide-slate-200">
        {sections.map((section) => (
          <div key={section.id} className="border-b border-slate-200">
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="text-slate-600">{section.icon}</div>
                <span className="text-sm font-medium text-slate-800">{section.title}</span>
              </div>
              {section.isOpen ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </button>
            
            {section.isOpen && (
              <div className="border-t border-slate-100">
                {renderSectionContent(section.id)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SettingsTab;