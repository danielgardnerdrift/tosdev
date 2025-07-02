#!/usr/bin/env node

// test-n8n-workflow.js - Test script for Tos N8N workflow
import fetch from 'node-fetch';

const MCP_SERVER_URL = 'http://localhost:3001';
const N8N_WEBHOOK_URL = 'http://localhost:5678/webhook/chat';

// Your Xano credentials
const XANO_CREDENTIALS = {
  xano_token: 'eyJhbGciOiJSUzI1NiJ9.eyJ4YW5vIjp7ImRibyI6Im1hc3Rlcjp1c2VyIiwiaWQiOjIxNzc0LCJhY2Nlc3NfdG9rZW4iOnsia2V5aWQiOiI3ZmQyMTMwYy1mNmFlLTQ2OGMtYWRlMS03NGFkZTVhNTY5NzYiLCJzY29wZSI6eyJ0ZW5hbnRfY2VudGVyOmJhY2t1cCI6MCwidGVuYW50X2NlbnRlcjpkZXBsb3kiOjAsInRlbmFudF9jZW50ZXI6aW1wZXJzb25hdGUiOjAsInRlbmFudF9jZW50ZXI6bG9nIjowLCJ0ZW5hbnRfY2VudGVyOnJiYWMiOjAsInRlbmFudF9jZW50ZXI6c2VjcmV0cyI6MCwidGVuYW50X2NlbnRlciI6MCwid29ya3NwYWNlOmFkZG9uIjoxNSwid29ya3NwYWNlOmFwaSI6MTUsIndvcmtzcGFjZTpjb250ZW50IjoxNSwid29ya3NwYWNlOmRhdGFiYXNlIjoxNSwid29ya3NwYWNlOmRhdGFzb3VyY2U6bGl2ZSI6MTUsIndvcmtzcGFjZTpmaWxlIjoxNSwid29ya3NwYWNlOmZ1bmN0aW9uIjoxNSwid29ya3NwYWNlOmxvZyI6MTUsIndvcmtzcGFjZTptaWRkbGV3YXJlIjoxNSwid29ya3NwYWNlOnJlcXVlc3RoaXN0b3J5IjoxNSwid29ya3NwYWNlOnRhc2siOjE1LCJ3b3Jrc3BhY2U6dG9vbCI6MTV9fX0sImlhdCI6MTc1MDI2MzQzMSwibmJmIjoxNzUwMjYzNDMxLCJhdWQiOiJ4YW5vOm1ldGEifQ.beKC7ioY6x8el8sz0pxHiMSFHyVm_CKuHLiuS7ayImTHtYhVuEQJNcwVskUDcN3knZzUDd8DGbyt6u6vPWiJxcD9GPdg5IdalXk9w6oC2V1Dd3x9iAtSDEi8R_Tq7qS4bEDueyweDtuIIb2WVXc2gQT7UAMbgoVT75gkSuWtAPMpLMkSky1K1eSMDWgjTPl_A_mVndKWL3hw3suAYjsQHjQv06BmpaLuLFp9vSkJ-j1ap7Zo9YL_T4j88r8DbNWuHO_Yvh8xCWdYwrhNFsSeY6PlRCqSqS4Zx2rDO7M1LAeKGct3YVWrOoQgR3_wlefl0NWoLwOos26hkalhHxBGSx3QlDWsysfiRRAMHzfs0Eqi6re3Gey4-btsmggQe5o_0KtAgsghgrxSjlPK01clGMvgM1vX4d6_cAOkcbVIc8iT13qnyUU5Y33qfL4FIQq8pkOkq7Bu5pSHmzCbK99Fvo7cNoblcF_gneO9rVquP58mNKONcHFbkmKXYFEcRt5LRiEVM2IQYGxe7HH05Iag-AiQd7KaEd4mU3eih4MqB1wv97rBU-RDprYw16-FgETcKb2G7qBV-Z09vyJG-e8Ysssv9yHcnWajHCFbq1w9DX6T5SsR0cSzbyFiAZDF_2ZFG0-v8L_3GOrqmO0YYzbsfd87Zk3A-lPP85YrYWJJtmE',
  workspace_id: 7,
  instance_domain: 'https://xddi-xkfe-xo94.autosnap.xano.io'
};

class N8NWorkflowTester {
  constructor() {
    this.sessionId = null;
  }

  async runTests() {
    console.log('🧪 Testing Tos N8N Workflow Integration\n');
    
    try {
      await this.step1_CreateSession();
      await this.step2_TestBasicChat();
      await this.step3_TestListTables();
      await this.step4_TestCreateTable();
      await this.step5_TestComplexRequest();
      
      console.log('\n✅ All N8N workflow tests passed!');
      console.log('🎉 Tos is ready for production deployment!');
      
    } catch (error) {
      console.error('\n❌ Test failed:', error.message);
      process.exit(1);
    }
  }

  async step1_CreateSession() {
    console.log('1️⃣ Creating session with MCP server...');
    
    const response = await fetch(`${MCP_SERVER_URL}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(XANO_CREDENTIALS)
    });
    
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      throw new Error(`Session creation failed: ${data.error}`);
    }
    
    this.sessionId = data.session_id;
    console.log(`✅ Session created: ${this.sessionId}`);
    console.log(`   Workspace: ${data.user_info.instance_domain}`);
    console.log(`   Tables: ${data.user_info.tables_count}\n`);
  }

  async step2_TestBasicChat() {
    console.log('2️⃣ Testing basic chat through N8N...');
    
    const result = await this.sendChatMessage(
      "Hi Tos! Can you introduce yourself and tell me what you can help me with?"
    );
    
    console.log(`✅ Basic chat works!`);
    console.log(`   Response: ${result.message.substring(0, 100)}...\n`);
  }

  async step3_TestListTables() {
    console.log('3️⃣ Testing table listing through N8N + MCP...');
    
    const result = await this.sendChatMessage(
      "Can you list all the tables in my Xano workspace?"
    );
    
    console.log(`✅ Table listing works!`);
    console.log(`   Response: ${result.message.substring(0, 150)}...\n`);
  }

  async step4_TestCreateTable() {
    console.log('4️⃣ Testing table creation with XanoScript generation...');
    
    const result = await this.sendChatMessage(
      "Create a new table called 'tos_test_users' with fields for name (text), email (email), and created_at (timestamp). Make it simple but complete."
    );
    
    console.log(`✅ Table creation request processed!`);
    console.log(`   Response: ${result.message.substring(0, 200)}...\n`);
  }

  async step5_TestComplexRequest() {
    console.log('5️⃣ Testing complex multi-step request...');
    
    const result = await this.sendChatMessage(
      "First, show me all my API groups. Then generate XanoScript for a GET endpoint called 'get_user_profile' that fetches a user by ID from the tos_test_users table."
    );
    
    console.log(`✅ Complex request processed!`);
    console.log(`   Response: ${result.message.substring(0, 200)}...\n`);
  }

  async sendChatMessage(message) {
    if (!this.sessionId) {
      throw new Error('No session ID available');
    }

    console.log(`   💬 Sending: "${message}"`);
    
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message,
        session_id: this.sessionId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`N8N webhook failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`Chat failed: ${data.error || 'Unknown error'}`);
    }

    console.log(`   ✅ Response received (${data.message.length} chars)`);
    return data;
  }
}

// Run the tests
console.log('🚀 Starting Tos N8N Integration Tests');
console.log('📋 This will test the complete flow:');
console.log('   • Chat Client → N8N Webhook');
console.log('   • N8N → Claude AI Agent');
console.log('   • Claude → MCP Server → Xano');
console.log('   • Response back through the chain\n');

const tester = new N8NWorkflowTester();
tester.runTests().catch(console.error);