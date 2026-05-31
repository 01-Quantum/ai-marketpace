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
import { AuthDialog } from '../shared/auth-dialog/auth-dialog';
import { AuthService } from '../shared/auth.service';
import { WorkflowRole } from '../shared/workflow.types';

export type ModelChoice = 'tree' | 'logistic';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [LucideAngularModule, AppTopBar, AuthDialog],
  templateUrl: './landing-page.html',
  styleUrl: './landing-page.css',
})
export class LandingPage {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly role = signal<WorkflowRole>('data');
  readonly selectedModel = signal<ModelChoice>('tree');

  readonly authDialogOpen = signal(false);
  private pendingDestination: string | null = null;

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
      this.goWithAuth('/model-builder-studio');
    }
  }

  selectModel(next: ModelChoice): void {
    this.selectedModel.set(next);
  }

  continueInference(): void {
    const destination =
      this.role() === 'model' ? '/model-builder-studio' : '/data-owner-workspace';
    this.goWithAuth(destination);
  }

  onAuthenticated(): void {
    this.authDialogOpen.set(false);
    const destination = this.pendingDestination;
    this.pendingDestination = null;
    if (destination) this.router.navigate([destination]);
  }

  onAuthDialogClosed(): void {
    this.authDialogOpen.set(false);
    this.pendingDestination = null;
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
  }

  private goWithAuth(destination: string): void {
    if (this.auth.isAuthenticated()) {
      this.router.navigate([destination]);
      return;
    }
    this.pendingDestination = destination;
    this.authDialogOpen.set(true);
  }
}
