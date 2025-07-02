// services/xanoscript-service.js - XanoScript Generation Service
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class XanoScriptService {
  constructor() {
    this.claudeApiKey = process.env.CLAUDE_API_KEY;
    this.reference = null;
    this.loadReference();
    
    if (!this.claudeApiKey) {
      console.error('❌ WARNING: CLAUDE_API_KEY not found in environment variables');
    } else {
      console.log('✅ Claude API key loaded (length:', this.claudeApiKey.length + ')');
    }
  }

  loadReference() {
    try {
      const referenceFile = join(__dirname, '..', 'xanoscript-reference.txt');
      this.reference = readFileSync(referenceFile, 'utf8');
      console.log(`✅ XanoScript reference loaded: ${this.reference.length} characters`);
    } catch (error) {
      console.error('❌ Failed to load XanoScript reference:', error.message);
      this.reference = null;
    }
  }

  async generateScript(type, description, context = {}) {
    if (!this.claudeApiKey) {
      return {
        success: false,
        error: 'Claude API key not configured'
      };
    }

    if (!this.reference) {
      return {
        success: false,
        error: 'XanoScript reference not loaded'
      };
    }

    try {
      const systemPrompt = this.buildSystemPrompt(type);
      const userPrompt = this.buildUserPrompt(type, description, context);

      const response = await this.callClaude(systemPrompt, userPrompt);
      
      if (!response.success) {
        console.error('Claude API call failed:', response.error);
        return response;
      }

      console.log('Claude response length:', response.content?.length);
      console.log('First 200 chars:', response.content?.substring(0, 200));

      const script = this.extractScript(response.content);
      console.log('Extracted script length:', script?.length);
      console.log('Script preview:', script?.substring(0, 100));
      
      const validation = this.validateScript(script, type);

      return {
        success: validation.valid,
        script: script,
        validation: validation,
        metadata: {
          type,
          description,
          context,
          generated_at: new Date().toISOString()
        },
        error: validation.valid ? null : `Validation failed: ${validation.errors.join(', ')}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  buildSystemPrompt(type) {
    const basePrompt = `You are an expert XanoScript developer. Generate clean, production-ready XanoScript code.

COMPLETE XANOSCRIPT REFERENCE:
${this.reference}

CRITICAL RULES:
1. Always start tables with "int id" or "uuid id" 
2. Use correct field types: text, email, password, int, bool, timestamp, decimal
3. Use proper modifiers: ? (optional), ?=value (default), filters=trim|lower
4. API endpoints MUST have input{}, stack{}, response{} blocks
5. Follow exact syntax from the reference above

OUTPUT FORMAT: Return ONLY the XanoScript code, no explanations or markdown.`;

    const typeSpecific = {
      table: `
FOCUS: Generate a table definition with proper schema and indexes.
REQUIRED: Start with "table table_name {" and include schema{} block.`,
      
      query: `
FOCUS: Generate an API endpoint query with input, stack, and response blocks.
REQUIRED: Include "query name verb=METHOD {" with all three required blocks.`,
      
      function: `
FOCUS: Generate a reusable function with input, stack, and response blocks.
REQUIRED: Include "function name {" with all three required blocks.`
    };

    return basePrompt + (typeSpecific[type] || '');
  }

  buildUserPrompt(type, description, context) {
    let prompt = `Generate ${type} XanoScript for: ${description}\n\n`;

    if (Object.keys(context).length > 0) {
      prompt += `Context:\n`;
      
      if (context.table_name) {
        prompt += `- Table name: ${context.table_name}\n`;
      }
      
      if (context.endpoint_name) {
        prompt += `- Endpoint name: ${context.endpoint_name}\n`;
      }
      
      if (context.verb) {
        prompt += `- HTTP method: ${context.verb}\n`;
      }
      
      if (context.fields && context.fields.length > 0) {
        prompt += `- Fields needed:\n`;
        context.fields.forEach(field => {
          prompt += `  * ${field.name} (${field.type})${field.required ? ' - required' : ''}${field.description ? ' - ' + field.description : ''}\n`;
        });
      }
      
      if (context.workspace_id) {
        prompt += `- Workspace ID: ${context.workspace_id}\n`;
      }
    }

    prompt += `\nGenerate the complete ${type} XanoScript code following the reference syntax exactly.`;
    
    return prompt;
  }

  async callClaude(systemPrompt, userPrompt) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.claudeApiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2000,
          temperature: 0.1,
          system: [
            {
              type: 'text',
              text: systemPrompt,
              cache_control: { type: 'ephemeral' }
            }
          ],
          messages: [
            { 
              role: 'user', 
              content: userPrompt 
            }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Claude API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      // Log cache performance
      if (result.usage) {
        const { cache_creation_input_tokens, cache_read_input_tokens } = result.usage;
        console.log(`Claude cache: created=${cache_creation_input_tokens || 0}, read=${cache_read_input_tokens || 0}`);
      }

      return {
        success: true,
        content: result.content[0].text
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  extractScript(content) {
    // Remove markdown code blocks if present
    let script = content.replace(/```(?:xs|xanoscript)?\n?/g, '');
    
    // Remove any explanatory text before/after the script
    const lines = script.split('\n');
    let startIndex = 0;
    let endIndex = lines.length - 1;
    
    // Find the actual script start
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^(table|query|function)\s+\w+/)) {
        startIndex = i;
        break;
      }
    }
    
    // Find the script end (last closing brace)
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim() === '}') {
        endIndex = i;
        break;
      }
    }
    
    return lines.slice(startIndex, endIndex + 1).join('\n').trim();
  }

  validateScript(script, type) {
    const errors = [];
    
    if (!script || script.trim().length === 0) {
      errors.push('Script is empty');
      return { valid: false, errors };
    }

    // Type-specific validation
    switch (type) {
      case 'table':
        if (!script.includes('table ')) {
          errors.push('Missing table declaration');
        }
        if (!script.includes('schema {')) {
          errors.push('Missing schema block');
        }
        if (!script.includes('int id') && !script.includes('uuid id')) {
          errors.push('Missing required id field (int id or uuid id)');
        }
        break;
        
      case 'query':
        if (!script.includes('query ')) {
          errors.push('Missing query declaration');
        }
        if (!script.includes('input {')) {
          errors.push('Missing input block');
        }
        if (!script.includes('stack {')) {
          errors.push('Missing stack block');
        }
        if (!script.includes('response {')) {
          errors.push('Missing response block');
        }
        if (!script.includes('verb=')) {
          errors.push('Missing verb declaration');
        }
        break;
        
      case 'function':
        if (!script.includes('function ')) {
          errors.push('Missing function declaration');
        }
        if (!script.includes('input {')) {
          errors.push('Missing input block');
        }
        if (!script.includes('stack {')) {
          errors.push('Missing stack block');
        }
        if (!script.includes('response {')) {
          errors.push('Missing response block');
        }
        break;
    }

    // General syntax validation
    const openBraces = (script.match(/{/g) || []).length;
    const closeBraces = (script.match(/}/g) || []).length;
    
    if (openBraces !== closeBraces) {
      errors.push(`Mismatched braces: ${openBraces} opening, ${closeBraces} closing`);
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }
}