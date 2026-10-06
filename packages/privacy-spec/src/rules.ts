import type { EntityType } from './types';
import { isValidLuhn, isValidTaiwanId } from './validators';

export interface Rule {
  id: string;
  type: EntityType;
  pattern: RegExp;
  confidence: number;
  /** Capture group holding the sensitive part; default is the whole match. */
  group?: number;
  validate?: (matched: string) => boolean;
}

// Separators never include newlines so a match stays within one OCR line.
export const RULES: Rule[] = [
  {
    id: 'email',
    type: 'EMAIL',
    pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g,
    confidence: 0.98,
  },
  {
    id: 'tw-national-id',
    type: 'TW_NATIONAL_ID',
    pattern: /(?<![A-Za-z0-9])[A-Z][1289]\d{8}(?!\d)/g,
    confidence: 0.97,
    validate: isValidTaiwanId,
  },
  {
    id: 'credit-card',
    type: 'CREDIT_CARD',
    pattern: /(?<!\d)\d(?:[ -]?\d){12,18}(?!\d)/g,
    confidence: 0.95,
    validate: (m) => isValidLuhn(m.replace(/[ -]/g, '')),
  },
  {
    id: 'tw-mobile',
    type: 'PHONE',
    pattern: /(?<!\d)(?:\+?886[- ]?|0)9\d{2}[- ]?\d{3}[- ]?\d{3}(?!\d)/g,
    confidence: 0.95,
  },
  {
    id: 'tw-landline',
    type: 'PHONE',
    pattern: /(?<![\d-])\(?0[2-8]\d?\)?[- ]?\d{3,4}[- ]?\d{4}(?![\d-])/g,
    confidence: 0.85,
  },
  {
    id: 'bank-account',
    type: 'BANK_ACCOUNT',
    pattern: /(?:帳號|帳戶|匯款|account(?:\s*(?:no\.?|number|#))?|acct)[:：#]?[ \t]*(\d(?:[ -]?\d){7,15})(?!\d)/gi,
    confidence: 0.8,
    group: 1,
  },
  {
    id: 'url',
    type: 'URL',
    pattern: /\b(?:https?:\/\/|www\.)[^\s<>"'，。]+/gi,
    confidence: 0.9,
  },
  {
    id: 'ipv4',
    type: 'IP_ADDRESS',
    pattern: /(?<![\d.])(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?![\d.])/g,
    confidence: 0.9,
  },
];
