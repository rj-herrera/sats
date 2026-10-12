import type { FormFieldType } from '@/types';

export const CURRENCY_FIELD_TYPES = [
  'currency_php',
  'currency_usd',
  'currency_jpy',
] as const;

export type CurrencyFieldType = (typeof CURRENCY_FIELD_TYPES)[number];

export interface CurrencyFieldMeta {
  code: 'PHP' | 'USD' | 'JPY';
  symbol: string;
  label: string;
  /** Locale used for amount formatting */
  locale: string;
  fractionDigits: number;
}

const CURRENCY_META: Record<CurrencyFieldType, CurrencyFieldMeta> = {
  currency_php: {
    code: 'PHP',
    symbol: '₱',
    label: 'Currency (Peso)',
    locale: 'en-PH',
    fractionDigits: 2,
  },
  currency_usd: {
    code: 'USD',
    symbol: '$',
    label: 'Currency (Dollar)',
    locale: 'en-US',
    fractionDigits: 2,
  },
  currency_jpy: {
    code: 'JPY',
    symbol: '¥',
    label: 'Currency (Yen)',
    locale: 'ja-JP',
    fractionDigits: 0,
  },
};

export function isCurrencyFieldType(
  type: FormFieldType,
): type is CurrencyFieldType {
  return (CURRENCY_FIELD_TYPES as readonly string[]).includes(type);
}

/** Number or currency amount fields stored as numeric values. */
export function isNumericFieldType(type: FormFieldType): boolean {
  return type === 'number' || isCurrencyFieldType(type);
}

export function getCurrencyFieldMeta(
  type: FormFieldType,
): CurrencyFieldMeta | null {
  if (!isCurrencyFieldType(type)) return null;
  return CURRENCY_META[type];
}

export function formatCurrencyAmount(
  type: FormFieldType,
  value: number,
): string {
  const meta = getCurrencyFieldMeta(type);
  if (!meta || !Number.isFinite(value)) return String(value);
  return new Intl.NumberFormat(meta.locale, {
    style: 'currency',
    currency: meta.code,
    minimumFractionDigits: meta.fractionDigits,
    maximumFractionDigits: meta.fractionDigits,
  }).format(value);
}
