import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Info, LucideAngularModule, Sigma, Target, TrendingUp } from 'lucide-angular';
import { LinearRegressionModelService } from '../linear-regression-model.service';

function formatSigned(value: number, decimals = 4): string {
  const fixed = value.toFixed(decimals);
  return value > 0 ? `+${fixed}` : fixed;
}

function formatPlain(value: number, decimals = 4): string {
  return value.toFixed(decimals);
}

@Component({
  selector: 'app-linear-regression-designer',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './linear-regression-designer.html',
  styleUrl: './linear-regression-designer.css',
})
export class LinearRegressionDesigner {
  private readonly linearModel = inject(LinearRegressionModelService);

  readonly model = toSignal(this.linearModel.model$, {
    initialValue: this.linearModel.getModel(),
  });

  readonly SigmaIcon = Sigma;
  readonly TargetIcon = Target;
  readonly TrendingIcon = TrendingUp;
  readonly InfoIcon = Info;

  readonly features = computed(() => this.model().features);

  readonly maxAbsCoef = computed(() => {
    const rows = this.features();
    if (!rows.length) return 1;
    return Math.max(...rows.map((row) => Math.abs(row.weight)), 0.001);
  });

  formatCoef = formatSigned;
  formatIntercept = formatSigned;
  formatScore = formatPlain;

  impactWidth(weight: number, max: number): number {
    return Math.min(100, (Math.abs(weight) / max) * 100);
  }
}
