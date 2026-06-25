import { config } from '../../config/index.js';
import { toolRegistry } from '../tools/index.js';
import { logger } from '../../utils/logger.js';
import { SYSTEM_PROMPT } from './system-prompt.js';
import { getToolsForLLM } from './tool-converter.js';
import { GroqProvider } from './providers/groq.provider.js';
import { GeminiProvider } from './providers/gemini.provider.js';
import { MinimaxProvider } from './providers/minimax.provider.js';
import type { AIProvider, AIMessage, AIToolCall, AIToolDefinition } from './providers/index.js';

export interface ToolCallRecord {
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

export interface ChatResponse {
  response: string;
  provider: string;
  model: string;
  toolCalls: ToolCallRecord[];
}

export interface DebugInfo {
  toolsSent: AIToolDefinition[];
  groqFirstResponse: unknown;
  toolCallsReceived: ToolCallRecord[];
  toolResults: ToolCallRecord[];
  groqFinalResponse: unknown;
  iterations: number;
}

export class AIService {
  private provider: AIProvider;
  private maxIterations = 10;

  constructor() {
    this.provider = this.createProvider();
  }

  private createProvider(): AIProvider {
    const { AI_PROVIDER } = config;

    switch (AI_PROVIDER) {
      case 'groq':
        return new GroqProvider();
      case 'gemini':
        return new GeminiProvider();
      case 'minimax':
        return new MinimaxProvider();
      default:
        throw new Error(`Unknown AI provider: ${AI_PROVIDER}`);
    }
  }

  async chat(message: string, history: AIMessage[] = []): Promise<ChatResponse> {
    const start = Date.now();

    const messages: AIMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: message },
    ];

    const tools = getToolsForLLM();
    const executedTools: ToolCallRecord[] = [];

    logger.info({
      message,
      historyLength: history.length,
      provider: config.AI_PROVIDER,
      model: config.GROQ_MODEL,
      toolsCount: tools.length,
      toolNames: tools.map(t => t.function.name),
    }, 'AI chat started');

    for (let iteration = 0; iteration < this.maxIterations; iteration++) {
      logger.info({ iteration }, 'Sending request to AI provider');

      const response = await this.provider.chatWithTools(messages, tools);
      const choice = response.message;

      logger.info({
        iteration,
        responseContent: choice.content?.substring(0, 200),
        toolCalls: choice.tool_calls?.map(t => ({ name: t.function.name, args: t.function.arguments })),
        finishReason: response.finishReason,
      }, 'AI provider response');

      if (choice.tool_calls && choice.tool_calls.length > 0) {
        const toolCalls = choice.tool_calls;

        messages.push({
          role: 'assistant',
          content: choice.content || '',
          tool_calls: toolCalls,
        });

        for (const toolCall of toolCalls) {
          const record: ToolCallRecord = {
            name: toolCall.function.name,
            arguments: JSON.parse(toolCall.function.arguments),
          };

          try {
            const result = await this.executeTool(toolCall);
            record.result = result;
            executedTools.push(record);

            messages.push({
              role: 'tool',
              content: JSON.stringify(result),
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
            });
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            record.error = errorMessage;
            executedTools.push(record);

            messages.push({
              role: 'tool',
              content: JSON.stringify({ error: errorMessage }),
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
            });
          }
        }

        continue;
      }

      const duration = Date.now() - start;

      logger.info({
        duration,
        tokensUsed: response.usage.totalTokens,
        iterations: iteration + 1,
        provider: config.AI_PROVIDER,
        model: config.GROQ_MODEL,
        executedTools,
      }, 'AI chat completed');

      return {
        response: choice.content || 'No pude generar una respuesta.',
        provider: config.AI_PROVIDER,
        model: config.GROQ_MODEL,
        toolCalls: executedTools,
      };
    }

    logger.warn({ iterations: this.maxIterations }, 'Max tool call iterations reached');
    return {
      response: 'La conversación se extendió demasiado. Por favor reformula tu pregunta.',
      provider: config.AI_PROVIDER,
      model: config.GROQ_MODEL,
      toolCalls: executedTools,
    };
  }

  async debug(message: string): Promise<DebugInfo> {
    const messages: AIMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: message },
    ];

    const tools = getToolsForLLM();
    const toolCallsReceived: ToolCallRecord[] = [];
    const toolResults: ToolCallRecord[] = [];

    logger.info({
      message,
      toolsCount: tools.length,
      toolNames: tools.map(t => t.function.name),
    }, 'DEBUG: Starting chat');

    // First call
    const firstResponse = await this.provider.chatWithTools(messages, tools);

    logger.info({
      responseContent: firstResponse.message.content?.substring(0, 300),
      toolCalls: firstResponse.message.tool_calls?.map(t => ({ name: t.function.name, args: t.function.arguments })),
    }, 'DEBUG: First Groq response');

    if (!firstResponse.message.tool_calls || firstResponse.message.tool_calls.length === 0) {
      return {
        toolsSent: tools,
        groqFirstResponse: firstResponse,
        toolCallsReceived: [],
        toolResults: [],
        groqFinalResponse: firstResponse,
        iterations: 1,
      };
    }

    const initialToolCalls = firstResponse.message.tool_calls;

    messages.push({
      role: 'assistant',
      content: firstResponse.message.content || '',
      tool_calls: initialToolCalls,
    });

    // Execute tools
    for (const toolCall of initialToolCalls) {
      const record: ToolCallRecord = {
        name: toolCall.function.name,
        arguments: JSON.parse(toolCall.function.arguments),
      };

      try {
        const result = await this.executeTool(toolCall);
        record.result = result;
        toolCallsReceived.push(record);
        toolResults.push(record);

        messages.push({
          role: 'tool',
          content: JSON.stringify(result),
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        record.error = errorMessage;
        toolCallsReceived.push(record);
        toolResults.push(record);

        messages.push({
          role: 'tool',
          content: JSON.stringify({ error: errorMessage }),
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
        });
      }
    }

    // Second call with tool results
    const finalResponse = await this.provider.chatWithTools(messages, tools);

    logger.info({
      finalContent: finalResponse.message.content?.substring(0, 300),
      finalToolCalls: finalResponse.message.tool_calls,
    }, 'DEBUG: Final Groq response');

    return {
      toolsSent: tools,
      groqFirstResponse: firstResponse,
      toolCallsReceived,
      toolResults,
      groqFinalResponse: finalResponse,
      iterations: 2,
    };
  }

  private async executeTool(toolCall: AIToolCall): Promise<unknown> {
    const { name, arguments: argsJson } = toolCall.function;
    const start = Date.now();

    logger.info({ tool: name, args: argsJson }, 'Executing tool');

    try {
      const tool = toolRegistry.get(name);
      if (!tool) {
        throw new Error(`Tool '${name}' not found`);
      }

      const args = JSON.parse(argsJson) as Record<string, unknown>;
      const result = await tool.execute(args);

      logger.info({ tool: name, duration: Date.now() - start, result }, 'Tool executed successfully');
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error({ tool: name, duration: Date.now() - start, error: errorMessage }, 'Tool execution failed');
      return { error: errorMessage };
    }
  }
}
