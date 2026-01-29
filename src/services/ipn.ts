import config from '../config/index.js';
import type { VitaIPNBody } from '../types/vita.js';
import { extractHeadersValue, generateSignature, type SignableBody } from '../utils/signature.js';

export interface VerifyIPNResult {
  isValid: boolean;
  receivedSignature?: string;
  calculatedSignature: string;
}

export function verifyIPN(
  ipnBody: VitaIPNBody,
  headers: NodeJS.Dict<string | string[]>,
): VerifyIPNResult {
  const authorization = extractHeadersValue(headers, 'authorization');
  const xLogin = extractHeadersValue(headers, 'x-login');
  const xDate = extractHeadersValue(headers, 'x-date');

  if (!authorization) {
    throw new Error('Cabecera Authorization faltante en IPN');
  }

  if (!xLogin || !xDate) {
    throw new Error('Cabeceras x-login o x-date faltantes en IPN');
  }

  const bodyForSignature: SignableBody = {
    status: ipnBody.status,
    order: ipnBody.order,
    wallet: ipnBody.wallet,
  };

  const expectedSignature = generateSignature(bodyForSignature, xLogin, xDate, config.secretKey);

  return {
    isValid: authorization === expectedSignature,
    receivedSignature: authorization,
    calculatedSignature: expectedSignature,
  };
}

