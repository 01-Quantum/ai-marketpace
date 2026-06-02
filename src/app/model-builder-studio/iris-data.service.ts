import { Injectable, inject } from '@angular/core';
import { ModelBuilderService } from './model-builder.service';
import { SampleDataRow } from './sample-data.types';

@Injectable({ providedIn: 'root' })
export class IrisDataService {
  private readonly modelBuilder = inject(ModelBuilderService);

  readonly publishedTestData$ = this.modelBuilder.sampleData$;

  getPublishedTestData(): SampleDataRow[] {
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

  importPublishedTestData(): void {
    this.modelBuilder.resetSampleData();
  }

  publishTestData(): void {
    // Test data edits are persisted via Save on the model toolbar.
  }
}
