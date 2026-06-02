import { Injectable, inject } from '@angular/core';
import { map, shareReplay } from 'rxjs';
import { ModelBuilderService } from './model-builder.service';
import { LinearRegressionModel } from './linear-regression-model.types';

@Injectable({ providedIn: 'root' })
export class LinearRegressionModelService {
  private readonly modelBuilder = inject(ModelBuilderService);

  readonly model$ = this.modelBuilder.linearModel$.pipe(
    map((model) => structuredClone(model)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  getModel(): LinearRegressionModel {
    return structuredClone(this.modelBuilder.getCurrentLinearModel());
  }

  updateIntercept(intercept: number): void {
    this.modelBuilder.updateCurrentLinearModel((model) => ({ ...model, intercept }));
  }

  updateCoefficient(index: number, weight: number): void {
    this.modelBuilder.updateCurrentLinearModel((model) => ({
      ...model,
      features: model.features.map((feature, i) =>
        i === index ? { ...feature, weight } : feature,
      ),
    }));
  }

  publishModel(): void {
    // Edits are held in ModelBuilderService until Save.
  }
}
