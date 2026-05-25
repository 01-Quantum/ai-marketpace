import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  BatchField,
  BatchTestRow,
  IRIS_PUBLISHED_TEST_DATA,
} from './iris-dataset';

@Injectable({ providedIn: 'root' })
export class IrisDataService {
  private readonly publishedTestDataSubject = new BehaviorSubject<BatchTestRow[]>(
    structuredClone(IRIS_PUBLISHED_TEST_DATA),
  );

  readonly publishedTestData$ = this.publishedTestDataSubject.asObservable();

  getPublishedTestData(): BatchTestRow[] {
    return this.publishedTestDataSubject.value;
  }

  addTestRow(): void {
    const rows = this.publishedTestDataSubject.value;
    const nextId = Math.max(0, ...rows.map((row) => row.id)) + 1;
    this.publishedTestDataSubject.next([
      ...rows,
      {
        id: nextId,
        sepal_length: 5.0,
        sepal_width: 3.0,
        petal_length: 1.4,
        petal_width: 0.2,
        expected: 'setosa',
      },
    ]);
  }

  removeTestRow(id: number): void {
    const rows = this.publishedTestDataSubject.value;
    if (rows.length <= 1) return;
    this.publishedTestDataSubject.next(rows.filter((row) => row.id !== id));
  }

  updateTestRow(id: number, field: BatchField, value: string): void {
    this.publishedTestDataSubject.next(
      this.publishedTestDataSubject.value.map((row) => {
        if (row.id !== id) return row;
        if (field === 'expected') return { ...row, expected: value };
        const parsed = Number.parseFloat(value);
        if (Number.isNaN(parsed)) return row;
        return { ...row, [field]: parsed };
      }),
    );
  }

  importPublishedTestData(): void {
    this.publishedTestDataSubject.next(structuredClone(IRIS_PUBLISHED_TEST_DATA));
  }

  publishTestData(): void {
    this.publishedTestDataSubject.next(structuredClone(this.publishedTestDataSubject.value));
  }
}
