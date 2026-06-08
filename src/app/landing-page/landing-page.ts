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
  Lock,
  LucideAngularModule,
  Network,
  ShieldCheck,
} from 'lucide-angular';
import { AppTopBar } from '../shared/app-top-bar/app-top-bar';
import { AuthDialog } from '../shared/auth-dialog/auth-dialog';
import { AuthService } from '../shared/auth.service';
import { InferenceModelChoice } from '../shared/workflow.types';

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

  readonly selectedModel = signal<InferenceModelChoice>('tree');

  readonly authDialogOpen = signal(false);
  private pendingDestination: string | null = null;

  readonly ShieldCheckIcon = ShieldCheck;
  readonly CircleUserRoundIcon = CircleUserRound;
  readonly KeyRoundIcon = KeyRound;
  readonly FileLockIcon = FileLock;
  readonly CloudCogIcon = CloudCog;
  readonly LockIcon = Lock;
  readonly ArrowRightIcon = ArrowRight;
  readonly NetworkIcon = Network;
  readonly ChartScatterIcon = ChartScatter;
  readonly CircleCheckIcon = CircleCheck;
  readonly CircleIcon = Circle;

  selectModel(next: InferenceModelChoice): void {
    this.selectedModel.set(next);
  }

  continueInference(): void {
    this.goWithAuth('/data-owner-workspace', { model: this.selectedModel() });
  }

  goWithAuth(destination: string, queryParams?: Record<string, string>): void {
    if (this.auth.isAuthenticated()) {
      void this.router.navigate([destination], { queryParams });
      return;
    }
    this.pendingDestination = destination;
    this.pendingQueryParams = queryParams ?? null;
    this.authDialogOpen.set(true);
  }

  private pendingQueryParams: Record<string, string> | null = null;

  onAuthenticated(): void {
    this.authDialogOpen.set(false);
    const destination = this.pendingDestination;
    const queryParams = this.pendingQueryParams ?? undefined;
    this.pendingDestination = null;
    this.pendingQueryParams = null;
    if (destination) void this.router.navigate([destination], { queryParams });
  }

  onAuthDialogClosed(): void {
    this.authDialogOpen.set(false);
    this.pendingDestination = null;
    this.pendingQueryParams = null;
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
  }
}
