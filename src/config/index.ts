import { loadEnvFile } from './loadEnv.js';

// Cargar .env al importar este módulo
loadEnvFile();

export interface VitaConfig {
  readonly xLogin: string;
  readonly xApiKey: string;
  readonly secretKey: string;
  readonly baseURL: string;
  readonly walletUuid: string;
  readonly port: number;
}

function getEnvVar(key: string, fallback?: string): string | undefined {
  return process.env[key] ?? fallback;
}

function requireEnvVar(key: string, alternativeKey?: string): string {
  const value = getEnvVar(key) ?? (alternativeKey ? getEnvVar(alternativeKey) : undefined);

  if (!value) {
    const keys = alternativeKey ? `${key} o ${alternativeKey}` : key;
    throw new Error(`Variable de entorno requerida faltante: ${keys}`);
  }

  return value;
}

const config: VitaConfig = {
  xLogin: requireEnvVar('X_LOGIN_VITA_WALLET'),
  xApiKey: requireEnvVar('X_TRANS_KEY_VITA_WALLET'),
  secretKey: requireEnvVar('SECRET_VITA_WALLET'),
  baseURL: getEnvVar('VITA_BASE_URL') ?? 'https://api.stage.vitawallet.io/api/businesses',
  walletUuid: requireEnvVar('UUID_VITA_WALLET'),
  port: Number.parseInt(getEnvVar('PORT') ?? '3000', 10),
};

export default config;

