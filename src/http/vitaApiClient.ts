import { URL } from 'url';
import config from '../config/index.js';
import { createHeaders } from './headers.js';
import type { SignableBody } from '../utils/signature.js';
import { buildSignableBody } from '../utils/signableBodyBuilder.js';

export interface VitaRequestOptions {
  method?: 'GET' | 'POST';
  body?: SignableBody | null;
  signableBody?: SignableBody | null;
  query?: Record<string, string | number | boolean | undefined>;
}

export async function vitaRequest<TResponse = unknown>(
  path: string,
  { method = 'GET', body = null, signableBody: explicitSignableBody = null, query }: VitaRequestOptions = {},
): Promise<TResponse> {
  const base = config.baseURL.endsWith('/') ? config.baseURL : `${config.baseURL}/`;
  const url = new URL(path, base);
  console.info('[VitaRequest] URL:', url.toString());

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  // Determinar el body para la firma:
  // 1. Si se pasa explícitamente signableBody, usarlo
  // 2. Si es POST y hay body, usar el body
  // 3. Si es GET, construir el body lógico según el endpoint
  // 4. Si no hay nada, undefined
  let bodyForSignature: SignableBody | undefined;

  if (explicitSignableBody !== null && explicitSignableBody !== undefined) {
    bodyForSignature = explicitSignableBody;
  } else if (method === 'POST') {
    const hasBodyContent = Boolean(body && Object.keys(body).length > 0);
    bodyForSignature = hasBodyContent && body ? body : undefined;
  } else {
    // GET: construir body lógico según el endpoint
    bodyForSignature = buildSignableBody(path, method, query as Record<string, unknown>);
  }

  const headers = createHeaders(bodyForSignature);

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  // Solo enviar body real en POST
  if (method === 'POST' && body && Object.keys(body).length > 0) {
    fetchOptions.body = JSON.stringify(body);
  }

  console.info('[VitaRequest] Enviando petición', {
    method,
    url: url.toString(),
    headers,
    body: method === 'POST' && body && Object.keys(body).length > 0 ? body : undefined,
    signableBody: bodyForSignature,
    query,
  });
  console.info('[VitaRequest] headers enviados:', headers);

  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const cause = error instanceof Error && 'cause' in error ? error.cause : undefined;
    throw new Error(
      `Error de conexión con Vita Wallet (${url.toString()}): ${errorMessage}${cause ? ` - Causa: ${cause}` : ''}`,
    );
  }
  const rawBody = await response.text();

  let parsedBody: unknown = null;

  if (rawBody) {
    try {
      parsedBody = JSON.parse(rawBody);
    } catch (error) {
      throw new Error(`Respuesta inválida recibida de Vita Wallet (${url.toString()}): ${rawBody}`);
    }
  }

  console.info('[VitaRequest] Respuesta recibida', {
    status: response.status,
    statusText: response.statusText,
    body: parsedBody,
  });

  if (!response.ok) {
    const message =
      (parsedBody as Record<string, unknown>)?.message ??
      (parsedBody as Record<string, unknown>)?.error ??
      response.statusText;
    const details = {
      status: response.status,
      message,
      payload: parsedBody,
    };

    let errorMessage: string;

    switch (response.status) {
      case 401:
      case 403:
        errorMessage = `Error de autenticación/autorización (${response.status}): ${message}`;
        break;
      case 404:
        errorMessage = `Recurso no encontrado (${response.status}): ${message}`;
        break;
      case 422:
        errorMessage = `Error de validación (${response.status}): ${JSON.stringify(parsedBody, null, 2)}`;
        break;
      case 429:
        errorMessage = `Límite de peticiones alcanzado (${response.status}): ${message}`;
        break;
      case 500:
      case 502:
      case 503:
        errorMessage = `Error interno en Vita Wallet (${response.status}): ${message}`;
        break;
      default:
        errorMessage = `Solicitud fallida (${response.status}): ${JSON.stringify(details, null, 2)}`;
        break;
    }

    const vitaError = new Error(errorMessage) as Error & { status?: number; details?: typeof details };
    vitaError.status = response.status;
    vitaError.details = details;
    throw vitaError;
  }

  return parsedBody as TResponse;
}

