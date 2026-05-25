import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { IRIS_FEATURE_KEYS } from './iris-dataset';
import {
  LinearFeature,
  LinearRegressionModel,
} from './linear-regression-model.types';
import { LibraryModel } from './model-builder.types';

const MOCK_COEFFICIENTS: Record<(typeof IRIS_FEATURE_KEYS)[number], number> = {
  sepal_length: -0.1119,
  sepal_width: -0.0401,
  petal_length: 0.2278,
  petal_width: 0.6092,
};

function buildIrisFeatures(): LinearFeature[] {
  return IRIS_FEATURE_KEYS.map((key) => ({
    name: key,
    weight: MOCK_COEFFICIENTS[key],
  }));
}

const IRIS_LINEAR_REGRESSION_MODEL: LinearRegressionModel = {
  intercept: 0.1865,
  features: buildIrisFeatures(),
  target: 'species_index',
  rSquared: 0.9304,
};

@Injectable({ providedIn: 'root' })
export class LinearRegressionModelService {
  private readonly modelSubject = new BehaviorSubject<LinearRegressionModel>(
    structuredClone(IRIS_LINEAR_REGRESSION_MODEL),
  );

  readonly model$ = this.modelSubject.asObservable();

  getModel(): LinearRegressionModel {
    return this.modelSubject.value;
  }

  getLibraryEntry(): LibraryModel {
    return {
      id: 'iris-linreg',
      name: 'Iris Linear Regression',
      version: 'v1.0.0',
      updated: 'Updated 1d ago',
      iconKind: 'trending',
      type: 'linear',
    };
  }

  updateIntercept(intercept: number): void {
    this.modelSubject.next({
      ...this.modelSubject.value,
      intercept,
    });
  }

  updateCoefficient(index: number, weight: number): void {
    const model = this.modelSubject.value;
    this.modelSubject.next({
      ...model,
      features: model.features.map((feature, i) =>
        i === index ? { ...feature, weight } : feature,
      ),
    });
  }

  publishModel(): void {
    this.modelSubject.next(structuredClone(this.modelSubject.value));
  }
}
