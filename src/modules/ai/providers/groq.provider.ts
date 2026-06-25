import { config } from '../../../config/index.js';
import { logger } from '../../../utils/logger.js';
import type {
  AIProvider,
  AIChatResponse,
  AIMessage,
  AIToolDefinition,
} from './ai-provider.interface.js';

export class GroqProvider implements AIProvider {
  private baseUrl = 'https://api.groq.com/openai/v1';
  private model: string;
  private apiKey: string;

  constructor() {
    this.model = config.GROQ_MODEL;
    this.apiKey = config.GROQ_API_KEY;
  }

  async chat(messages: AIMessage[]): Promise<AIChatResponse> {
    return this.request(messages, undefined);
  }

  async chatWithTools(messages: AIMessage[], tools: AIToolDefinition[]): Promise<AIChatResponse> {
    return this.request(messages, tools);
  }

  private async request(messages: AIMessage[], tools?: AIToolDefinition[]): Promise<AIChatResponse> {
    const url = `${this.baseUrl}/chat/completions`;
    const start = Date.now();

    const body: Record<string, unknown> = {
      model: this.model,
      messages,
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    logger.info({
      provider: 'groq',
      model: this.model,
      messageCount: messages.length,
      hasTools: !!tools,
      toolsCount: tools?.length ?? 0,
      toolNames: tools?.map(t => t.function.name) ?? [],
      requestBody: JSON.stringify(body, null, 2),
    }, 'Groq API request');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({ status: response.status, error: errorText }, 'Groq API error');
        throw new Error(`Groq API error: ${response.status}`);
      }

      const data = await response.json() as GroqResponse;
      const duration = Date.now() - start;

      const choice = data.choices[0];
      const msg = choice.message;

      logger.info({
        provider: 'groq',
        model: this.model,
        duration,
        tokens: data.usage,
        finishReason: choice.finish_reason,
        responseContent: msg.content?.substring(0, 200),
        toolCalls: msg.tool_calls?.map(t => ({ name: t.function.name, args: t.function.arguments })),
      }, 'Groq API response');

      return mapGroqResponse(data);
    } catch (err) {
      const duration = Date.now() - start;
      logger.error({ err, duration }, 'Groq request failed');
      throw err;
    }
  }
}

interface GroqResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

function mapGroqResponse(data: GroqResponse): AIChatResponse {
  const choice = data.choices[0];
  const msg = choice.message;

  return {
    message: {
      role: msg.role as AIMessage['role'],
      content: msg.content || '',
      tool_calls: msg.tool_calls?.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      })),
    },
    finishReason: choice.finish_reason,
    usage: {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    },
  };
}
