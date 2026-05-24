import { Injectable } from '@angular/core';
import { BehaviorSubject, of, shareReplay } from 'rxjs';
import { BatchTestRow, DecisionTreeModel } from './decision-tree-model.types';
import { LibraryModel } from './model-builder.types';

const IRIS_DECISION_TREE_MODEL: DecisionTreeModel = {
  features: [
    'sepal length (cm)',
    'sepal width (cm)',
    'petal length (cm)',
    'petal width (cm)',
  ],
  classes: ['setosa', 'versicolor', 'virginica'],
  tree: {
    type: 'split',
    feature_index: 2,
    threshold: 2.449999988079071,
    left: {
      type: 'leaf',
      class_index: 0,
    },
    right: {
      type: 'split',
      feature_index: 3,
      threshold: 1.6500000357627869,
      left: {
        type: 'split',
        feature_index: 2,
        threshold: 4.950000047683716,
        left: {
          type: 'leaf',
          class_index: 1,
        },
        right: {
          type: 'leaf',
          class_index: 2,
        },
      },
      right: {
        type: 'split',
        feature_index: 2,
        threshold: 4.8500001430511475,
        left: {
          type: 'leaf',
          class_index: 2,
        },
        right: {
          type: 'leaf',
          class_index: 2,
        },
      },
    },
  },
};

const IRIS_PUBLISHED_TEST_DATA: BatchTestRow[] = [
  { id: 1, sepal_length: 5.1, sepal_width: 3.5, petal_length: 1.4, petal_width: 0.2, expected: 'setosa' },
  { id: 2, sepal_length: 4.9, sepal_width: 3.0, petal_length: 1.4, petal_width: 0.2, expected: 'setosa' },
  { id: 3, sepal_length: 4.7, sepal_width: 3.2, petal_length: 1.3, petal_width: 0.2, expected: 'setosa' },
  { id: 4, sepal_length: 6.0, sepal_width: 2.9, petal_length: 4.5, petal_width: 1.5, expected: 'versicolor' },
  { id: 5, sepal_length: 5.5, sepal_width: 2.4, petal_length: 3.8, petal_width: 1.1, expected: 'versicolor' },
  { id: 6, sepal_length: 6.3, sepal_width: 3.3, petal_length: 6.0, petal_width: 2.5, expected: 'virginica' },
  { id: 7, sepal_length: 6.5, sepal_width: 3.0, petal_length: 5.8, petal_width: 2.2, expected: 'virginica' },
];

type BatchField = keyof Omit<BatchTestRow, 'id' | 'expected'> | 'expected';

@Injectable({ providedIn: 'root' })
export class DecisionTreeModelService {
  private readonly publishedTestDataSubject = new BehaviorSubject<BatchTestRow[]>(
    structuredClone(IRIS_PUBLISHED_TEST_DATA),
  );

  readonly model$ = of(IRIS_DECISION_TREE_MODEL).pipe(
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly publishedTestData$ = this.publishedTestDataSubject.asObservable();

  getModel(): DecisionTreeModel {
    return IRIS_DECISION_TREE_MODEL;
  }

  getLibraryEntry(): LibraryModel {
    return {
      id: 'iris-dt',
      name: 'Iris Decision Tree',
      version: 'v1.2.0',
      updated: 'Updated 2d ago',
      iconKind: 'tree',
      type: 'tree',
    };
  }

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
