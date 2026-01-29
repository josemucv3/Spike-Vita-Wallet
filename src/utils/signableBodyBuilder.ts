import type { SignableBody } from './signature.js';

/**
 * Construye el body lógico para firmar según el endpoint y método HTTP.
 * Algunos endpoints GET requieren incluir parámetros en el payload firmado,
 * aunque el método HTTP sea GET y no se envíe body en la petición.
 *
 * @param path - Ruta del endpoint (ej: 'payment_methods/AR', 'transactions')
 * @param method - Método HTTP ('GET' | 'POST')
 * @param params - Parámetros adicionales del endpoint
 * @returns Body lógico para usar en la firma, o undefined si no requiere body
 */
export function buildSignableBody(
  path: string,
  method: 'GET' | 'POST',
  params?: Record<string, unknown>,
): SignableBody | undefined {
  // Para POST, el body real se envía y la firma ya utiliza el payload real
  if (method === 'POST') {
    return undefined;
  }

  // GET /payment_methods/:country requiere firmar con country_iso_code
  if (path.includes('payment_methods/')) {
    const countryMatch = path.match(/payment_methods\/([^/?]+)/);
    if (countryMatch) {
      const country = countryMatch[1].trim().toUpperCase();
      if (country) {
        return { country_iso_code: country };
      }
    }
  }

  // GET /withdrawal_rules acepta country_iso_code en el payload lógico
  if (path.includes('withdrawal_rules')) {
    const iso =
      (params?.country_iso_code as string | undefined) ??
      (params?.country as string | undefined);

    if (iso?.trim()) {
      return { country_iso_code: iso.trim().toUpperCase() };
    }
  }

  // Para otros GET sin payload lógico, retornar undefined
  return undefined;
}

