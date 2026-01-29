import config from '../config/index.js';
import { generateSignature, SignableBody } from '../utils/signature.js';

export interface VitaHeaders extends Record<string, string> {
  'x-date': string;
  'X-Login': string;
  'X-Trans-Key': string;
  Authorization: string;
  'Content-Type': string;
}

function normalizeBody(body?: SignableBody | null): SignableBody | undefined {
  if (!body) {
    return undefined;
  }

  return Object.keys(body).length > 0 ? body : undefined;
}

export function createHeaders(body?: SignableBody | null): VitaHeaders {
  const xDate = new Date().toISOString();
  const normalizedBody = normalizeBody(body);

  return {
    'x-date': xDate,
    'X-Login': config.xLogin,
    'X-Trans-Key': config.xApiKey,
    'Content-Type': 'application/json',
    Authorization: generateSignature(normalizedBody, config.xLogin, xDate, config.secretKey),
  };
}

