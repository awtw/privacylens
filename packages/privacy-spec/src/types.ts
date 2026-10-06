export type EntityType =
  | 'EMAIL'
  | 'PHONE'
  | 'TW_NATIONAL_ID'
  | 'CREDIT_CARD'
  | 'BANK_ACCOUNT'
  | 'URL'
  | 'IP_ADDRESS'
  | 'ID_NUMBER'
  | 'USERNAME'
  | 'CUSTOM'
  | 'PERSON'
  | 'ADDRESS'
  | 'ORGANIZATION'
  | 'LOCATION'
  | 'FACE'
  | 'QR_CODE'
  | 'BARCODE'
  | 'GPS'
  | 'DEVICE_INFO';

export type EntitySource = 'regex' | 'ner' | 'vision' | 'metadata' | 'manual';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/** Normalized (0–1) rectangle, origin top-left, relative to image size. */
export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Cross-platform detection result. UI must not depend on the underlying engine. */
export interface Entity {
  id: string;
  type: EntityType;
  text: string;
  confidence: number;
  bbox: BBox | null; // null for non-visual entities (e.g. metadata)
  source: EntitySource;
  riskLevel: RiskLevel;
}

/** One OCR word with a normalized bbox. `line` groups words into lines. */
export interface OcrWord {
  text: string;
  bbox: BBox;
  line: number;
}

export interface RiskSummary {
  level: RiskLevel | 'none';
  score: number; // 0–100
  counts: Partial<Record<RiskLevel, number>>;
  byType: Partial<Record<EntityType, number>>;
}
