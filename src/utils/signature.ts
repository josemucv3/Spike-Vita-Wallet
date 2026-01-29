import crypto from 'crypto';

export type SignableBody = Record<string, unknown>;

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

export function generateSignature(
  body: SignableBody | null | undefined,
  xLogin: string,
  xDate: string,
  secretKey: string,
): string {
  let requestBody = '';
  if (body && Object.keys(body).length > 0) {
    requestBody = Object.keys(body)
      .sort((a, b) => a.localeCompare(b))
      .map((key) => `${key}${stringifyValue(body[key])}`)
      .join('');
  }

  const payload = `${xLogin}${xDate}${requestBody}`;
  const signatureHex = crypto
    .createHmac('sha256', secretKey)
    .update(payload, 'utf8')
    .digest('hex');
  return `V2-HMAC-SHA256, Signature: ${signatureHex}`;
}


export function extractHeadersValue(headers: NodeJS.Dict<string | string[]>, name: string): string | undefined {
  const header = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];

  if (Array.isArray(header)) {
    return header[0];
  }

  return header;
}

