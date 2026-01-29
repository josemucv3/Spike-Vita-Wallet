import config from '../config/index.js';
import {
  createPayout,
  getTransaction,
  getWithdrawalRules,
  listTransactions,
} from './withdrawals.js';
import { verifyIPN } from './ipn.js';
import { generateSignature } from '../utils/signature.js';

export async function runSpikeScenario(): Promise<void> {
  console.info('=== Vita Wallet Withdrawal Spike (Argentina) ===');

  if (
    [config.xLogin, config.xApiKey, config.secretKey, config.walletUuid].some((value) =>
      value.startsWith('your-'),
    )
  ) {
    console.warn(
      '⚠️  Configure las variables de entorno VITA_X_LOGIN, VITA_X_API_KEY, VITA_SECRET_KEY y VITA_WALLET_UUID antes de ejecutar llamadas reales.',
    );
  }

  try {
    const rules = await getWithdrawalRules();

    if (rules) {
      console.info('--- Campos requeridos para retiros en Argentina ---');

      if (Array.isArray(rules.fields)) {
        rules.fields.forEach((field) => {
          const name = field.name ?? field.field ?? 'desconocido';
          const description = field.description ?? field.label ?? 'sin descripción';
          console.info(`• ${name}: ${description}`);
        });
      } else if (rules.fields && typeof rules.fields === 'object') {
        Object.entries(rules.fields).forEach(([fieldKey, fieldValue]) => {
          console.info(`• ${fieldKey}: ${JSON.stringify(fieldValue)}`);
        });
      } else {
        console.info(rules);
      }
    }
  } catch (error) {
    console.error('Error al obtener withdrawal_rules:', (error as Error).message);
  }

  let createdTransactionId: string | undefined;
  try {
    const payoutResponse = await createPayout();
    createdTransactionId = payoutResponse.id;

    console.info('--- Respuesta de creación de retiro ---');
    console.info(`ID: ${payoutResponse.id}`);
    console.info(`Estado inicial: ${payoutResponse.status}`);
    console.info('Detalle completo:', payoutResponse);
  } catch (error) {
    console.error('Error al crear el retiro:', (error as Error).message);
  }

  try {
    const transactions = await listTransactions({ country: 'AR', page: 1, per_page: 10 });
    console.info('--- Listado de transacciones ---');
    console.info(transactions);
  } catch (error) {
    console.error('Error al listar transacciones:', (error as Error).message);
  }

  if (createdTransactionId) {
    try {
      const transaction = await getTransaction(createdTransactionId);
      console.info(`--- Detalle de la transacción ${createdTransactionId} ---`);
      console.info(transaction);
    } catch (error) {
      console.error(
        `Error al consultar la transacción ${createdTransactionId}:`,
        (error as Error).message,
      );
    }
  }

  const sampleIpn = {
    status: 'completed',
    order: 'test-order-123',
    wallet: config.walletUuid,
  };
  const sampleHeaders = createSampleIPNHeaders(sampleIpn);

  try {
    const result = verifyIPN(sampleIpn, sampleHeaders);
    console.info('--- Verificación de IPN ---');
    console.info(`Firma recibida:   ${result.receivedSignature}`);
    console.info(`Firma calculada: ${result.calculatedSignature}`);
    console.info(`IPN válido: ${result.isValid ? 'Sí' : 'No'}`);
  } catch (error) {
    console.error('Error al verificar IPN:', (error as Error).message);
  }
}

function createSampleIPNHeaders(sampleIpn: { status: string; order: string; wallet: string }) {
  const xDate = new Date().toISOString();
  const authorization = generateSignature(sampleIpn, config.xLogin, xDate, config.secretKey);

  return {
    authorization,
    'x-login': config.xLogin,
    'x-date': xDate,
  };
}

