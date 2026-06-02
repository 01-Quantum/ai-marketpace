import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CoefficientDesignerConfig } from '../coefficient-regression.types';
import { CoefficientRegressionDesigner } from '../coefficient-regression-designer/coefficient-regression-designer';
import { LinearRegressionModelService } from '../linear-regression-model.service';

const LINEAR_DESIGNER_CONFIG: CoefficientDesignerConfig = {
  outputVar: 'y',
  outputDescription: 'Predicted value',
  footnote:
    'Coefficients are fit on the iris dataset. Positive coefficients increase the predicted value; negative coefficients decrease it.',
  exportFileName: 'linear-coefficients.csv',
};

@Component({
  selector: 'app-linear-regression-designer',
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
export class LinearRegressionDesigner {
  private readonly linearModel = inject(LinearRegressionModelService);

  readonly designerConfig = LINEAR_DESIGNER_CONFIG;

  readonly model = toSignal(this.linearModel.model$, {
    initialValue: this.linearModel.getModel(),
  });

  readonly coefficientFeatures = computed(() =>
    this.model().features.map(({ name, weight }) => ({ name, weight })),
  );
}
