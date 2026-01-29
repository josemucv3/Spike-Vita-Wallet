export interface VitaTransactionResponse {
  id: string;
  status: string;
  [key: string]: unknown;
}

export interface VitaWithdrawalRuleField {
  field?: string;
  name?: string;
  description?: string;
  label?: string;
  required?: boolean;
  type?: string;
  [key: string]: unknown;
}

export interface VitaWithdrawalRule {
  country?: string;
  fields?: VitaWithdrawalRuleField[] | Record<string, unknown>;
  [key: string]: unknown;
}

export interface VitaWithdrawalRulesResponse {
  rules?: Record<string, VitaWithdrawalRule> | VitaWithdrawalRule[];
  [key: string]: unknown;
}

export interface VitaCreateTransactionRequest {
  transactions_type: 'withdrawal';
  order: string;
  wallet: string;
  amount: number;
  currency: string;
  country: string;
  url_notify: string;
  beneficiary_first_name: string;
  beneficiary_last_name: string;
  beneficiary_email: string;
  beneficiary_document_type: string;
  beneficiary_document_number: string;
  beneficiary_address: string;
  bank_code: string;
  account_type_bank: string;
  account_bank: string;
  purpose: string;
  purpose_commentary: string;
  [key: string]: unknown;
}

export interface VitaListTransactionsResponse {
  data?: VitaTransactionResponse[];
  meta?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface VitaIPNBody {
  status: string;
  order: string;
  wallet: string;
  [key: string]: unknown;
}

