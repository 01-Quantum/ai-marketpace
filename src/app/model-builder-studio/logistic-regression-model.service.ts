import { Injectable } from '@angular/core';
import { BehaviorSubject, of, shareReplay } from 'rxjs';
import {
  LogisticFeature,
  LogisticRegressionModel,
} from './logistic-regression-model.types';
import { LibraryModel } from './model-builder.types';

function buildMockFeatures(): LogisticFeature[] {
  const names = [
    'feature_01',
    'feature_02',
    'feature_03',
    'age',
    'income',
    'balance',
    'feature_07',
    'feature_08',
    'feature_09',
    'feature_10',
    'feature_11',
    'feature_12',
    'feature_13',
    'feature_14',
    'feature_15',
    'feature_16',
    'feature_17',
    'feature_18',
    'feature_19',
    'feature_20',
    'feature_21',
    'feature_22',
    'feature_23',
    'feature_24',
    'feature_25',
    'feature_26',
    'feature_27',
    'feature_28',
    'feature_29',
    'feature_30',
  ];

  const weights = [
    0.82, 0.71, 0.55, 0.48, -0.36, -0.29, 0.24, -0.21, 0.19, -0.17, 0.15, -0.14, 0.12, -0.11,
    0.1, -0.09, 0.08, -0.07, 0.06, -0.05, 0.05, -0.04, 0.04, -0.03, 0.03, -0.03, 0.02, -0.02,
    0.02, -0.01,
  ];

  const inputs = [
    1.2, 0.9, 1.1, 42, 85000, 12000, 0.8, 1.4, 0.6, 1.0, 0.7, 1.3, 0.5, 0.9, 1.1, 0.8, 0.6, 1.2,
    0.4, 0.7, 0.9, 1.0, 0.5, 0.8, 0.6, 0.7, 0.4, 0.5, 0.3, 0.2,
  ];

  return names.map((name, index) => ({
    name,
    weight: weights[index],
    inputValue: inputs[index],
  }));
}

const LOGISTIC_REGRESSION_MODEL: LogisticRegressionModel = {
  intercept: -0.35,
  features: buildMockFeatures(),
  classes: ['Class A', 'Class B'],
  threshold: 0.5,
};

@Injectable({ providedIn: 'root' })
export class LogisticRegressionModelService {
  private readonly modelSubject = new BehaviorSubject<LogisticRegressionModel>(
    structuredClone(LOGISTIC_REGRESSION_MODEL),
  );

  readonly model$ = this.modelSubject.asObservable();

  readonly snapshot$ = of(LOGISTIC_REGRESSION_MODEL).pipe(
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  getModel(): LogisticRegressionModel {
    return this.modelSubject.value;
  }

  getLibraryEntry(): LibraryModel {
    return {
      id: 'logreg-classifier',
      name: 'Logistic Regression',
      version: 'v1.0.0',
      updated: 'Updated 5d ago',
      iconKind: 'scatter',
      type: 'logistic',
    };
  }

  updateFeatureInput(index: number, inputValue: number): void {
    const model = this.modelSubject.value;
    this.modelSubject.next({
      ...model,
      features: model.features.map((feature, i) =>
        i === index ? { ...feature, inputValue } : feature,
      ),
    });
  }

  publishModel(): void {
    this.modelSubject.next(structuredClone(this.modelSubject.value));
  }
}
