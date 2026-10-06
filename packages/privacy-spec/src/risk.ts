import type { Entity, EntityType, RiskLevel, RiskSummary } from './types';

/** Models only detect; severity is decided here (product rule, not model output). */
export const SEVERITY: Record<EntityType, RiskLevel> = {
  TW_NATIONAL_ID: 'critical',
  CREDIT_CARD: 'critical',
  BANK_ACCOUNT: 'high',
  PHONE: 'high',
  ADDRESS: 'high',
  GPS: 'high',
  FACE: 'high',
  EMAIL: 'medium',
  PERSON: 'medium',
  QR_CODE: 'medium',
  BARCODE: 'medium',
  DEVICE_INFO: 'medium',
  IP_ADDRESS: 'medium',
  ID_NUMBER: 'medium',
  USERNAME: 'medium',
  CUSTOM: 'high',
  ORGANIZATION: 'low',
  LOCATION: 'low',
  URL: 'low',
};

export const RISK_ORDER: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
const WEIGHT: Record<RiskLevel, number> = { low: 5, medium: 15, high: 30, critical: 50 };

export function riskOf(type: EntityType): RiskLevel {
  return SEVERITY[type];
}

export function summarizeRisk(entities: Entity[]): RiskSummary {
  const counts: RiskSummary['counts'] = {};
  const byType: RiskSummary['byType'] = {};
  let top = -1;
  let score = 0;
  for (const e of entities) {
    counts[e.riskLevel] = (counts[e.riskLevel] ?? 0) + 1;
    byType[e.type] = (byType[e.type] ?? 0) + 1;
    top = Math.max(top, RISK_ORDER.indexOf(e.riskLevel));
    score += WEIGHT[e.riskLevel];
  }
  return {
    level: top < 0 ? 'none' : RISK_ORDER[top]!,
    score: Math.min(100, score),
    counts,
    byType,
  };
}
