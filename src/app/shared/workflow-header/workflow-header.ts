import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import {
  CloudCog,
  FileLock,
  KeyRound,
  Landmark,
  Lock,
  LucideAngularModule,
  User,
} from 'lucide-angular';
import { WorkflowRole, WorkflowStep } from '../workflow.types';

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
  private readonly router = inject(Router);

  readonly activeThrough = input.required<WorkflowStep>();
  readonly currentStep = input<WorkflowStep>();
  readonly role = input.required<WorkflowRole>();

  readonly steps: StepDefinition[] = [
    { num: 1, label: 'Generate Key Pair', icon: KeyRound },
    { num: 2, label: 'Upload & Encrypt Data', icon: FileLock },
    { num: 3, label: 'Run Encrypted Inference', icon: CloudCog },
    { num: 4, label: 'Decrypt Result', icon: Lock },
  ];

  readonly UserIcon = User;
  readonly LandmarkIcon = Landmark;

  isActive(step: WorkflowStep): boolean {
    return step <= this.activeThrough();
  }

  isCurrent(step: WorkflowStep): boolean {
    return this.currentStep() === step;
  }

  stepStatus(step: WorkflowStep): string {
    return step <= this.activeThrough() ? 'Active' : 'Upcoming';
  }

  setRole(next: WorkflowRole): void {
    if (next === 'data') {
      this.router.navigate(['/data-owner-workspace']);
      return;
    }

    this.router.navigate(['/model-owner-workspace']);
  }
}
