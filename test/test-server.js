// test/test-server.js - Test script for Tos MCP Server
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

// Test credentials (replace with actual values)
const TEST_CREDENTIALS = {
  xano_token: 'eyJhbGciOiJSUzI1NiJ9.eyJ4YW5vIjp7ImRibyI6Im1hc3Rlcjp1c2VyIiwiaWQiOjIxNzc0LCJhY2Nlc3NfdG9rZW4iOnsia2V5aWQiOiI3ZmQyMTMwYy1mNmFlLTQ2OGMtYWRlMS03NGFkZTVhNTY5NzYiLCJzY29wZSI6eyJ0ZW5hbnRfY2VudGVyOmJhY2t1cCI6MCwidGVuYW50X2NlbnRlcjpkZXBsb3kiOjAsInRlbmFudF9jZW50ZXI6aW1wZXJzb25hdGUiOjAsInRlbmFudF9jZW50ZXI6bG9nIjowLCJ0ZW5hbnRfY2VudGVyOnJiYWMiOjAsInRlbmFudF9jZW50ZXI6c2VjcmV0cyI6MCwidGVuYW50X2NlbnRlciI6MCwid29ya3NwYWNlOmFkZG9uIjoxNSwid29ya3NwYWNlOmFwaSI6MTUsIndvcmtzcGFjZTpjb250ZW50IjoxNSwid29ya3NwYWNlOmRhdGFiYXNlIjoxNSwid29ya3NwYWNlOmRhdGFzb3VyY2U6bGl2ZSI6MTUsIndvcmtzcGFjZTpmaWxlIjoxNSwid29ya3NwYWNlOmZ1bmN0aW9uIjoxNSwid29ya3NwYWNlOmxvZyI6MTUsIndvcmtzcGFjZTptaWRkbGV3YXJlIjoxNSwid29ya3NwYWNlOnJlcXVlc3RoaXN0b3J5IjoxNSwid29ya3NwYWNlOnRhc2siOjE1LCJ3b3Jrc3BhY2U6dG9vbCI6MTV9fX0sImlhdCI6MTc1MDI2MzQzMSwibmJmIjoxNzUwMjYzNDMxLCJhdWQiOiJ4YW5vOm1ldGEifQ.beKC7ioY6x8el8sz0pxHiMSFHyVm_CKuHLiuS7ayImTHtYhVuEQJNcwVskUDcN3knZzUDd8DGbyt6u6vPWiJxcD9GPdg5IdalXk9w6oC2V1Dd3x9iAtSDEi8R_Tq7qS4bEDueyweDtuIIb2WVXc2gQT7UAMbgoVT75gkSuWtAPMpLMkSky1K1eSMDWgjTPl_A_mVndKWL3hw3suAYjsQHjQv06BmpaLuLFp9vSkJ-j1ap7Zo9YL_T4j88r8DbNWuHO_Yvh8xCWdYwrhNFsSeY6PlRCqSqS4Zx2rDO7M1LAeKGct3YVWrOoQgR3_wlefl0NWoLwOos26hkalhHxBGSx3QlDWsysfiRRAMHzfs0Eqi6re3Gey4-btsmggQe5o_0KtAgsghgrxSjlPK01clGMvgM1vX4d6_cAOkcbVIc8iT13qnyUU5Y33qfL4FIQq8pkOkq7Bu5pSHmzCbK99Fvo7cNoblcF_gneO9rVquP58mNKONcHFbkmKXYFEcRt5LRiEVM2IQYGxe7HH05Iag-AiQd7KaEd4mU3eih4MqB1wv97rBU-RDprYw16-FgETcKb2G7qBV-Z09vyJG-e8Ysssv9yHcnWajHCFbq1w9DX6T5SsR0cSzbyFiAZDF_2ZFG0-v8L_3GOrqmO0YYzbsfd87Zk3A-lPP85YrYWJJtmE',
  workspace_id: 7,
  instance_domain: 'https://xddi-xkfe-xo94.autosnap.xano.io'
};

class TosTester {
  constructor() {
    this.sessionId = null;
  }

  async runTests() {
    console.log('🧪 Starting Tos MCP Server Tests\n');
    
    try {
      await this.testHealthCheck();
      await this.testSessionCreation();
      await this.testListTables();
      await this.testGetTableSchema();
      await this.testBrowseApiGroups();
      await this.testGenerateXanoScript();
      
      console.log('\n✅ All tests passed!');
    } catch (error) {
      console.error('\n❌ Test failed:', error.message);
      process.exit(1);
    }
  }

  async testHealthCheck() {
    console.log('Testing health check...');
    
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    
    if (!response.ok || data.status !== 'healthy') {
      throw new Error('Health check failed');
    }
    
    console.log('✅ Health check passed');
  }

  async testSessionCreation() {
    console.log('Testing session creation...');
    
    const response = await fetch(`${BASE_URL}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_CREDENTIALS)
    });
    
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      throw new Error(`Session creation failed: ${data.error}`);
    }
    
    this.sessionId = data.session_id;
    console.log(`✅ Session created: ${this.sessionId}`);
    console.log(`   User info:`, data.user_info);
  }

  async testListTables() {
    console.log('Testing list tables...');
    
    const result = await this.callMCPTool('list_workspace_tables', {
      page: 1,
      per_page: 10
    });
    
    if (!result.success) {
      throw new Error(`List tables failed: ${result.error}`);
    }
    
    console.log(`✅ Found ${result.tables.length} tables`);
    if (result.tables.length > 0) {
      console.log(`   First table: ${result.tables[0].name} (ID: ${result.tables[0].id})`);
    }
  }

  async testGetTableSchema() {
    console.log('Testing get table schema...');
    
    // First get a table to test with
    const tablesResult = await this.callMCPTool('list_workspace_tables', { per_page: 1 });
    
    if (!tablesResult.success || tablesResult.tables.length === 0) {
      console.log('⚠️  No tables found, skipping schema test');
      return;
    }
    
    const testTable = tablesResult.tables[0];
    
    const result = await this.callMCPTool('get_table_schema', {
      table_id: testTable.id
    });
    
    if (!result.success) {
      throw new Error(`Get table schema failed: ${result.error}`);
    }
    
    console.log(`✅ Got schema for table: ${result.table_name}`);
    console.log(`   Fields: ${result.fields.length}`);
  }

  async testBrowseApiGroups() {
    console.log('Testing browse API groups...');
    
    const result = await this.callMCPTool('browse_api_groups', {
      page: 1,
      per_page: 10
    });
    
    if (!result.success) {
      throw new Error(`Browse API groups failed: ${result.error}`);
    }
    
    console.log(`✅ Found ${result.api_groups.length} API groups`);
    if (result.api_groups.length > 0) {
      console.log(`   First group: ${result.api_groups[0].name} (ID: ${result.api_groups[0].id})`);
    }
  }

  async testGenerateXanoScript() {
    console.log('Testing XanoScript generation...');
    
    const result = await this.callMCPTool('generate_xanoscript', {
      type: 'table',
      description: 'Create a simple user profile table with name, email, and creation timestamp',
      context: {
        table_name: 'user_profiles'
      }
    });
    
    if (!result.success) {
      throw new Error(`XanoScript generation failed: ${result.error}`);
    }
    
    console.log('✅ XanoScript generated successfully');
    console.log('   Script length:', result.script.length);
    console.log('   Validation:', result.validation.valid ? 'PASSED' : 'FAILED');
    
    if (!result.validation.valid) {
      console.log('   Validation errors:', result.validation.errors);
    }
  }

  async callMCPTool(toolName, params) {
    if (!this.sessionId) {
      throw new Error('No session ID available');
    }

    const response = await fetch(`${BASE_URL}/mcp/tools/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        params: {
          name: toolName,
          arguments: params
        }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`MCP tool call failed: ${response.status} ${response.statusText}`);
    }
    
    if (data.error) {
      throw new Error(`MCP tool error: ${data.error.message}`);
    }
    
    return JSON.parse(data.result.content[0].text);
  }
}

// Run tests
const tester = new TosTester();
tester.runTests().catch(console.error);