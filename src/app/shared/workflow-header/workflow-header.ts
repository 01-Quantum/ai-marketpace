import { Component, input } from '@angular/core';
import { CloudCog, FileLock, KeyRound, Lock, LucideAngularModule } from 'lucide-angular';
import { WorkflowStep } from '../workflow.types';

interface StepDefinition {
  num: WorkflowStep;
  label: string;
  icon: typeof KeyRound;
}

@Component({
  selector: 'app-workflow-header',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './workflow-header.html',
})
export class WorkflowHeader {
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

}
