import exifr from 'exifr';
import { metadataToEntities, type Entity, type ImageMetadata } from '@privacylens/privacy-spec';

/** Reads EXIF locally. Failures (no EXIF, unsupported format) just mean "no metadata". */
export async function scanMetadata(file: File): Promise<Entity[]> {
  try {
    const d = await exifr.parse(file, { gps: true, tiff: true, exif: true, pick: ['latitude', 'longitude', 'Make', 'Model', 'Software', 'DateTimeOriginal'] });
    if (!d) return [];
    const meta: ImageMetadata = {
      latitude: d.latitude,
      longitude: d.longitude,
      make: d.Make,
      model: d.Model,
      software: d.Software,
      dateTaken: d.DateTimeOriginal instanceof Date ? d.DateTimeOriginal.toISOString() : undefined,
    };
    return metadataToEntities(meta);
  } catch {
    return [];
  }
}
