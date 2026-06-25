import type { AIProvider, AIChatResponse, AIMessage, AIToolDefinition } from './ai-provider.interface.js';

/**
 * Placeholder for Minimax provider.
 * The existing MinimaxClient can be wrapped when needed.
 */
export class MinimaxProvider implements AIProvider {
  async chat(_messages: AIMessage[]): Promise<AIChatResponse> {
    throw new Error('Minimax provider not yet implemented');
  }

  async chatWithTools(_messages: AIMessage[], _tools: AIToolDefinition[]): Promise<AIChatResponse> {
    throw new Error('Minimax provider not yet implemented');
  }
}
