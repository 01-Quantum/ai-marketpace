export interface SampleDataRow {
  id: number;
  expected: string;
  [field: string]: number | string;
}

export interface SampleDataDocument {
  rows: SampleDataRow[];
}

export function parseSampleDataDocument(json: unknown): SampleDataRow[] {
  if (!json || typeof json !== 'object') return [];
  const rows = (json as SampleDataDocument).rows;
  if (!Array.isArray(rows) || rows.length === 0) return [];
  return structuredClone(rows);
}

export function toSampleDataDocument(rows: SampleDataRow[]): SampleDataDocument {
  return { rows: structuredClone(rows) };
}

export function sampleRowFields(row: SampleDataRow | undefined): string[] {
  if (!row) return [];
  return Object.keys(row).filter((key) => key !== 'id');
}
