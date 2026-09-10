import { describe, it, expect, vi, afterEach } from 'vitest';
import { toGeminiContents, GeminiProvider } from '../src/modules/ai/providers/gemini.provider.js';
import type { AIMessage } from '../src/modules/ai/providers/ai-provider.interface.js';

describe('toGeminiContents', () => {
  it('traduce assistant a model y deja user como user', () => {
    const out = toGeminiContents([
      { role: 'user', content: '¿dónde está el hdmi?' },
      { role: 'assistant', content: 'En el Cajón 1.' },
    ]);

    expect(out.map((c) => c.role)).toEqual(['user', 'model']);
  });

  it('convierte una llamada a tool en functionCall dentro de un turno model', () => {
    const messages: AIMessage[] = [
      {
        role: 'assistant',
        content: '',
        tool_calls: [
          { id: 'x', type: 'function', function: { name: 'find_item', arguments: '{"query":"hdmi"}' } },
        ],
      },
    ];

    const [turno] = toGeminiContents(messages);

    expect(turno.role).toBe('model');
    expect(turno.parts[0].functionCall).toEqual({ name: 'find_item', args: { query: 'hdmi' } });
  });

  it('devuelve el resultado de una tool como functionResponse en turno de user', () => {
    const [turno] = toGeminiContents([
      { role: 'tool', name: 'find_item', content: '{"found":true}', tool_call_id: 'x' },
    ]);

    expect(turno.role).toBe('user');
    expect(turno.parts[0].functionResponse).toEqual({
      name: 'find_item',
      response: { found: true },
    });
  });

  it('no revienta si el contenido de la tool no es JSON', () => {
    const [turno] = toGeminiContents([
      { role: 'tool', name: 'find_item', content: 'error crudo', tool_call_id: 'x' },
    ]);

    expect(turno.parts[0].functionResponse?.response).toEqual({ value: 'error crudo' });
  });
});

describe('GeminiProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('manda las imágenes como inlineData junto al prompt', async () => {
    let body: Record<string, unknown> = {};
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, options: RequestInit) => {
        body = JSON.parse(options.body as string);
        return {
          ok: true,
          json: async () => ({ candidates: [{ content: { role: 'model', parts: [{ text: 'Un cable HDMI' }] } }] }),
        } as Response;
      })
    );

    const texto = await new GeminiProvider().describeImages('¿Qué es esto?', [
      { data: 'AAAA', mimeType: 'image/jpeg' },
    ]);

    expect(texto).toBe('Un cable HDMI');
    const parts = (body.contents as { parts: Record<string, unknown>[] }[])[0].parts;
    expect(parts[0]).toEqual({ text: '¿Qué es esto?' });
    expect(parts[1]).toEqual({ inlineData: { mimeType: 'image/jpeg', data: 'AAAA' } });
  });

  it('separa el system prompt en systemInstruction', async () => {
    let body: Record<string, unknown> = {};
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, options: RequestInit) => {
        body = JSON.parse(options.body as string);
        return { ok: true, json: async () => ({ candidates: [] }) } as Response;
      })
    );

    await new GeminiProvider().chat([
      { role: 'system', content: 'Eres un asistente de inventario.' },
      { role: 'user', content: 'hola' },
    ]);

    expect(body.systemInstruction).toEqual({
      parts: [{ text: 'Eres un asistente de inventario.' }],
    });
    expect((body.contents as unknown[]).length).toBe(1);
  });

  it('inventa un id de llamada, que Gemini no devuelve pero el loop necesita', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                role: 'model',
                parts: [{ functionCall: { name: 'find_item', args: { query: 'hdmi' } } }],
              },
            },
          ],
        }),
      })) as unknown as typeof fetch
    );

    const res = await new GeminiProvider().chatWithTools([{ role: 'user', content: 'hdmi' }], []);

    expect(res.message.tool_calls?.[0].id).toBeTruthy();
    expect(res.message.tool_calls?.[0].function).toEqual({
      name: 'find_item',
      arguments: '{"query":"hdmi"}',
    });
  });

  it('propaga el error de la API en vez de devolver texto vacío', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 429, text: async () => 'rate limited' })) as unknown as typeof fetch
    );

    await expect(new GeminiProvider().chat([{ role: 'user', content: 'hola' }])).rejects.toThrow(
      'Gemini API error: 429'
    );
  });
});
