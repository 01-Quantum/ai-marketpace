import { Component, signal } from '@angular/core';
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

export type DemoRole = 'data' | 'model';
export type ModelChoice = 'tree' | 'logistic';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './landing-page.html',
  styleUrl: './landing-page.css',
})
export class LandingPage {
  readonly role = signal<DemoRole>('data');
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

  setRole(next: DemoRole): void {
    this.role.set(next);
  }

  selectModel(next: ModelChoice): void {
    this.selectedModel.set(next);
  }

  continueDemo(): void {}

  signOut(): void {}
}
