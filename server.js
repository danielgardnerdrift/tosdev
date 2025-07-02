// server.js - Tos MCP Server
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { XanoApiService } from './services/xano-api.js';
import { XanoScriptService } from './services/xanoscript-service.js';
import { SessionService } from './services/session.js';

// Load environment variables
dotenv.config();

class TosMCPServer {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3001;
    
    // Initialize services
    this.xanoApiService = new XanoApiService();
    this.xanoScriptService = new XanoScriptService();
    this.sessionService = new SessionService();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    // Security
    this.app.use(helmet({
      contentSecurityPolicy: false, // Disable for SSE
      crossOriginEmbedderPolicy: false
    }));

    // CORS
this.app.use(cors({
  origin: [
    'https://tos-chat.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173', // ← Add this line for your React app
    'http://localhost:5678', // N8N
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id']
}));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // requests per window
      message: { error: 'Too many requests, please try again later.' },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use(limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy',
        app: 'Tos MCP Server',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // Session management
    this.app.post('/api/session', async (req, res) => {
      try {
        const { xano_token, workspace_id, instance_domain } = req.body;
        
        if (!xano_token || !workspace_id || !instance_domain) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: xano_token, workspace_id, instance_domain'
          });
        }

        // Validate credentials against user's Xano instance
        const validation = await this.xanoApiService.validateCredentials({
          xano_token,
          workspace_id: parseInt(workspace_id),
          instance_domain: instance_domain.replace(/\/$/, '') // Remove trailing slash
        });
        
        if (!validation.success) {
          return res.status(401).json(validation);
        }

        // Create session
        const sessionData = {
          xano_token,
          workspace_id: parseInt(workspace_id),
          instance_domain: instance_domain.replace(/\/$/, ''),
          user_info: validation.user_info
        };

        const session = this.sessionService.createSession(sessionData);

        res.json({
          success: true,
          session_id: session.session_id,
          user_info: validation.user_info
        });

      } catch (error) {
        console.error('Session creation error:', error);
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });

    // MCP SSE endpoint for N8N - modified authentication
    this.app.get('/mcp/sse', (req, res) => {
      // Check multiple places for session ID
      const sessionId = req.query.session_id || 
                       req.headers.authorization?.replace('Bearer ', '') || 
                       req.headers['x-session-id'];
      
      console.log('SSE connection attempt:', {
        query_session: req.query.session_id,
        auth_header: req.headers.authorization,
        x_session_header: req.headers['x-session-id'],
        final_session_id: sessionId
      });
      
      // Debug: List all current sessions
      console.log('Available sessions:', this.sessionService.listSessions());
      
      if (!sessionId) {
        console.log('SSE: No session ID found');
        return res.status(401).json({ error: 'Session ID required' });
      }

      const session = this.sessionService.getSession(sessionId);
      if (!session) {
        console.log('SSE: Invalid session:', sessionId);
        return res.status(401).json({ error: 'Invalid or expired session' });
      }

      console.log('SSE: Valid session found for:', sessionId);

      // Store session for this request
      req.session = session;
      req.sessionId = sessionId;

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control, Authorization, x-session-id'
      });

      // Send MCP initialization
      this.sendMCPMessage(res, {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: { 
            tools: {},
            prompts: {},
            resources: {}
          },
          serverInfo: {
            name: 'tos-mcp-server',
            version: '1.0.0'
          }
        }
      });

      // Keep connection alive
      const keepAlive = setInterval(() => {
        this.sendMCPMessage(res, { type: 'ping' });
      }, 30000);

      req.on('close', () => {
        clearInterval(keepAlive);
        console.log('N8N MCP client disconnected');
      });
    });

    // MCP tools list
    this.app.post('/mcp/tools/list', this.authenticateSession.bind(this), (req, res) => {
      res.json({
        jsonrpc: '2.0',
        id: req.body.id,
        result: { 
          tools: this.getAvailableTools() 
        }
      });
    });

    // MCP tool execution
    this.app.post('/mcp/tools/call', this.authenticateSession.bind(this), async (req, res) => {
      try {
        const { name, arguments: params } = req.body.params;
        const session = req.session;
        
        console.log(`Executing tool: ${name}`, params);
        
        const result = await this.executeTool(name, params, session);
        
        res.json({
          jsonrpc: '2.0',
          id: req.body.id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          }
        });
      } catch (error) {
        console.error('Tool execution error:', error);
        res.json({
          jsonrpc: '2.0',
          id: req.body.id,
          error: {
            code: -32603,
            message: error.message
          }
        });
      }
    });

    // Debug endpoints (development only)
    if (process.env.NODE_ENV !== 'production') {
      this.app.get('/debug/sessions', (req, res) => {
        res.json({
          total_sessions: this.sessionService.getSessionCount(),
          sessions: this.sessionService.getAllSessionIds()
        });
      });
    }
  }

  async authenticateSession(req, res, next) {
    try {
      const sessionId = req.headers.authorization?.replace('Bearer ', '') || 
                       req.headers['x-session-id'];
      
      if (!sessionId) {
        return res.status(401).json({ error: 'Session ID required' });
      }

      const session = this.sessionService.getSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: 'Invalid or expired session' });
      }

      // Update last accessed
      this.sessionService.updateLastAccessed(sessionId);

      req.session = session;
      req.sessionId = sessionId;
      next();
    } catch (error) {
      console.error('Authentication error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  }

  getAvailableTools() {
    return [
      {
        name: 'list_workspace_tables',
        description: 'List all tables in the Xano workspace',
        inputSchema: {
          type: 'object',
          properties: {
            page: { type: 'integer', default: 1, minimum: 1 },
            per_page: { type: 'integer', default: 50, minimum: 1, maximum: 100 }
          }
        }
      },
      {
        name: 'get_table_schema',
        description: 'Get detailed schema for a specific table by ID or name',
        inputSchema: {
          type: 'object',
          properties: {
            table_id: { type: 'integer', description: 'Table ID (preferred)' },
            table_name: { type: 'string', description: 'Table name (fallback)' }
          },
          anyOf: [
            { required: ['table_id'] },
            { required: ['table_name'] }
          ]
        }
      },
      {
        name: 'browse_api_groups',
        description: 'List all API groups in the workspace',
        inputSchema: {
          type: 'object',
          properties: {
            page: { type: 'integer', default: 1, minimum: 1 },
            per_page: { type: 'integer', default: 50, minimum: 1, maximum: 100 }
          }
        }
      },
      {
        name: 'create_table',
        description: 'Create a new table with generated XanoScript',
        inputSchema: {
          type: 'object',
          properties: {
            table_name: { type: 'string', pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$' },
            description: { type: 'string', minLength: 10 },
            fields: { 
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string' },
                  required: { type: 'boolean', default: false },
                  description: { type: 'string' }
                },
                required: ['name', 'type']
              }
            }
          },
          required: ['table_name', 'description']
        }
      },
      {
        name: 'create_api_endpoint',
        description: 'Create a new API endpoint with generated XanoScript',
        inputSchema: {
          type: 'object',
          properties: {
            endpoint_name: { type: 'string', pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$' },
            verb: { 
              type: 'string', 
              enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
              default: 'GET'
            },
            api_group_id: { type: 'integer', minimum: 1 },
            description: { type: 'string', minLength: 10 }
          },
          required: ['endpoint_name', 'verb', 'description']
        }
      },
      {
        name: 'generate_xanoscript',
        description: 'Generate XanoScript code for tables, queries, or functions',
        inputSchema: {
          type: 'object',
          properties: {
            type: { 
              type: 'string', 
              enum: ['table', 'query', 'function'],
              description: 'Type of XanoScript to generate'
            },
            description: { 
              type: 'string', 
              minLength: 10,
              description: 'Detailed description of what to generate'
            },
            context: { 
              type: 'object',
              description: 'Additional context like table name, fields, etc.'
            }
          },
          required: ['type', 'description']
        }
      },
      {
        name: 'get_workspace_function',
        description: 'Get custom function details including XanoScript logic',
        inputSchema: {
          type: 'object',
          properties: {
            function_id: { type: 'integer', minimum: 1, description: 'Function ID' },
            include_draft: { type: 'boolean', default: false, description: 'Include draft version' },
            type: { type: 'string', enum: ['xs', 'json', 'yaml'], default: 'xs', description: 'Response format' }
          },
          required: ['function_id']
        }
      },
      {
        name: 'list_workspace_functions',
        description: 'List all custom functions in workspace',
        inputSchema: {
          type: 'object',
          properties: {
            page: { type: 'integer', default: 1, minimum: 1 },
            per_page: { type: 'integer', default: 50, minimum: 1, maximum: 100 }
          }
        }
      },
      {
        name: 'get_api_endpoint_logic',
        description: 'Get existing API endpoint XanoScript logic',
        inputSchema: {
          type: 'object',
          properties: {
            api_group_id: { type: 'integer', minimum: 1, description: 'API Group ID' },
            api_id: { type: 'integer', minimum: 1, description: 'API Endpoint ID' },
            include_draft: { type: 'boolean', default: false, description: 'Include draft version' },
            type: { type: 'string', enum: ['xs', 'json', 'yaml'], default: 'xs', description: 'Response format' }
          },
          required: ['api_group_id', 'api_id']
        }
      },
      {
        name: 'list_api_endpoints',
        description: 'List all endpoints in an API group',
        inputSchema: {
          type: 'object',
          properties: {
            api_group_id: { type: 'integer', minimum: 1, description: 'API Group ID' },
            page: { type: 'integer', default: 1, minimum: 1 },
            per_page: { type: 'integer', default: 50, minimum: 1, maximum: 100 }
          },
          required: ['api_group_id']
        }
      },
      {
        name: 'list_workspace_tasks',
        description: 'List all background tasks in workspace',
        inputSchema: {
          type: 'object',
          properties: {
            page: { type: 'integer', default: 1, minimum: 1 },
            per_page: { type: 'integer', default: 50, minimum: 1, maximum: 100 }
          }
        }
      },
      {
        name: 'get_task_logic',
        description: 'Get background task XanoScript logic',
        inputSchema: {
          type: 'object',
          properties: {
            task_id: { type: 'integer', minimum: 1, description: 'Task ID' },
            include_draft: { type: 'boolean', default: false, description: 'Include draft version' },
            type: { type: 'string', enum: ['xs', 'json', 'yaml'], default: 'xs', description: 'Response format' }
          },
          required: ['task_id']
        }
      },
      {
        name: 'create_workspace_function',
        description: 'Create new custom function with XanoScript',
        inputSchema: {
          type: 'object',
          properties: {
            function_name: { type: 'string', pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$', description: 'Function name' },
            script: { type: 'string', minLength: 10, description: 'XanoScript code' },
            description: { type: 'string', description: 'Function description' }
          },
          required: ['function_name', 'script']
        }
      }
    ];
  }

  async executeTool(toolName, params, session) {
    const { xano_token, workspace_id, instance_domain } = session;
    
    switch (toolName) {
      case 'list_workspace_tables':
        return await this.xanoApiService.listTables({
          xano_token, workspace_id, instance_domain, ...params
        });
        
      case 'get_table_schema':
        return await this.xanoApiService.getTableSchema({
          xano_token, workspace_id, instance_domain, ...params
        });
        
      case 'browse_api_groups':
        return await this.xanoApiService.browseApiGroups({
          xano_token, workspace_id, instance_domain, ...params
        });
        
      case 'create_table':
        return await this.createTableWithScript(params, session);
        
      case 'create_api_endpoint':
        const result = await this.createEndpointWithScript(params, session);
        console.log('🔍 Final create_api_endpoint result:', {
          success: result.success,
          has_script: !!result.script,
          script_length: result.script ? result.script.length : 0,
          deployment_success: result.deployment?.success,
          endpoint_id: result.endpoint_id
        });
        return result;
        
      case 'generate_xanoscript':
        return await this.xanoScriptService.generateScript(
          params.type, 
          params.description, 
          params.context || {}
        );
        
      case 'get_workspace_function':
        return await this.xanoApiService.getWorkspaceFunction({
          xano_token, workspace_id, instance_domain, ...params
        });
        
      case 'list_workspace_functions':
        return await this.xanoApiService.listWorkspaceFunctions({
          xano_token, workspace_id, instance_domain, ...params
        });
        
      case 'get_api_endpoint_logic':
        return await this.xanoApiService.getApiEndpointLogic({
          xano_token, workspace_id, instance_domain, ...params
        });
        
      case 'list_api_endpoints':
        return await this.xanoApiService.listApiEndpoints({
          xano_token, workspace_id, instance_domain, ...params
        });
        
      case 'list_workspace_tasks':
        return await this.xanoApiService.listWorkspaceTasks({
          xano_token, workspace_id, instance_domain, ...params
        });
        
      case 'get_task_logic':
        return await this.xanoApiService.getTaskLogic({
          xano_token, workspace_id, instance_domain, ...params
        });
        
      case 'create_workspace_function':
        return await this.createFunctionWithScript(params, session);
        
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  async createTableWithScript(params, session) {
    try {
      // Generate XanoScript for table
      const scriptResult = await this.xanoScriptService.generateScript(
        'table',
        params.description,
        {
          table_name: params.table_name,
          fields: params.fields,
          workspace_id: session.workspace_id
        }
      );
      
      if (!scriptResult.success) {
        return {
          success: false,
          error: `XanoScript generation failed: ${scriptResult.error}`
        };
      }

      // Deploy table to Xano
      const deployResult = await this.xanoApiService.createTable({
        xano_token: session.xano_token,
        workspace_id: session.workspace_id,
        instance_domain: session.instance_domain,
        table_name: params.table_name,
        script: scriptResult.script
      });

      return {
        success: deployResult.success,
        script: scriptResult.script,
        table_id: deployResult.table_id,
        deployment: deployResult,
        error: deployResult.error
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createEndpointWithScript(params, session) {
    try {
      // If api_group is provided instead of api_group_id, look it up
      let api_group_id = params.api_group_id;
      
      if (!api_group_id && params.api_group) {
        // Get API groups to find ID by name
        const groupsResult = await this.xanoApiService.browseApiGroups({
          xano_token: session.xano_token,
          workspace_id: session.workspace_id,
          instance_domain: session.instance_domain,
          per_page: 100
        });
        
        if (!groupsResult.success) {
          throw new Error('Failed to get API groups for name lookup');
        }
        
        const group = groupsResult.api_groups.find(g => 
          g.name === params.api_group || 
          g.name.toLowerCase() === params.api_group.toLowerCase()
        );
        
        if (!group) {
          throw new Error(`API group '${params.api_group}' not found`);
        }
        
        api_group_id = group.id;
        console.log(`Resolved API group '${params.api_group}' to ID ${api_group_id}`);
      }
      
      if (!api_group_id) {
        throw new Error('Either api_group_id or api_group is required');
      }
      
      // Generate XanoScript for endpoint
      const scriptResult = await this.xanoScriptService.generateScript(
        'query',
        params.description,
        {
          endpoint_name: params.endpoint_name,
          verb: params.verb,
          api_group_id: api_group_id,
          workspace_id: session.workspace_id
        }
      );
      
      if (!scriptResult.success) {
        return {
          success: false,
          error: `XanoScript generation failed: ${scriptResult.error}`
        };
      }
      
      console.log('✅ XanoScript generated successfully:', {
        script_length: scriptResult.script ? scriptResult.script.length : 0,
        script_preview: scriptResult.script ? scriptResult.script.substring(0, 200) + '...' : 'NO SCRIPT',
        has_script: !!scriptResult.script,
        validation: scriptResult.validation
      });

      // Deploy endpoint to Xano
      console.log('🚀 Deploying endpoint to Xano...');
      const deployResult = await this.xanoApiService.createApiEndpoint({
        xano_token: session.xano_token,
        workspace_id: session.workspace_id,
        instance_domain: session.instance_domain,
        endpoint_name: params.endpoint_name,
        verb: params.verb,
        api_group_id: api_group_id,
        script: scriptResult.script,
        description: params.description || `${params.verb} endpoint for ${params.endpoint_name}`
      });

      return {
        success: deployResult.success,
        script: scriptResult.script,
        endpoint_id: deployResult.endpoint_id,
        deployment: deployResult,
        error: deployResult.error,
        debug: {
          script_was_generated: !!scriptResult.script,
          script_length: scriptResult.script ? scriptResult.script.length : 0,
          script_first_100: scriptResult.script ? scriptResult.script.substring(0, 100) : 'NO SCRIPT',
          api_group_id_used: api_group_id,
          endpoint_name_used: params.endpoint_name
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createFunctionWithScript(params, session) {
    try {
      // For create_workspace_function, we can either generate a script or use the provided one
      let script = params.script;
      
      // If no script provided, we could generate one, but this tool expects a script parameter
      if (!script) {
        return {
          success: false,
          error: 'Script parameter is required for creating workspace functions'
        };
      }

      // Deploy function to Xano
      const deployResult = await this.xanoApiService.createWorkspaceFunction({
        xano_token: session.xano_token,
        workspace_id: session.workspace_id,
        instance_domain: session.instance_domain,
        function_name: params.function_name,
        script: script,
        description: params.description || `Custom function: ${params.function_name}`
      });

      return {
        success: deployResult.success,
        script: script,
        function_id: deployResult.function_id,
        deployment: deployResult,
        error: deployResult.error
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  sendMCPMessage(res, message) {
    try {
      res.write(`data: ${JSON.stringify(message)}\n\n`);
    } catch (error) {
      console.error('Error sending MCP message:', error);
    }
  }

  setupErrorHandling() {
    this.app.use((err, req, res, next) => {
      console.error('Unhandled error:', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString()
      });

      res.status(err.status || 500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' 
          ? 'Internal server error' 
          : err.message
      });
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      process.exit(1);
    });
  }

  start() {
    this.app.listen(this.port, () => {
      console.log(`🚀 Tos MCP Server running on port ${this.port}`);
      console.log(`🔧 Health check: http://localhost:${this.port}/health`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      
      if (process.env.NODE_ENV !== 'production') {
        console.log(`🐛 Debug endpoints available at /debug/*`);
      }
    });
  }
}

// Start server
const server = new TosMCPServer();
server.start();

export default TosMCPServer;