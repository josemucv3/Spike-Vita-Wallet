import http, { IncomingMessage, Server, ServerResponse } from 'http';
import { URL } from 'url';
import config from './config/index.js';
import {
  getWithdrawalRules,
  getWithdrawalRulesByCountry,
  createPayout,
  createWithdrawal,
  listTransactions,
  getTransaction,
} from './services/withdrawals.js';
import { getCryptoPrices, getPaymentMethods } from './services/assets.js';
import { verifyIPN } from './services/ipn.js';
import type { VitaCreateTransactionRequest, VitaIPNBody } from './types/vita.js';

interface RouteContext {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
}

type RouteHandler = (context: RouteContext) => Promise<void>;

const EXPOSED_ENDPOINTS = [
  'GET /health',
  'GET /api/docs',
  'GET /api/assets',
  'GET /api/payment-methods/:country',
  'GET /api/withdrawal-rules',
  'GET /api/withdrawal-rules/:country',
  'GET /api/transactions',
  'GET /api/transactions/:id',
  'POST /api/transactions',
  'POST /api/withdraw',
  'POST /api/ipn/verify',
];

function sendJSON(res: ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-login, x-date, x-api-key',
  });
  res.end(body);
}

function sendError(res: ServerResponse, statusCode: number, message: string, details?: unknown): void {
  const payload: Record<string, unknown> = {
    error: true,
    message,
    timestamp: new Date().toISOString(),
  };
  
  if (details) {
    payload.details = details;
  }
  
  sendJSON(res, statusCode, payload);
}

async function parseJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {} as T;
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T;
  } catch (error) {
    throw new Error('Cuerpo JSON inválido');
  }
}

const routes: Record<string, RouteHandler> = {
  'GET:/health': async ({ res }) => {
    sendJSON(res, 200, {
      status: 'ok',
      service: 'vita-withdrawal-spike',
      timestamp: new Date().toISOString(),
    });
  },
  'GET:/api/assets': async ({ res }) => {
    try {
      console.info('[GET /api/assets] Listando assets/cripto...');
      const assets = await getCryptoPrices();
      sendJSON(res, 200, { success: true, assets });
    } catch (error) {
      console.error('[GET /api/assets] Error:', error);
      const status = (error as Error & { status?: number }).status ?? 500;
      sendError(res, status, (error as Error).message);
    }
  },
  'GET:/api/payment-methods/:country': async ({ url, res }) => {
    const country = url.pathname.split('/').pop();

    if (!country || country === 'payment-methods') {
      sendError(res, 400, 'Country code requerido');
      return;
    }

    try {
      console.info(`[GET /api/payment-methods/${country}] Listando métodos...`);
      const methods = await getPaymentMethods(country);
      sendJSON(res, 200, { success: true, country: country.toUpperCase(), methods });
    } catch (error) {
      console.error(`[GET /api/payment-methods/${country}] Error:`, error);
      const status = (error as Error & { status?: number }).status ?? 500;
      sendError(res, status, (error as Error).message);
    }
  },
  'GET:/api/withdrawal-rules': async ({ res }) => {
    try {
      console.info('[GET /api/withdrawal-rules] Consultando reglas de retiro para Argentina...');
      const result = await getWithdrawalRules();
      sendJSON(res, 200, { success: true, country: 'AR', rules: result });
    } catch (error) {
      console.error('[GET /api/withdrawal-rules] Error:', error);
      sendError(res, 500, (error as Error).message, {
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  },
  'GET:/api/withdrawal-rules/:country': async ({ url, res }) => {
    const country = url.pathname.split('/').pop();

    if (!country || country === 'withdrawal-rules') {
      sendError(res, 400, 'Country code requerido en la URL: /api/withdrawal-rules/:country');
      return;
    }

    try {
      console.info(`[GET /api/withdrawal-rules/${country}] Consultando reglas dinámicas...`);
      const rules = await getWithdrawalRulesByCountry(country);

      if (!rules) {
        sendError(res, 404, `No se encontraron reglas para ${country.toUpperCase()}`);
        return;
      }

      sendJSON(res, 200, { success: true, country: country.toUpperCase(), rules });
    } catch (error) {
      console.error(`[GET /api/withdrawal-rules/${country}] Error:`, error);
      const status = (error as Error & { status?: number }).status ?? 500;
      sendError(res, status, (error as Error).message);
    }
  },
  'POST:/api/transactions': async ({ req, res }) => {
    try {
      const body = await parseJsonBody<Partial<VitaCreateTransactionRequest>>(req);
      console.info('[POST /api/transactions] Creando retiro:', { order: body.order, amount: body.amount });
      const response = await createPayout(body);
      sendJSON(res, 201, { success: true, transaction: response });
    } catch (error) {
      console.error('[POST /api/transactions] Error:', error);
      sendError(res, 500, (error as Error).message, {
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  },
  'POST:/api/withdraw': async ({ req, res }) => {
    try {
      const body = await parseJsonBody<Record<string, unknown>>(req);
      console.info('[POST /api/withdraw] Creando retiro adaptativo:', {
        country: body?.country,
        currency: body?.currency,
      });

      const response = await createWithdrawal(body as Partial<VitaCreateTransactionRequest> & Record<string, unknown>);
      sendJSON(res, 201, { success: true, transaction: response });
    } catch (error) {
      console.error('[POST /api/withdraw] Error:', error);
      const status = (error as Error & { status?: number }).status ?? 500;
      sendError(res, status, (error as Error).message, {
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  },
  'GET:/api/transactions': async ({ url, res }) => {
    try {
      const filterEntries = [...url.searchParams.entries()];
      const filters = filterEntries.length > 0 ? Object.fromEntries(filterEntries) : undefined;
      console.info('[GET /api/transactions] Listando transacciones con filtros:', filters ?? {});
      const response = await listTransactions(filters);
      sendJSON(res, 200, { success: true, data: response });
    } catch (error) {
      console.error('[GET /api/transactions] Error:', error);
      sendError(res, 500, (error as Error).message, {
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  },
  'GET:/api/transactions/:id': async ({ url, res }) => {
    const transactionId = url.pathname.split('/').pop();

    if (!transactionId || transactionId === 'transactions') {
      sendError(res, 400, 'ID de transacción requerido en la URL: /api/transactions/:id');
      return;
    }

    try {
      console.info(`[GET /api/transactions/${transactionId}] Consultando transacción...`);
      const response = await getTransaction(transactionId);
      sendJSON(res, 200, { success: true, transaction: response });
    } catch (error) {
      console.error(`[GET /api/transactions/${transactionId}] Error:`, error);
      sendError(res, 500, (error as Error).message, {
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  },
  'POST:/api/webhook': async ({ req, res }) => {
    try {
      const webhookBody = await parseJsonBody<VitaIPNBody & Record<string, unknown>>(req);
      console.info('[POST /api/webhook] Webhook recibido de Vita Wallet:', {
        order: webhookBody.order,
        status: webhookBody.status,
        wallet: webhookBody.wallet,
        timestamp: new Date().toISOString(),
      });

      // Verificar la firma del webhook
      const verification = verifyIPN(webhookBody, req.headers);

      if (!verification.isValid) {
        console.warn('[POST /api/webhook] Firma inválida en webhook:', {
          order: webhookBody.order,
          receivedSignature: verification.receivedSignature,
          calculatedSignature: verification.calculatedSignature,
        });
        sendError(res, 401, 'Firma del webhook inválida', {
          receivedSignature: verification.receivedSignature,
          calculatedSignature: verification.calculatedSignature,
        });
        return;
      }

      console.info('[POST /api/webhook] Webhook verificado correctamente:', {
        order: webhookBody.order,
        status: webhookBody.status,
      });

      // Aquí puedes agregar tu lógica de procesamiento del webhook
      // Por ejemplo: actualizar estado en BD, enviar notificaciones, etc.
      // TODO: Implementar lógica de negocio según el status recibido

      // Responder a Vita Wallet con 200 OK
      sendJSON(res, 200, {
        success: true,
        message: 'Webhook recibido y procesado correctamente',
        order: webhookBody.order,
        status: webhookBody.status,
      });
    } catch (error) {
      console.error('[POST /api/webhook] Error al procesar webhook:', error);
      const status = (error as Error & { status?: number }).status ?? 500;
      sendError(res, status, (error as Error).message, {
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  },
  'POST:/api/ipn/verify': async ({ req, res }) => {
    try {
      const ipnBody = await parseJsonBody<VitaIPNBody>(req);
      console.info('[POST /api/ipn/verify] Verificando IPN:', { order: ipnBody.order, status: ipnBody.status });
      const verification = verifyIPN(ipnBody, req.headers);
      sendJSON(res, 200, { success: true, ...verification });
    } catch (error) {
      console.error('[POST /api/ipn/verify] Error:', error);
      sendError(res, 400, (error as Error).message);
    }
  },
  'GET:/api/docs': async ({ res }) => {
    sendJSON(res, 200, {
      service: 'Vita Wallet Withdrawal Spike API',
      version: '1.0.0',
      endpoints: {
        'GET /health': 'Health check del servicio',
        'GET /api/withdrawal-rules': 'Obtiene reglas de retiro para Argentina',
        'GET /api/withdrawal-rules/:country': 'Obtiene reglas de retiro específicas por país (firma con country_iso_code)',
        'POST /api/transactions': 'Crea un nuevo retiro (payout)',
        'POST /api/withdraw': 'Crea un retiro adaptativo con los campos enviados',
        'GET /api/transactions': 'Lista transacciones (query params: country, page, per_page, etc.)',
        'GET /api/transactions/:id': 'Obtiene detalles de una transacción específica',
        'GET /api/assets': 'Lista assets/cripto disponibles vía crypto_prices',
        'GET /api/payment-methods/:country': 'Lista métodos disponibles por país',
        'POST /api/webhook': 'Recibe y procesa webhooks de Vita Wallet (verifica firma automáticamente)',
        'POST /api/ipn/verify': 'Verifica la firma de un IPN recibido de Vita Wallet',
        'GET /api/docs': 'Esta documentación',
      },
      examples: {
        'POST /api/transactions': {
          transactions_type: 'withdrawal',
          order: 'unique-order-id',
          wallet: 'wallet-uuid',
          amount: 1000,
          currency: 'ars',
          country: 'AR',
          url_notify: 'https://tudominio.com/webhook',
          beneficiary_first_name: 'Juan',
          beneficiary_last_name: 'Pérez',
          beneficiary_email: 'juan@example.com',
          beneficiary_document_type: 'DNI',
          beneficiary_document_number: '12345678',
          beneficiary_address: 'Av. Siempre Viva 742',
          bank_code: '017',
          account_type_bank: 'CA',
          account_bank: '0000003100000000000000',
          purpose: 'EPREMT',
          purpose_commentary: 'Pago de prueba',
        },
      },
    });
  },
};

function matchRoute(method: string, pathname: string): RouteHandler | undefined {
  const directKey = `${method}:${pathname}`;
  if (routes[directKey]) {
    return routes[directKey];
  }

  // Handle dynamic route for transaction detail
  if (pathname.startsWith('/api/transactions/') && pathname !== '/api/transactions') {
    return routes[`${method}:/api/transactions/:id`];
  }

  if (pathname.startsWith('/api/payment-methods/') && pathname !== '/api/payment-methods') {
    return routes[`${method}:/api/payment-methods/:country`];
  }

  if (pathname.startsWith('/api/withdrawal-rules/') && pathname !== '/api/withdrawal-rules') {
    return routes[`${method}:/api/withdrawal-rules/:country`];
  }

  return undefined;
}

export function createServer(): Server {
  const server = http.createServer(async (req, res) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-login, x-date, X-Trans-Key',
      });
      res.end();
      return;
    }

    if (!req.url || !req.method) {
      sendError(res, 400, 'Solicitud inválida');
      return;
    }

    const url = new URL(req.url, `http://localhost:${config.port}`);
    const handler = matchRoute(req.method.toUpperCase(), url.pathname);

    if (!handler) {
      sendError(res, 404, `Ruta no encontrada: ${req.method} ${url.pathname}`, {
        availableEndpoints: [
          'GET /health',
          'GET /api/docs',
          'GET /api/withdrawal-rules',
          'GET /api/withdrawal-rules/:country',
          'POST /api/transactions',
          'POST /api/withdraw',
          'GET /api/transactions',
          'GET /api/transactions/:id',
          'POST /api/webhook',
          'POST /api/ipn/verify',
          'GET /api/assets',
          'GET /api/payment-methods/:country',
        ],
      });
      return;
    }

    try {
      await handler({ req, res, url });
    } catch (error) {
      console.error(`[${req.method} ${url.pathname}] Error no manejado:`, error);
      sendError(res, 500, (error as Error).message, {
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  });

  return server;
}

export async function startServer(): Promise<Server> {
  const server = createServer();

  return new Promise((resolve, reject) => {
    server.listen(config.port, () => {
      console.info(`Servidor HTTP escuchando en http://localhost:${config.port}`);
      console.info(
        '[Server] Endpoints expuestos:\n- %s',
        EXPOSED_ENDPOINTS.join('\n- '),
      );
      resolve(server);
    });

    server.on('error', reject);
  });
}

