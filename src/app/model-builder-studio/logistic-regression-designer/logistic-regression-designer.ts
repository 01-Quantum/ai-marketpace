import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CoefficientDesignerConfig } from '../coefficient-regression.types';
import { CoefficientRegressionDesigner } from '../coefficient-regression-designer/coefficient-regression-designer';
import { LogisticRegressionModelService } from '../logistic-regression-model.service';

const LOGISTIC_DESIGNER_CONFIG: CoefficientDesignerConfig = {
  outputVar: 'z',
  outputDescription: 'Linear score (log-odds)',
  featureBadgeSuffix: '+',
  footnote:
    'Weights are learned on standardized features. Positive coefficients increase the predicted score; negative coefficients decrease it.',
  exportFileName: 'logistic-coefficients.csv',
};

@Component({
  selector: 'app-logistic-regression-designer',
  standalone: true,
  imports: [CoefficientRegressionDesigner],
  template: `
    <app-coefficient-regression-designer
      [features]="coefficientFeatures()"
      [intercept]="model().intercept"
      [config]="designerConfig"
    />
  `,
})
export class LogisticRegressionDesigner {
  private readonly logisticModel = inject(LogisticRegressionModelService);

  readonly designerConfig = LOGISTIC_DESIGNER_CONFIG;

  readonly model = toSignal(this.logisticModel.model$, {
    initialValue: this.logisticModel.getModel(),
  });

  readonly coefficientFeatures = computed(() =>
    this.model().features.map(({ name, weight }) => ({ name, weight })),
  );
}
