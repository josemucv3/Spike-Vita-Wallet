import config from '../config/index.js';
import { vitaRequest } from '../http/vitaApiClient.js';
import { getCryptoPrices } from './assets.js';
import type {
  VitaCreateTransactionRequest,
  VitaListTransactionsResponse,
  VitaTransactionResponse,
  VitaWithdrawalRule,
  VitaWithdrawalRulesResponse,
} from '../types/vita.js';

export async function getWithdrawalRules(): Promise<VitaWithdrawalRule | null> {
  return getWithdrawalRulesByCountry('AR');
}

export async function getWithdrawalRulesByCountry(countryIso: string): Promise<VitaWithdrawalRule | null> {
  const country = countryIso.trim();

  if (!country) {
    throw new Error('Country ISO requerido para consultar withdrawal_rules');
  }

  const normalizedCountry = country.toUpperCase();
  const response = await vitaRequest<VitaWithdrawalRulesResponse>('withdrawal_rules', {
    method: 'GET',
  });

  const { rules } = response;

  if (!rules) {
    console.warn(`No se encontraron reglas de retiro para ${normalizedCountry}:`, response);
    return null;
  }

  if (Array.isArray(rules)) {
    return rules.find((rule) => rule?.country?.toUpperCase() === normalizedCountry) ?? null;
  }

  const typedRules = rules as Record<string, VitaWithdrawalRule | undefined>;
  const lowerKey = normalizedCountry.toLowerCase();
  return typedRules[lowerKey] ?? typedRules[normalizedCountry] ?? null;
}

export async function createPayout(bodyOverride?: Partial<VitaCreateTransactionRequest>) {
  const order = `ret-${Date.now()}-${Math.floor(Math.random() * 999999)}`;


  const body = { ...bodyOverride, order };

  const response = await vitaRequest<VitaTransactionResponse>('transactions', {
    method: 'POST',
    body,
  });

  return response;
}

export async function listTransactions(
  filters?: Record<string, string | number | boolean | undefined>,
): Promise<VitaListTransactionsResponse> {
  return vitaRequest<VitaListTransactionsResponse>('transactions', {
    method: 'GET',
    ...(filters ? { query: filters } : {}),
  });
}

export async function getTransaction(transactionId: string): Promise<VitaTransactionResponse> {
  return vitaRequest<VitaTransactionResponse>(`transactions/${transactionId}`, { method: 'GET' });
}

export async function createWithdrawal(
  data: Partial<VitaCreateTransactionRequest> & Record<string, unknown>,
): Promise<VitaTransactionResponse> {
  // Validar prices antes de ejecutar el retiro
  console.info('[createWithdrawal] Validando prices antes de crear retiro...');
  try {
    await getCryptoPrices();
    console.info('[createWithdrawal] Prices validado correctamente, procediendo con el retiro...');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[createWithdrawal] Error al validar prices:', errorMessage);
    throw new Error(`No se pudo validar prices antes del retiro: ${errorMessage}`);
  }

  const order = `ret-${Date.now()}-${Math.floor(Math.random() * 999999)}`;

  const payload = {
    transactions_type: 'withdrawal' as const,
    order,
    ...data,
  } as VitaCreateTransactionRequest & Record<string, unknown>;

  return vitaRequest<VitaTransactionResponse>('transactions', {
    method: 'POST',
    body: payload,
  });
}

