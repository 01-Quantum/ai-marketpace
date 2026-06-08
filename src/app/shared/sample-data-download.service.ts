import { Injectable } from '@angular/core';
import {
  SampleDataRow,
  parseSampleDataDocument,
  sampleDataToCsv,
} from '../model-builder-studio/sample-data.types';

@Injectable({ providedIn: 'root' })
export class SampleDataDownloadService {
  rowsFromDocument(sampleData: unknown): SampleDataRow[] {
    return parseSampleDataDocument(sampleData);
  }

  hasSampleRows(sampleData: unknown): boolean {
    return this.rowsFromDocument(sampleData).length > 0;
  }

  buildFilename(modelName: string): string {
    const slug = modelName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `${slug || 'model'}-sample-data.csv`;
  }

  downloadCsv(rows: SampleDataRow[], modelName: string): boolean {
    if (!rows.length) return false;

    const csv = sampleDataToCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = this.buildFilename(modelName);
    anchor.click();
    URL.revokeObjectURL(url);
    return true;
  }

  downloadFromDocument(sampleData: unknown, modelName: string): boolean {
    return this.downloadCsv(this.rowsFromDocument(sampleData), modelName);
  }
}
