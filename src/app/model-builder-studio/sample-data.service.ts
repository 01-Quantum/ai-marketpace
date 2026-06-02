import { Injectable, inject } from '@angular/core';
import { ModelBuilderService } from './model-builder.service';
import { SampleDataRow } from './sample-data.types';

@Injectable({ providedIn: 'root' })
export class SampleDataService {
  private readonly modelBuilder = inject(ModelBuilderService);

  readonly sampleData$ = this.modelBuilder.sampleData$;

  getSampleData(): SampleDataRow[] {
    return this.modelBuilder.getSampleData();
  }

  addTestRow(): void {
    this.modelBuilder.addSampleRow();
  }

  removeTestRow(id: number): void {
    this.modelBuilder.removeSampleRow(id);
  }

  updateTestRow(id: number, field: string, value: string): void {
    this.modelBuilder.updateSampleRow(id, field, value);
  }

  resetSampleData(): void {
    this.modelBuilder.resetSampleData();
  }

  importSampleData(rows: SampleDataRow[]): void {
    this.modelBuilder.importSampleData(rows);
  }

  clearAllTestData(): void {
    this.modelBuilder.clearAllSampleData();
  }

  publishTestData(): void {
    // Test data edits are persisted via Save on the model toolbar.
  }
}
