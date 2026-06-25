import type { AIProvider, AIChatResponse, AIMessage, AIToolDefinition } from './ai-provider.interface.js';

/**
 * Placeholder for Gemini provider.
 * TODO: Implement when needed.
 */
export class GeminiProvider implements AIProvider {
  async chat(_messages: AIMessage[]): Promise<AIChatResponse> {
    throw new Error('Gemini provider not yet implemented');
  }

  async chatWithTools(_messages: AIMessage[], _tools: AIToolDefinition[]): Promise<AIChatResponse> {
    throw new Error('Gemini provider not yet implemented');
  }
}
