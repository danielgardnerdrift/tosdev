import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';

interface WorkspaceConfig {
  id: string;
  config_name: string;
  anthropic_api_key: string;
  xano_metadata_api_key: string;
  target_workspace_id: string;
  instance_domain: string;
  xano_metadata_base_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CreateWorkspaceConfigData {
  config_name: string;
  anthropic_api_key: string;
  xano_metadata_api_key: string;
  target_workspace_id: string;
  instance_domain: string;
  xano_metadata_base_url: string;
}

interface UseWorkspaceConfigReturn {
  configs: WorkspaceConfig[];
  activeConfig: WorkspaceConfig | null;
  isLoading: boolean;
  error: string | null;
  fetchConfigs: () => Promise<void>;
  createConfig: (data: CreateWorkspaceConfigData) => Promise<WorkspaceConfig | null>;
  updateConfig: (id: string, updates: Partial<WorkspaceConfig>) => Promise<void>;
  deleteConfig: (id: string) => Promise<void>;
  setActiveConfig: (id: string) => Promise<void>;
}

// API Client for workspace configurations
class WorkspaceConfigApiClient {
  private baseUrl = 'https://api.autosnap.cloud/api:o_u0lDDs';

  async getConfigs(authToken: string, user: any): Promise<WorkspaceConfig[]> {
    const userId = user?.id || 'null';
    const url = `${this.baseUrl}/workspace-config/user_id/${userId}`;

    console.log('📡 Fetching workspace configs with:', {
      url,
      method: 'GET',
      userId,
      hasAuthToken: !!authToken,
      hasUser: !!user
    });

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch workspace configs: ${response.status}`);
    }

    const rawData = await response.json();
    console.log('🔍 Fetched workspace configs from API:', rawData);
    
    // Map the API response to our expected format
    const data = Array.isArray(rawData) ? rawData.map((config: any) => {
      // Check what fields are actually present
      console.log('📦 Raw config fields:', Object.keys(config).join(', '));
      
      // Map fields - the API might be returning shortened field names
      return {
        id: config.id,
        config_name: config.config_name,
        anthropic_api_key: config.anthropic_api_key || config.anthropic_key || '',
        xano_metadata_api_key: config.xano_metadata_api_key || config.xano_api_key || config.xano_key || '',
        target_workspace_id: config.target_workspace_id || config.workspace_id,
        instance_domain: config.instance_domain,
        xano_metadata_base_url: config.xano_metadata_base_url || config.xano_base_url || 'https://api.autosnap.cloud/api:meta',
        is_active: config.is_active || false,
        created_at: config.created_at,
        updated_at: config.updated_at
      };
    }) : [];
    
    // Log the structure of the first config if available
    if (data.length > 0) {
      console.log('📋 First mapped config:', {
        keys: Object.keys(data[0]),
        has_xano_key: !!data[0].xano_metadata_api_key,
        has_anthropic_key: !!data[0].anthropic_api_key,
        sample: data[0]
      });
    }

    return data;
  }

  async createConfig(authToken: string, data: CreateWorkspaceConfigData, user: any): Promise<WorkspaceConfig> {
    const requestBody = {
      ...data,
      user: user || null
    };

    console.log('🔍 Creating workspace config with data:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(`${this.baseUrl}/workspace-config/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(errorData || `Failed to create workspace config: ${response.status}`);
    }

    return await response.json();
  }

  async updateConfig(authToken: string, id: string, updates: Partial<WorkspaceConfig>, user: any, fullConfig?: WorkspaceConfig): Promise<WorkspaceConfig> {
    console.log('🔧 updateConfig called with:', { id, idType: typeof id, updates, hasUser: !!user, hasFullConfig: !!fullConfig });
    
    // For the new PUT endpoint, we need to send all fields
    const requestBody = {
      user_id: user?.id || null,
      user_ref: user?.id || null,
      config_name: fullConfig?.config_name || updates.config_name || '',
      anthropic_api_key: fullConfig?.anthropic_api_key || updates.anthropic_api_key || '',
      xano_metadata_api_key: fullConfig?.xano_metadata_api_key || updates.xano_metadata_api_key || '',
      target_workspace_id: fullConfig?.target_workspace_id || updates.target_workspace_id || '',
      instance_domain: fullConfig?.instance_domain || updates.instance_domain || '',
      xano_metadata_base_url: fullConfig?.xano_metadata_base_url || updates.xano_metadata_base_url || 'https://api.autosnap.cloud/api:meta',
      is_active: updates.is_active !== undefined ? updates.is_active : (fullConfig?.is_active || false),
      updated_at: new Date().toISOString()
    };
    
    console.log('📤 Sending PUT request with full body:', requestBody);
    
    const response = await fetch(`${this.baseUrl}/user_workspace_config/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Update failed:', errorText);
      throw new Error(`Failed to update workspace config: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }

  async deleteConfig(authToken: string, id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/user_workspace_config/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete workspace config: ${response.status}`);
    }
  }
}

const workspaceConfigApiClient = new WorkspaceConfigApiClient();

export const useWorkspaceConfig = (): UseWorkspaceConfigReturn => {
  const { authToken, isAuthenticated, user } = useAuth();
  const [configs, setConfigs] = useState<WorkspaceConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the active configuration
  const activeConfig = configs.find(config => config.is_active) || null;

  const fetchConfigs = useCallback(async () => {
    if (!isAuthenticated || !authToken) {
      setConfigs([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const fetchedConfigs = await workspaceConfigApiClient.getConfigs(authToken, user);
      
      // Sort configs by created_at descending
      const sortedConfigs = fetchedConfigs.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setConfigs(sortedConfigs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch workspace configs');
      console.error('Error fetching workspace configs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, authToken, user?.id]);

  const createConfig = async (data: CreateWorkspaceConfigData): Promise<WorkspaceConfig | null> => {
    if (!isAuthenticated || !authToken) {
      setError('Authentication required to create workspace config');
      return null;
    }

    console.log('📝 useWorkspaceConfig createConfig called with:', {
      isAuthenticated,
      hasAuthToken: !!authToken,
      hasUser: !!user,
      userData: JSON.stringify(user, null, 2)
    });

    try {
      const newConfig = await workspaceConfigApiClient.createConfig(authToken, data, user);
      setConfigs(prev => [newConfig, ...prev]);
      return newConfig;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace config');
      console.error('Error creating workspace config:', err);
      return null;
    }
  };

  const updateConfig = async (id: string, updates: Partial<WorkspaceConfig>): Promise<void> => {
    if (!isAuthenticated || !authToken) {
      setError('Authentication required to update workspace config');
      return;
    }

    try {
      // Find the full config to pass all required fields
      const fullConfig = configs.find(c => c.id === id);
      if (!fullConfig) {
        throw new Error('Configuration not found');
      }
      
      const updatedConfig = await workspaceConfigApiClient.updateConfig(authToken, id, updates, user, fullConfig);
      setConfigs(prev => 
        prev.map(config => config.id === id ? updatedConfig : config)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update workspace config');
      console.error('Error updating workspace config:', err);
    }
  };

  const deleteConfig = async (id: string): Promise<void> => {
    if (!isAuthenticated || !authToken) {
      setError('Authentication required to delete workspace config');
      return;
    }

    try {
      await workspaceConfigApiClient.deleteConfig(authToken, id);
      setConfigs(prev => prev.filter(config => config.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete workspace config');
      console.error('Error deleting workspace config:', err);
    }
  };

  const setActiveConfig = async (id: string): Promise<void> => {
    if (!isAuthenticated || !authToken) {
      setError('Authentication required to set active workspace config');
      return;
    }

    console.log('🎯 setActiveConfig called with id:', id);

    // Check if the ID is undefined or invalid
    if (!id || id === 'undefined') {
      setError('Cannot set active config: Invalid configuration ID');
      console.error('❌ Attempted to set active config with undefined/invalid ID');
      return;
    }

    // Check if this config is already active
    const targetConfig = configs.find(c => c.id === id);
    if (!targetConfig) {
      setError('Cannot set active config: Configuration not found');
      return;
    }

    if (targetConfig.is_active) {
      console.log('🎯 Config already active, no changes needed');
      return;
    }

    console.log(`🔄 Switching active workspace: "${targetConfig.config_name}"`);

    try {
      // First, optimistically update the UI for better UX
      setConfigs(prev => prev.map(config => ({
        ...config,
        is_active: config.id === id
      })));

      // Get all currently active configs for deactivation
      const currentlyActiveConfigs = configs.filter(config => config.is_active && config.id !== id);
      
      console.log(`📝 Deactivating ${currentlyActiveConfigs.length} other configs`);

      // Deactivate all other configs first (enforce single active workspace)
      const deactivationPromises = currentlyActiveConfigs.map(async (config) => {
        console.log(`⭕ Deactivating: ${config.config_name}`);
        return workspaceConfigApiClient.updateConfig(
          authToken, 
          config.id, 
          { is_active: false }, 
          user, 
          config
        );
      });
      
      await Promise.all(deactivationPromises);

      // Set the selected config as active
      console.log(`✅ Activating: ${targetConfig.config_name}`);
      await workspaceConfigApiClient.updateConfig(
        authToken, 
        id, 
        { is_active: true }, 
        user, 
        targetConfig
      );
      
      console.log(`🎉 Successfully switched to workspace: ${targetConfig.config_name}`);
      
      // Clear any connection state to allow fresh connection attempt
      if (typeof window !== 'undefined' && (window as any).clearConnectionState) {
        (window as any).clearConnectionState();
      }

      // Clear any previous errors
      setError(null);
    } catch (err) {
      // Revert the optimistic update on error
      console.error('❌ Failed to set active workspace config, reverting changes');
      await fetchConfigs();
      setError(err instanceof Error ? err.message : 'Failed to set active workspace config');
      console.error('Error setting active workspace config:', err);
    }
  };

  // Fetch configs when authentication status changes
  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  return {
    configs,
    activeConfig,
    isLoading,
    error,
    fetchConfigs,
    createConfig,
    updateConfig,
    deleteConfig,
    setActiveConfig,
  };
};

export type { WorkspaceConfig, CreateWorkspaceConfigData };