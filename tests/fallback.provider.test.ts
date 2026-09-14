import { describe, it, expect, vi } from 'vitest';
import { FallbackProvider } from '../src/modules/ai/providers/fallback.provider.js';
import { ProviderError } from '../src/modules/ai/providers/provider.error.js';
import type { AIProvider, AIChatResponse } from '../src/modules/ai/providers/ai-provider.interface.js';

function respuesta(texto: string): AIChatResponse {
  return {
    message: { role: 'assistant', content: texto },
    finishReason: 'stop',
    usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
  };
}

function proveedor(nombre: string, comportamiento: () => Promise<AIChatResponse>) {
  const fn = vi.fn(comportamiento);
  const provider: AIProvider = { chat: fn, chatWithTools: fn };
  return { nombre, provider, fn };
}

const MENSAJES = [{ role: 'user' as const, content: 'hola' }];

describe('FallbackProvider', () => {
  it('usa el primero mientras responda', async () => {
    const a = proveedor('a', async () => respuesta('desde A'));
    const b = proveedor('b', async () => respuesta('desde B'));

    const r = await new FallbackProvider([a, b]).chat(MENSAJES);

    expect(r.message.content).toBe('desde A');
    expect(b.fn).not.toHaveBeenCalled();
  });

  it('pivota al siguiente cuando el primero agota la cuota', async () => {
    const a = proveedor('a', async () => {
      throw new ProviderError('a', 429);
    });
    const b = proveedor('b', async () => respuesta('desde B'));

    const r = await new FallbackProvider([a, b]).chat(MENSAJES);

    expect(r.message.content).toBe('desde B');
    expect(a.fn).toHaveBeenCalledOnce();
  });

  it('pivota también ante un 503 por saturación', async () => {
    const a = proveedor('a', async () => {
      throw new ProviderError('a', 503);
    });
    const b = proveedor('b', async () => respuesta('desde B'));

    expect((await new FallbackProvider([a, b]).chat(MENSAJES)).message.content).toBe('desde B');
  });

  it('no pivota ante un 400: fallaría igual en todos', async () => {
    const a = proveedor('a', async () => {
      throw new ProviderError('a', 400);
    });
    const b = proveedor('b', async () => respuesta('desde B'));

    await expect(new FallbackProvider([a, b]).chat(MENSAJES)).rejects.toThrow('a API error: 400');
    expect(b.fn).not.toHaveBeenCalled();
  });

  it('tampoco pivota ante un 401, que es una clave mal puesta', async () => {
    const a = proveedor('a', async () => {
      throw new ProviderError('a', 401);
    });
    const b = proveedor('b', async () => respuesta('desde B'));

    await expect(new FallbackProvider([a, b]).chat(MENSAJES)).rejects.toThrow('401');
    expect(b.fn).not.toHaveBeenCalled();
  });

  it('recorre la cadena entera si hace falta', async () => {
    const a = proveedor('a', async () => {
      throw new ProviderError('a', 429);
    });
    const b = proveedor('b', async () => {
      throw new ProviderError('b', 503);
    });
    const c = proveedor('c', async () => respuesta('desde C'));

    const r = await new FallbackProvider([a, b, c]).chat(MENSAJES);

    expect(r.message.content).toBe('desde C');
  });

  it('propaga el último error si se agota la cadena', async () => {
    const a = proveedor('a', async () => {
      throw new ProviderError('a', 429);
    });
    const b = proveedor('b', async () => {
      throw new ProviderError('b', 503);
    });

    await expect(new FallbackProvider([a, b]).chat(MENSAJES)).rejects.toThrow('b API error: 503');
  });

  it('pasa las tools al proveedor de respaldo, no solo los mensajes', async () => {
    const a = proveedor('a', async () => {
      throw new ProviderError('a', 429);
    });
    const b = proveedor('b', async () => respuesta('ok'));
    const tools = [
      { type: 'function' as const, function: { name: 'find_item', description: 'x', parameters: { type: 'object' as const, properties: {}, required: [] } } },
    ];

    await new FallbackProvider([a, b]).chatWithTools(MENSAJES, tools);

    expect(b.fn).toHaveBeenCalledWith(MENSAJES, tools);
  });

  it('no acepta una cadena vacía', () => {
    expect(() => new FallbackProvider([])).toThrow('vacía');
  });

  it('un error que no es de proveedor no hace pivotar', async () => {
    const a = proveedor('a', async () => {
      throw new TypeError('fetch failed');
    });
    const b = proveedor('b', async () => respuesta('desde B'));

    await expect(new FallbackProvider([a, b]).chat(MENSAJES)).rejects.toThrow('fetch failed');
    expect(b.fn).not.toHaveBeenCalled();
  });
});
