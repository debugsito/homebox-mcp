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
  /**
   * Gemini 3 devuelve una firma con cada llamada a funcion y exige que se le
   * devuelva en el turno siguiente. Los demas proveedores la ignoran.
   */
  thoughtSignature?: string;
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