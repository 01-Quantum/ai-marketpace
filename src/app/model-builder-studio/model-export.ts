import { ModelType } from './model-builder.types';
import { SampleDataDocument } from './sample-data.types';

export interface ModelExportDocument {
  name: string;
  type: ModelType;
  version: string;
  model_json: unknown;
  sample_data: SampleDataDocument;
  exported_at: string;
}

const MODEL_TYPES: ModelType[] = ['tree', 'logistic', 'linear'];

function isModelType(value: unknown): value is ModelType {
  return typeof value === 'string' && MODEL_TYPES.includes(value as ModelType);
}

function normalizeSampleData(value: unknown): SampleDataDocument {
  if (value && typeof value === 'object' && Array.isArray((value as SampleDataDocument).rows)) {
    return { rows: structuredClone((value as SampleDataDocument).rows) };
  }
  return { rows: [] };
}

/** Parse a JSON model file (studio export or Supabase-shaped payload). */
export function parseModelExportDocument(json: unknown): ModelExportDocument | null {
  if (!json || typeof json !== 'object') return null;
  const doc = json as Record<string, unknown>;

  if (typeof doc['name'] === 'string' && isModelType(doc['type'])) {
    const name = doc['name'].trim();
    if (!name) return null;
    return {
      name,
      type: doc['type'],
      version: typeof doc['version'] === 'string' && doc['version'].trim() ? doc['version'] : 'v1.0.0',
      model_json: doc['model_json'] ?? null,
      sample_data: normalizeSampleData(doc['sample_data']),
      exported_at:
        typeof doc['exported_at'] === 'string' ? doc['exported_at'] : new Date().toISOString(),
    };
  }

  if (typeof doc['model_name'] === 'string' && isModelType(doc['model_type'])) {
    const name = doc['model_name'].trim();
    if (!name) return null;
    return {
      name,
      type: doc['model_type'],
      version: 'v1.0.0',
      model_json: doc['model_json'] ?? null,
      sample_data: normalizeSampleData(doc['sample_data']),
      exported_at: new Date().toISOString(),
    };
  }

  return null;
}

export function downloadModelExport(doc: ModelExportDocument): void {
  const slug = doc.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const filename = `${slug || 'model'}-export.json`;
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
