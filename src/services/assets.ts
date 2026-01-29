import { vitaRequest } from '../http/vitaApiClient.js';

export async function getCryptoPrices(): Promise<unknown> {
  console.info('[VitaAssets] Consultando price...');
  return vitaRequest('prices', { method: 'GET' });
}

export async function getPaymentMethods(countryIso: string): Promise<unknown> {
  const country = countryIso.trim().toUpperCase();

  if (!country) {
    throw new Error('Country code requerido');
  }

  // Vita Wallet requiere firmar GET payment_methods con el country_iso_code en el payload lógico
  return vitaRequest(`payment_methods/${country}`, {
    method: 'GET',
    signableBody: { country_iso_code: country },
  });
}
