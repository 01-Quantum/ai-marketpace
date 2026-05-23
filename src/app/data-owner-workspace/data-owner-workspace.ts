import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  ArrowRight,
  ChartScatter,
  CircleCheck,
  CircleDashed,
  CloudUpload,
  Database,
  Eye,
  FileLock,
  FileText,
  KeyRound,
  Lock,
  LucideAngularModule,
  Network,
  ShieldCheck,
  Trash2,
  User,
} from 'lucide-angular';
import { AppTopBar } from '../shared/app-top-bar/app-top-bar';
import { WorkflowHeader } from '../shared/workflow-header/workflow-header';

export type ModelChoice = 'tree' | 'logistic';

interface EncryptedDataset {
  name: string;
  owner: string;
  status: 'Encrypted';
  submittedTo: string | null;
}

@Component({
  selector: 'app-data-owner-workspace',
  standalone: true,
  imports: [LucideAngularModule, AppTopBar, WorkflowHeader],
  templateUrl: './data-owner-workspace.html',
  styleUrl: './data-owner-workspace.css',
})
export class DataOwnerWorkspace {
  private readonly router = inject(Router);

  readonly selectedModel = signal<ModelChoice>('tree');

  readonly keyInfo = {
    name: 'alice_key_01',
    scheme: 'OpenFHE CKKS',
    depth: '16',
    created: 'May 21, 2025 10:45 AM',
  };

  readonly datasets: EncryptedDataset[] = [
    { name: 'Iris Sample A', owner: 'alice', status: 'Encrypted', submittedTo: null },
    { name: 'Customer Risk Batch 01', owner: 'alice', status: 'Encrypted', submittedTo: null },
    { name: 'Fraud Features Q2', owner: 'alice', status: 'Encrypted', submittedTo: null },
  ];

  readonly ShieldCheckIcon = ShieldCheck;
  readonly KeyRoundIcon = KeyRound;
  readonly FileLockIcon = FileLock;
  readonly CloudUploadIcon = CloudUpload;
  readonly LockIcon = Lock;
  readonly ArrowRightIcon = ArrowRight;
  readonly NetworkIcon = Network;
  readonly ChartScatterIcon = ChartScatter;
  readonly CircleCheckIcon = CircleCheck;
  readonly CircleDashedIcon = CircleDashed;
  readonly FileTextIcon = FileText;
  readonly DatabaseIcon = Database;
  readonly EyeIcon = Eye;
  readonly Trash2Icon = Trash2;
  readonly UserIcon = User;

  selectModel(next: ModelChoice): void {
    this.selectedModel.set(next);
  }

  generateKeyPair(): void {}

  browseFiles(): void {}

  continueToModelOwner(): void {
    this.router.navigate(['/model-owner-workspace']);
  }

  viewDataset(_: EncryptedDataset): void {}

  deleteDataset(target: EncryptedDataset): void {
    const idx = this.datasets.indexOf(target);
    if (idx > -1) this.datasets.splice(idx, 1);
  }

  signOut(): void {}
}
