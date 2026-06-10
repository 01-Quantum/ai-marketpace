import { Component, inject, input } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CloudCog, FileLock, KeyRound, Lock, LucideAngularModule } from 'lucide-angular';
import { WorkflowStep } from '../workflow.types';

interface StepDefinition {
  num: WorkflowStep;
  label: string;
  icon: typeof KeyRound;
}

const STEP_ROUTES: Record<WorkflowStep, string> = {
  1: '/data-owner-workspace',
  2: '/data-owner-workspace',
  3: '/model-owner-workspace',
  4: '/decrypt-result-workspace',
};

@Component({
  selector: 'app-workflow-header',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './workflow-header.html',
})
export class WorkflowHeader {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly activeThrough = input.required<WorkflowStep>();
  readonly currentStep = input<WorkflowStep>();

  readonly steps: StepDefinition[] = [
    { num: 1, label: 'Generate Key Pair', icon: KeyRound },
    { num: 2, label: 'Upload & Encrypt Data', icon: FileLock },
    { num: 3, label: 'Run Encrypted Inference', icon: CloudCog },
    { num: 4, label: 'Decrypt Result', icon: Lock },
  ];

  isActive(step: WorkflowStep): boolean {
    return step <= this.activeThrough();
  }

  isCurrent(step: WorkflowStep): boolean {
    return this.currentStep() === step;
  }

  stepStatus(step: WorkflowStep): string {
    return step <= this.activeThrough() ? 'Active' : 'Upcoming';
  }

  navigateToStep(step: WorkflowStep): void {
    const model = this.route.snapshot.queryParamMap.get('model');
    const modelId = this.route.snapshot.queryParamMap.get('modelId');
    const encryptedDatasetId = this.route.snapshot.queryParamMap.get('encryptedDatasetId');

    void this.router.navigate([STEP_ROUTES[step]], {
      queryParams: {
        ...(model ? { model } : {}),
        ...(modelId ? { modelId } : {}),
        ...(encryptedDatasetId ? { encryptedDatasetId } : {}),
      },
    });
  }
}
