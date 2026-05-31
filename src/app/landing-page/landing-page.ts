import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  ArrowRight,
  ChartScatter,
  CircleCheck,
  CircleUserRound,
  Circle,
  CloudCog,
  FileLock,
  KeyRound,
  Landmark,
  Lock,
  LucideAngularModule,
  Network,
  ShieldCheck,
  User,
} from 'lucide-angular';
import { AppTopBar } from '../shared/app-top-bar/app-top-bar';
import { WorkflowRole } from '../shared/workflow.types';

export type ModelChoice = 'tree' | 'logistic';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [LucideAngularModule, AppTopBar],
  templateUrl: './landing-page.html',
  styleUrl: './landing-page.css',
})
export class LandingPage {
  private readonly router = inject(Router);

  readonly role = signal<WorkflowRole>('data');
  readonly selectedModel = signal<ModelChoice>('tree');

  readonly ShieldCheckIcon = ShieldCheck;
  readonly CircleUserRoundIcon = CircleUserRound;
  readonly UserIcon = User;
  readonly LandmarkIcon = Landmark;
  readonly KeyRoundIcon = KeyRound;
  readonly FileLockIcon = FileLock;
  readonly CloudCogIcon = CloudCog;
  readonly LockIcon = Lock;
  readonly ArrowRightIcon = ArrowRight;
  readonly NetworkIcon = Network;
  readonly ChartScatterIcon = ChartScatter;
  readonly CircleCheckIcon = CircleCheck;
  readonly CircleIcon = Circle;

  setRole(next: WorkflowRole): void {
    this.role.set(next);
    if (next === 'model') {
      this.router.navigate(['/model-builder-studio']);
    }
  }

  selectModel(next: ModelChoice): void {
    this.selectedModel.set(next);
  }

  continueInference(): void {
    const destination =
      this.role() === 'model' ? '/model-builder-studio' : '/data-owner-workspace';
    this.router.navigate([destination]);
  }

  signOut(): void {}
}
