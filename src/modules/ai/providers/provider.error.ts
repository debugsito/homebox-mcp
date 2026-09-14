/**
 * Error de un proveedor con su codigo HTTP, para poder decidir si vale la pena
 * probar con el siguiente. Sin el codigo habria que adivinar leyendo el
 * mensaje, y no todos los proveedores redactan igual.
 */
export class ProviderError extends Error {
  constructor(
    public readonly provider: string,
    public readonly status: number,
    message?: string
  ) {
    super(message ?? `${provider} API error: ${status}`);
    this.name = 'ProviderError';
  }

  /**
   * Cuota agotada, saturacion o fallo transitorio: otro proveedor puede
   * responder. Un 400 o un 401 son culpa nuestra y fallarian igual en todos,
   * asi que ahi conviene fallar rapido en vez de recorrer la cadena entera.
   */
  get vaLePenaOtroProveedor(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}

export function esReintentableEnOtro(err: unknown): boolean {
  return err instanceof ProviderError && err.vaLePenaOtroProveedor;
}
