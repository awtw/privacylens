import { riskOf } from './risk';
import type { Entity } from './types';

/** Minimal EXIF subset the platforms must report. */
export interface ImageMetadata {
  latitude?: number;
  longitude?: number;
  make?: string;
  model?: string;
  software?: string;
  dateTaken?: string;
}

/** Metadata → non-visual entities (bbox null). Redaction = stripping metadata on re-encode. */
export function metadataToEntities(m: ImageMetadata): Entity[] {
  const out: Entity[] = [];
  const add = (type: 'GPS' | 'DEVICE_INFO', text: string) =>
    out.push({
      id: `${type}-${out.length}`,
      type,
      text,
      confidence: 1,
      bbox: null,
      source: 'metadata',
      riskLevel: riskOf(type),
    });
  if (typeof m.latitude === 'number' && typeof m.longitude === 'number') {
    add('GPS', `${m.latitude.toFixed(5)}, ${m.longitude.toFixed(5)}`);
  }
  const device = [m.make, m.model].filter(Boolean).join(' ').trim();
  if (device) add('DEVICE_INFO', device);
  if (m.software) add('DEVICE_INFO', `Software: ${m.software}`);
  if (m.dateTaken) add('DEVICE_INFO', `Taken: ${m.dateTaken}`);
  return out;
}
