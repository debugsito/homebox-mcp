import { config } from '../../../config/index.js';
import { logger } from '../../../utils/logger.js';
import type {
  AIProvider,
  AIChatResponse,
  AIMessage,
  AIToolDefinition,
} from './ai-provider.interface.js';

const MAX_INTENTOS = 4;
const BACKOFF_BASE_MS = 1_000;
/** 503 = saturacion del tier gratuito, 429 = cuota, 500 = fallo transitorio. */
const REINTENTABLES = new Set([429, 500, 503]);

/** Una imagen para analizar: bytes en base64 y su tipo MIME. */
export interface ImagePart {
  data: string;
  mimeType: string;
}

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GeminiResponse {
  candidates?: {
    content?: GeminiContent;
    finishReason?: string;
  }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

/**
 * Gemini no usa el formato de OpenAI: los mensajes son `contents` con roles
 * user/model, el system prompt va aparte en `systemInstruction`, y los
 * resultados de tool viajan como functionResponse dentro de un turno de user.
 */
export class GeminiProvider implements AIProvider {
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  private model: string;
  private apiKey: string;

  constructor() {
    this.model = config.GEMINI_MODEL;
    this.apiKey = config.GEMINI_API_KEY ?? '';
  }

  async chat(messages: AIMessage[]): Promise<AIChatResponse> {
    return this.request(messages, undefined);
  }

  async chatWithTools(messages: AIMessage[], tools: AIToolDefinition[]): Promise<AIChatResponse> {
    return this.request(messages, tools);
  }

  /**
   * Analiza imágenes y devuelve el texto del modelo. Es la entrada de la carga
   * por fotos: describir qué se ve para proponer nombre y ubicación.
   */
  async describeImages(prompt: string, images: ImagePart[]): Promise<string> {
    const parts: GeminiPart[] = [
      { text: prompt },
      ...images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
    ];

    const data = await this.post({ contents: [{ role: 'user', parts }] });
    return this.textOf(data);
  }

  private async request(
    messages: AIMessage[],
    tools?: AIToolDefinition[]
  ): Promise<AIChatResponse> {
    const system = messages.find((m) => m.role === 'system');
    const body: Record<string, unknown> = {
      contents: toGeminiContents(messages.filter((m) => m.role !== 'system')),
    };

    if (system) {
      body.systemInstruction = { parts: [{ text: system.content }] };
    }

    if (tools?.length) {
      body.tools = [
        {
          functionDeclarations: tools.map((t) => ({
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters,
          })),
        },
      ];
    }

    const data = await this.post(body);
    return mapGeminiResponse(data, this.textOf(data));
  }

  private async post(body: Record<string, unknown>): Promise<GeminiResponse> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY no está configurada');
    }

    const start = Date.now();
    const url = `${this.baseUrl}/models/${this.model}:generateContent`;
    let ultimoEstado = 0;

    for (let intento = 0; intento < MAX_INTENTOS; intento++) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = (await response.json()) as GeminiResponse;
        logger.debug(
          { model: this.model, duration: Date.now() - start, intento: intento + 1 },
          'Gemini API response'
        );
        return data;
      }

      ultimoEstado = response.status;
      const errorText = await response.text();

      if (!REINTENTABLES.has(response.status) || intento === MAX_INTENTOS - 1) {
        logger.error({ status: response.status, error: errorText }, 'Gemini API error');
        throw new Error(`Gemini API error: ${response.status}`);
      }

      // El tier gratuito devuelve 503 por saturación y 429 por cuota; ambos
      // suelen resolverse esperando un poco.
      const espera = BACKOFF_BASE_MS * 2 ** intento;
      logger.warn(
        { status: response.status, intento: intento + 1, espera },
        'Gemini saturado, reintentando'
      );
      await new Promise((resolve) => setTimeout(resolve, espera));
    }

    throw new Error(`Gemini API error: ${ultimoEstado}`);
  }

  private textOf(data: GeminiResponse): string {
    return (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('')
      .trim();
  }
}

export function toGeminiContents(messages: AIMessage[]): GeminiContent[] {
  return messages.map((message) => {
    if (message.role === 'tool') {
      return {
        role: 'user' as const,
        parts: [
          {
            functionResponse: {
              name: message.name ?? 'unknown',
              response: safeParse(message.content),
            },
          },
        ],
      };
    }

    if (message.role === 'assistant' && message.tool_calls?.length) {
      return {
        role: 'model' as const,
        parts: message.tool_calls.map((call) => ({
          functionCall: {
            name: call.function.name,
            args: safeParse(call.function.arguments),
          },
        })),
      };
    }

    return {
      role: message.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: message.content }],
    };
  });
}

function safeParse(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : { value: parsed };
  } catch {
    return { value: raw };
  }
}

function mapGeminiResponse(data: GeminiResponse, text: string): AIChatResponse {
  const candidate = data.candidates?.[0];
  const calls = (candidate?.content?.parts ?? [])
    .filter((p): p is GeminiPart & { functionCall: NonNullable<GeminiPart['functionCall']> } =>
      Boolean(p.functionCall)
    )
    .map((p, index) => ({
      // Gemini no devuelve id de llamada; el loop de tools necesita uno.
      id: `gemini-${index}-${p.functionCall.name}`,
      type: 'function' as const,
      function: {
        name: p.functionCall.name,
        arguments: JSON.stringify(p.functionCall.args ?? {}),
      },
    }));

  return {
    message: {
      role: 'assistant',
      content: text,
      tool_calls: calls.length ? calls : undefined,
    },
    finishReason: candidate?.finishReason ?? 'stop',
    usage: {
      promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
      completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      totalTokens: data.usageMetadata?.totalTokenCount ?? 0,
    },
  };
}
