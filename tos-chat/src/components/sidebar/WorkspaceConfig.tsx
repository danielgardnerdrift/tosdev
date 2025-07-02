import React, { useState } from 'react';
import { Plus, Edit, Trash2, Check, X, Eye, EyeOff, Loader, AlertTriangle } from 'lucide-react';
import { useWorkspaceConfig, WorkspaceConfig, CreateWorkspaceConfigData } from '../../hooks/useWorkspaceConfig';

interface WorkspaceConfigProps {
  onConfigSelect?: (config: WorkspaceConfig) => void;
}

const WorkspaceConfigComponent: React.FC<WorkspaceConfigProps> = ({ onConfigSelect }) => {
  const { configs, activeConfig, isLoading, error, createConfig, updateConfig, deleteConfig, setActiveConfig } = useWorkspaceConfig();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [switchingWorkspace, setSwitchingWorkspace] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<CreateWorkspaceConfigData>({
    config_name: '',
    anthropic_api_key: '',
    xano_metadata_api_key: '',
    target_workspace_id: '',
    instance_domain: '',
    xano_metadata_base_url: 'https://api.autosnap.cloud/api:meta'
  });

  const resetForm = () => {
    setFormData({
      config_name: '',
      anthropic_api_key: '',
      xano_metadata_api_key: '',
      target_workspace_id: '',
      instance_domain: '',
      xano_metadata_base_url: 'https://api.autosnap.cloud/api:meta'
    });
    setShowForm(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingId) {
      // For editing, we need to preserve the is_active state
      const existingConfig = configs.find(c => c.id === editingId);
      await updateConfig(editingId, {
        ...formData,
        is_active: existingConfig?.is_active || false
      });
    } else {
      const newConfig = await createConfig(formData);
      if (newConfig && onConfigSelect) {
        onConfigSelect(newConfig);
      }
    }
    
    resetForm();
  };

  const handleEdit = (config: WorkspaceConfig) => {
    setFormData({
      config_name: config.config_name,
      anthropic_api_key: config.anthropic_api_key,
      xano_metadata_api_key: config.xano_metadata_api_key,
      target_workspace_id: config.target_workspace_id,
      instance_domain: config.instance_domain,
      xano_metadata_base_url: config.xano_metadata_base_url
    });
    setEditingId(config.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this workspace configuration?')) {
      await deleteConfig(id);
    }
  };

  const handleSetActive = async (config: WorkspaceConfig) => {
    try {
      setSwitchingWorkspace(config.id);
      console.log(`🔄 Switching to workspace: ${config.config_name}`);
      
      // Set this config as active (will deactivate others)
      await setActiveConfig(config.id);
      
      // Trigger immediate reconnection to the new workspace
      if (onConfigSelect) {
        console.log(`🔌 Auto-connecting to workspace: ${config.config_name}`);
        onConfigSelect(config);
      }
    } catch (error) {
      console.error('❌ Failed to switch workspace:', error);
    } finally {
      setSwitchingWorkspace(null);
    }
  };

  const togglePasswordVisibility = (fieldKey: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [fieldKey]: !prev[fieldKey]
    }));
  };

  const maskApiKey = (key: string | undefined | null) => {
    if (!key || key.length <= 8) return key || '••••••••';
    // Show first 4 and last 4 characters with dots in between
    return key.substring(0, 4) + '••••' + key.substring(key.length - 4);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Workspace Configurations</h3>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-[#fe3500] text-white rounded-md hover:bg-[#e63000] transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add Config
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-red-800 font-medium">Configuration Error</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-slate-800">
              {editingId ? 'Edit Configuration' : 'New Configuration'}
            </h4>
            <button
              onClick={resetForm}
              className="p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Configuration Name *
              </label>
              <input
                type="text"
                value={formData.config_name}
                onChange={(e) => setFormData(prev => ({ ...prev, config_name: e.target.value }))}
                placeholder="e.g., Production Workspace"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#fe3500] focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Anthropic API Key *
              </label>
              <div className="relative">
                <input
                  type={showPasswords.anthropic ? 'text' : 'password'}
                  value={formData.anthropic_api_key}
                  onChange={(e) => setFormData(prev => ({ ...prev, anthropic_api_key: e.target.value }))}
                  placeholder="sk-ant-..."
                  className="w-full px-3 py-2 pr-10 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#fe3500] focus:border-transparent"
                  required
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('anthropic')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPasswords.anthropic ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Xano Metadata API Key *
              </label>
              <div className="relative">
                <input
                  type={showPasswords.xano ? 'text' : 'password'}
                  value={formData.xano_metadata_api_key}
                  onChange={(e) => setFormData(prev => ({ ...prev, xano_metadata_api_key: e.target.value }))}
                  placeholder="Your Xano API token"
                  className="w-full px-3 py-2 pr-10 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#fe3500] focus:border-transparent"
                  required
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('xano')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPasswords.xano ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Target Workspace ID *
              </label>
              <input
                type="text"
                value={formData.target_workspace_id}
                onChange={(e) => setFormData(prev => ({ ...prev, target_workspace_id: e.target.value }))}
                placeholder="e.g., 7"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#fe3500] focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Instance Domain *
              </label>
              <input
                type="text"
                value={formData.instance_domain}
                onChange={(e) => setFormData(prev => ({ ...prev, instance_domain: e.target.value }))}
                placeholder="e.g., api.yoursite.com"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#fe3500] focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Xano Metadata Base URL
              </label>
              <input
                type="text"
                value={formData.xano_metadata_base_url}
                onChange={(e) => setFormData(prev => ({ ...prev, xano_metadata_base_url: e.target.value }))}
                placeholder="https://api.autosnap.cloud/api:meta"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#fe3500] focus:border-transparent"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-[#fe3500] text-white rounded-md hover:bg-[#e63000] transition-colors disabled:opacity-50"
              >
                {isLoading && <Loader className="w-3 h-3 animate-spin" />}
                <Check className="w-3 h-3" />
                {editingId ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-2 text-sm text-slate-600 border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Configurations List */}
      <div className="space-y-2">
        {isLoading && configs.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader className="w-6 h-6 animate-spin text-[#fe3500]" />
          </div>
        ) : configs.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p className="text-sm">No workspace configurations yet</p>
            <p className="text-xs mt-1">Add your first configuration to get started</p>
          </div>
        ) : (
          configs.map((config) => (
            <div
              key={config.id}
              className={`border rounded-lg p-3 transition-colors ${
                config.is_active 
                  ? 'border-[#fe3500] bg-[#fe3500]/5' 
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-slate-800">{config.config_name}</h4>
                    {config.is_active && (
                      <span className="px-2 py-0.5 text-xs bg-[#fe3500] text-white rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Workspace: {config.target_workspace_id} • {config.instance_domain}
                  </p>
                </div>
                
                <div className="flex items-center gap-1">
                  {!config.is_active && (
                    <button
                      onClick={() => handleSetActive(config)}
                      disabled={isLoading || switchingWorkspace === config.id}
                      className="p-1 text-slate-400 hover:text-[#fe3500] transition-colors disabled:opacity-50"
                      title={switchingWorkspace === config.id ? "Switching workspace..." : "Set as active"}
                    >
                      {switchingWorkspace === config.id ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(config)}
                    className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                    title="Edit configuration"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(config.id)}
                    disabled={config.is_active}
                    className="p-1 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50"
                    title={config.is_active ? "Cannot delete active configuration" : "Delete configuration"}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="text-xs text-slate-500 space-y-1">
                <div className="truncate">
                  <span className="font-medium">API Keys:</span>
                  <span className="ml-1">{maskApiKey(config.anthropic_api_key)}</span>
                  <span className="mx-1">/</span>
                  <span>{maskApiKey(config.xano_metadata_api_key)}</span>
                </div>
                <div>Created: {new Date(config.created_at).toLocaleDateString()}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default WorkspaceConfigComponent;