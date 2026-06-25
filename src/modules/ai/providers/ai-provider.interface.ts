export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_calls?: AIToolCall[];
  tool_call_id?: string;
}

export interface AIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface AIChatResponse {
  message: AIMessage;
  finishReason: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AIProvider {
  chat(messages: AIMessage[]): Promise<AIChatResponse>;
  chatWithTools(messages: AIMessage[], tools: AIToolDefinition[]): Promise<AIChatResponse>;
}

export interface AIToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JSONSchemaDefinition;
  };
}

export interface JSONSchemaDefinition {
  type: 'object';
  properties: Record<string, unknown>;
  required: string[];
}