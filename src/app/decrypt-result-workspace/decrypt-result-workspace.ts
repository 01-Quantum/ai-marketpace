import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  ArrowRight,
  Box,
  Check,
  CircleCheck,
  Database,
  Info,
  Leaf,
  Lock,
  LucideAngularModule,
  Monitor,
  RefreshCw,
  ShieldCheck,
  User,
} from 'lucide-angular';
import { AppTopBar } from '../shared/app-top-bar/app-top-bar';
import { WorkflowHeader } from '../shared/workflow-header/workflow-header';

interface AuditEvent {
  label: string;
  time: string;
  status: 'completed' | 'current';
}

@Component({
  selector: 'app-decrypt-result-workspace',
  standalone: true,
  imports: [LucideAngularModule, AppTopBar, WorkflowHeader],
  templateUrl: './decrypt-result-workspace.html',
  styleUrl: './decrypt-result-workspace.css',
})
export class DecryptResultWorkspace {
  private readonly router = inject(Router);

  readonly decrypted = signal(true);

  readonly ciphertextLines: string[] = [
    '0x9f3a7b6c2d8e4f11a98b3d7c0e1f2a6b9c...',
    '0x7a1b2c3d4e5f67890 1a2b3c4d5e6f7890...',
    '0x2d3c4b5a69788796a b1c2d3e4f5a6b7c8...',
    '0x6e1f2d3c4b5a69788 9a0b1c2d3e4f5a6b...',
  ];

  readonly auditTrail: AuditEvent[] = [
    { label: 'Upload & Encrypt', time: '10:41:02', status: 'completed' },
    { label: 'Submitted to Enclave', time: '10:41:05', status: 'completed' },
    { label: 'Inference Completed', time: '10:42:28', status: 'completed' },
    { label: 'Result Decrypted', time: '10:42:39', status: 'current' },
  ];

  readonly LeafIcon = Leaf;
  readonly LockIcon = Lock;
  readonly DatabaseIcon = Database;
  readonly CheckIcon = Check;
  readonly BoxIcon = Box;
  readonly ShieldCheckIcon = ShieldCheck;
  readonly CircleCheckIcon = CircleCheck;
  readonly RefreshCwIcon = RefreshCw;
  readonly InfoIcon = Info;
  readonly UserIcon = User;
  readonly MonitorIcon = Monitor;
  readonly ArrowRightIcon = ArrowRight;

  decrypt(): void {
    this.decrypted.set(true);
  }

  runAnother(): void {
    this.router.navigate(['/data-owner-workspace']);
  }

  signOut(): void {}
}
