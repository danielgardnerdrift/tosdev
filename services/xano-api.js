// services/xano-api.js - Xano API Service
import fetch from 'node-fetch';

export class XanoApiService {
  constructor() {
    this.defaultTimeout = 30000; // 30 seconds
  }

  async validateCredentials({ xano_token, workspace_id, instance_domain }) {
    try {
      // Test connection by listing tables
      const response = await this.makeRequest({
        url: `https://api.autosnap.cloud/api:meta/workspace/${workspace_id}/table`,
        method: 'GET',
        token: xano_token,
        timeout: 10000 // Shorter timeout for validation
      });

      if (!response.ok) {
        return { 
          success: false, 
          error: `Invalid credentials: ${response.status} ${response.statusText}` 
        };
      }

      const tables = await response.json();
      
      return {
        success: true,
        user_info: {
          instance_domain,
          workspace_id,
          tables_count: tables.length,
          validated_at: new Date().toISOString()
        }
      };
    } catch (error) {
      return { 
        success: false, 
        error: `Credential validation failed: ${error.message}` 
      };
    }
  }

  async listTables({ xano_token, workspace_id, instance_domain, page = 1, per_page = 50 }) {
    try {
      const url = `https://api.autosnap.cloud/api:meta/workspace/${workspace_id}/table?page=${page}&per_page=${per_page}`;
      
      const response = await this.makeRequest({
        url,
        method: 'GET',
        token: xano_token
      });

      if (!response.ok) {
        throw new Error(`Failed to list tables: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        tables: Array.isArray(data) ? data : data.items || [],
        total: Array.isArray(data) ? data.length : data.total || 0,
        page,
        per_page
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getTableSchema({ xano_token, workspace_id, instance_domain, table_id, table_name }) {
    try {
      let url;
      
      if (table_id) {
        url = `https://api.autosnap.cloud/api:meta/workspace/${workspace_id}/table/${table_id}`;
      } else if (table_name) {
        // First get table list to find ID by name
        const tablesResult = await this.listTables({ 
          xano_token, workspace_id, instance_domain, per_page: 100 
        });
        
        if (!tablesResult.success) {
          throw new Error('Failed to get table list for name lookup');
        }
        
        const table = tablesResult.tables.find(t => 
          t.name === table_name || 
          t.name === `🗂️ ${table_name}` || // Handle emoji prefixes
          t.name.toLowerCase() === table_name.toLowerCase()
        );
        
        if (!table) {
          throw new Error(`Table '${table_name}' not found`);
        }
        
        url = `https://api.autosnap.cloud/api:meta/workspace/${workspace_id}/table/${table.id}`;
      } else {
        throw new Error('Either table_id or table_name is required');
      }

      const response = await this.makeRequest({
        url,
        method: 'GET',
        token: xano_token
      });

      if (!response.ok) {
        throw new Error(`Failed to get table schema: ${response.status} ${response.statusText}`);
      }

      const schema = await response.json();
      
      return {
        success: true,
        schema,
        table_id: schema.id,
        table_name: schema.name,
        fields: schema.schema || [],
        indexes: schema.index || []
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async browseApiGroups({ xano_token, workspace_id, instance_domain, page = 1, per_page = 50 }) {
    try {
      const url = `https://api.autosnap.cloud/api:meta/workspace/${workspace_id}/apigroup?page=${page}&per_page=${per_page}`;
      
      const response = await this.makeRequest({
        url,
        method: 'GET',
        token: xano_token
      });

      if (!response.ok) {
        throw new Error(`Failed to browse API groups: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        api_groups: Array.isArray(data) ? data : data.items || [],
        total: Array.isArray(data) ? data.length : data.total || 0,
        page,
        per_page
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createTable({ xano_token, workspace_id, instance_domain, table_name, script }) {
    try {
      // Use the beta endpoint path that works with XanoScript
      const url = `https://api.autosnap.cloud/api:meta/beta/workspace/${workspace_id}/table`;
      
      console.log('🔍 createTable called with:', {
        table_name,
        workspace_id,
        script_length: script ? script.length : 0,
        script_preview: script ? script.substring(0, 200) + '...' : 'NO SCRIPT PROVIDED',
        has_script: !!script
      });
      
      // Use the simplified request body structure that works
      const requestBody = {
        type: 'xs',
        script: script
      };
      
      console.log('📤 Sending to Xano API (beta endpoint):', JSON.stringify(requestBody, null, 2));
      
      const response = await this.makeRequest({
        url,
        method: 'POST',
        token: xano_token,
        body: requestBody
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create table: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      console.log('📥 Xano API Response:', {
        table_id: result.id,
        table_name: result.name,
        has_script_in_response: !!result.script,
        result_keys: Object.keys(result)
      });
      
      return {
        success: true,
        table_id: result.id,
        table_name: result.name,
        result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createApiEndpoint({ xano_token, workspace_id, instance_domain, endpoint_name, verb, api_group_id, script, description = '' }) {
    try {
      // Use the beta endpoint path that works with XanoScript
      const url = `https://api.autosnap.cloud/api:meta/beta/workspace/${workspace_id}/apigroup/${api_group_id}/api`;
      
      console.log('🔍 createApiEndpoint called with:', {
        endpoint_name,
        verb,
        api_group_id,
        description,
        script_length: script ? script.length : 0,
        script_preview: script ? script.substring(0, 200) + '...' : 'NO SCRIPT PROVIDED',
        has_script: !!script
      });
      
      // Use the simplified request body structure that works
      const requestBody = {
        type: 'xs',
        script: script
      };
      
      console.log('📤 Sending to Xano API (beta endpoint):', JSON.stringify(requestBody, null, 2));
      
      const response = await this.makeRequest({
        url,
        method: 'POST',
        token: xano_token,
        body: requestBody
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create API endpoint: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      console.log('📥 Xano API Response:', {
        endpoint_id: result.id,
        endpoint_name: result.name,
        has_script_in_response: !!result.script,
        result_keys: Object.keys(result)
      });
      
      return {
        success: true,
        endpoint_id: result.id,
        endpoint_name: result.name,
        verb: result.verb,
        api_group_id,
        result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getWorkspaceFunction({ xano_token, workspace_id, instance_domain, function_id, include_draft = false, type = 'xs' }) {
    try {
      const url = `https://api.autosnap.cloud/api:meta/beta/workspace/${workspace_id}/function/${function_id}?include_draft=${include_draft}&type=${type}`;
      
      const response = await this.makeRequest({
        url,
        method: 'GET',
        token: xano_token
      });

      if (!response.ok) {
        throw new Error(`Failed to get workspace function: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        function_id,
        function_data: data,
        script: data.script || null,
        name: data.name,
        description: data.description
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async listWorkspaceFunctions({ xano_token, workspace_id, instance_domain, page = 1, per_page = 50 }) {
    try {
      const url = `https://api.autosnap.cloud/api:meta/workspace/${workspace_id}/function?page=${page}&per_page=${per_page}`;
      
      const response = await this.makeRequest({
        url,
        method: 'GET',
        token: xano_token
      });

      if (!response.ok) {
        throw new Error(`Failed to list workspace functions: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        functions: Array.isArray(data) ? data : data.items || [],
        total: Array.isArray(data) ? data.length : data.total || 0,
        page,
        per_page
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getApiEndpointLogic({ xano_token, workspace_id, instance_domain, api_group_id, api_id, include_draft = false, type = 'xs' }) {
    try {
      const url = `https://api.autosnap.cloud/api:meta/beta/workspace/${workspace_id}/apigroup/${api_group_id}/api/${api_id}?include_draft=${include_draft}&type=${type}`;
      
      const response = await this.makeRequest({
        url,
        method: 'GET',
        token: xano_token
      });

      if (!response.ok) {
        throw new Error(`Failed to get API endpoint logic: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        api_id,
        api_group_id,
        endpoint_data: data,
        script: data.script || null,
        name: data.name,
        verb: data.verb,
        path: data.path
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async listApiEndpoints({ xano_token, workspace_id, instance_domain, api_group_id, page = 1, per_page = 50 }) {
    try {
      const url = `https://api.autosnap.cloud/api:meta/workspace/${workspace_id}/apigroup/${api_group_id}/api?page=${page}&per_page=${per_page}`;
      
      const response = await this.makeRequest({
        url,
        method: 'GET',
        token: xano_token
      });

      if (!response.ok) {
        throw new Error(`Failed to list API endpoints: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        endpoints: Array.isArray(data) ? data : data.items || [],
        total: Array.isArray(data) ? data.length : data.total || 0,
        api_group_id,
        page,
        per_page
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async listWorkspaceTasks({ xano_token, workspace_id, instance_domain, page = 1, per_page = 50 }) {
    try {
      const url = `https://api.autosnap.cloud/api:meta/workspace/${workspace_id}/task?page=${page}&per_page=${per_page}`;
      
      const response = await this.makeRequest({
        url,
        method: 'GET',
        token: xano_token
      });

      if (!response.ok) {
        throw new Error(`Failed to list workspace tasks: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        tasks: Array.isArray(data) ? data : data.items || [],
        total: Array.isArray(data) ? data.length : data.total || 0,
        page,
        per_page
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getTaskLogic({ xano_token, workspace_id, instance_domain, task_id, include_draft = false, type = 'xs' }) {
    try {
      const url = `https://api.autosnap.cloud/api:meta/beta/workspace/${workspace_id}/task/${task_id}?include_draft=${include_draft}&type=${type}`;
      
      const response = await this.makeRequest({
        url,
        method: 'GET',
        token: xano_token
      });

      if (!response.ok) {
        throw new Error(`Failed to get task logic: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        task_id,
        task_data: data,
        script: data.script || null,
        name: data.name,
        schedule: data.schedule
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createWorkspaceFunction({ xano_token, workspace_id, instance_domain, function_name, script, description = '' }) {
    try {
      // Use the beta endpoint path that works with XanoScript
      const url = `https://api.autosnap.cloud/api:meta/beta/workspace/${workspace_id}/function`;
      
      console.log('🔍 createWorkspaceFunction called with:', {
        function_name,
        workspace_id,
        script_length: script ? script.length : 0,
        script_preview: script ? script.substring(0, 200) + '...' : 'NO SCRIPT PROVIDED',
        has_script: !!script
      });
      
      // Use the simplified request body structure that works
      const requestBody = {
        type: 'xs',
        script: script
      };
      
      console.log('📤 Sending to Xano API (beta endpoint):', JSON.stringify(requestBody, null, 2));
      
      const response = await this.makeRequest({
        url,
        method: 'POST',
        token: xano_token,
        body: requestBody
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create workspace function: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      console.log('📥 Xano API Response:', {
        function_id: result.id,
        function_name: result.name,
        has_script_in_response: !!result.script,
        result_keys: Object.keys(result)
      });
      
      return {
        success: true,
        function_id: result.id,
        function_name: result.name,
        result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async makeRequest({ url, method = 'GET', token, body = null, timeout = null }) {
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Tos-MCP-Server/1.0.0'
      },
      timeout: timeout || this.defaultTimeout
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout || this.defaultTimeout}ms`);
      }
      throw error;
    }
  }
}