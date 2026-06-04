import { Injectable, inject } from '@angular/core';
import { map, shareReplay } from 'rxjs';
import { ModelBuilderService } from './model-builder.service';
import { LogisticRegressionModel } from './logistic-regression-model.types';

@Injectable({ providedIn: 'root' })
export class LogisticRegressionModelService {
  private readonly modelBuilder = inject(ModelBuilderService);

  readonly model$ = this.modelBuilder.logisticModel$.pipe(
    map((model) => structuredClone(model)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  getModel(): LogisticRegressionModel {
    return structuredClone(this.modelBuilder.getCurrentLogisticModel());
  }

  updateFeatureInput(index: number, inputValue: number): void {
    this.modelBuilder.updateCurrentLogisticModel((model) => ({
      ...model,
      features: model.features.map((feature, i) =>
        i === index ? { ...feature, inputValue } : feature,
      ),
    }));
  }

  publishModel(): void {
    // Edits are held in ModelBuilderService until Save.
  }
}
