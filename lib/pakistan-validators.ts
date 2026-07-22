/** Pakistani CNIC: 13 digits, commonly written as 12345-1234567-1 */

/** Pakistani mobile: 03XX-XXXXXXX (11 digits, starts with 03) */
const PAKISTAN_MOBILE = /^03\d{9}$/;

export function cnicDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function normalizeCnic(value: string): string {
  const digits = cnicDigits(value);
  if (digits.length !== 13) return value.trim();
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

export function isValidCnic(value: string): boolean {
  const digits = cnicDigits(value);
  return digits.length === 13 && /^\d{13}$/.test(digits);
}

export function normalizePakistanMobile(value: string): string {
  let digits = value.replace(/\D/g, "");

  if (digits.startsWith("92") && digits.length === 12) {
    digits = `0${digits.slice(2)}`;
  } else if (digits.length === 10 && digits.startsWith("3")) {
    digits = `0${digits}`;
  }

  return digits;
}

export function isValidPakistanMobile(value: string): boolean {
  const normalized = normalizePakistanMobile(value);
  return PAKISTAN_MOBILE.test(normalized);
}

export function formatCnicInput(value: string): string {
  const digits = cnicDigits(value).slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

export function formatMobileInput(value: string): string {
  let digits = value.replace(/\D/g, "");

  if (digits.startsWith("92") && digits.length > 2) {
    digits = `0${digits.slice(2)}`;
  } else if (digits.length > 0 && digits.startsWith("3") && !digits.startsWith("03")) {
    digits = `0${digits}`;
  }

  digits = digits.slice(0, 11);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

export function formatPakistanMobileDisplay(value: string): string {
  const normalized = normalizePakistanMobile(value);
  if (!PAKISTAN_MOBILE.test(normalized)) return value.trim();
  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}

export const CNIC_PLACEHOLDER = "12345-1234567-1";
export const MOBILE_PLACEHOLDER = "03XX-XXXXXXX";

export const CNIC_ERROR = "Enter a valid CNIC (13 digits, e.g. 12345-1234567-1)";
export const MOBILE_ERROR = "Enter a valid Pakistani mobile number (e.g. 03XX-XXXXXXX)";

/** Pakistan IBAN: PK + 2 check digits + 4 bank code + 16 account digits (24 chars) */
const PAKISTAN_IBAN = /^PK\d{2}[A-Z]{4}\d{16}$/;

export const IBAN_ERROR = "Enter a valid Pakistan IBAN (24 characters, e.g. PK36SCBL0000001123456702)";
export const BANK_ACCOUNT_ERROR = "Enter a valid bank account number (6–20 digits)";
export const WALLET_ACCOUNT_ERROR = "Enter a valid mobile number (03XX-XXXXXXX) or merchant ID (5–20 digits)";

export function normalizePakistanIban(value: string): string {
  return value.replace(/\s/g, "").toUpperCase();
}

export function isValidPakistanIban(value: string): boolean {
  const normalized = normalizePakistanIban(value);
  if (!normalized) return true;
  return PAKISTAN_IBAN.test(normalized);
}

export function formatPakistanIbanInput(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 24);
}

export function normalizeBankAccountNumber(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidBankAccountNumber(value: string): boolean {
  const digits = normalizeBankAccountNumber(value);
  return /^\d{6,20}$/.test(digits);
}

export function normalizeWalletAccountNumber(value: string): string {
  const trimmed = value.trim();
  if (isValidPakistanMobile(trimmed)) return normalizePakistanMobile(trimmed);
  return trimmed.replace(/\D/g, "");
}

export function isValidWalletAccountNumber(value: string): boolean {
  const trimmed = value.trim();
  if (isValidPakistanMobile(trimmed)) return true;
  const digits = trimmed.replace(/\D/g, "");
  return /^\d{5,20}$/.test(digits);
}
