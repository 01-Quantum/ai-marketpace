import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  ArrowRight,
  ChartScatter,
  CircleCheck,
  CircleDashed,
  CloudCog,
  CloudUpload,
  Database,
  Eye,
  FileLock,
  FileText,
  KeyRound,
  Landmark,
  Lock,
  LucideAngularModule,
  Network,
  ShieldCheck,
  Trash2,
  User,
} from 'lucide-angular';

export type ModelChoice = 'tree' | 'logistic';
export type WorkflowRole = 'data' | 'model';

interface EncryptedDataset {
  name: string;
  owner: string;
  status: 'Encrypted';
  submittedTo: string | null;
}

@Component({
  selector: 'app-data-owner-workspace',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './data-owner-workspace.html',
  styleUrl: './data-owner-workspace.css',
})
export class DataOwnerWorkspace {
  private readonly router = inject(Router);

  readonly role = signal<WorkflowRole>('data');
  readonly selectedModel = signal<ModelChoice>('tree');

  readonly keyInfo = {
    name: 'alice_demo_key_01',
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
  readonly UserIcon = User;
  readonly KeyRoundIcon = KeyRound;
  readonly LandmarkIcon = Landmark;
  readonly FileLockIcon = FileLock;
  readonly CloudCogIcon = CloudCog;
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

  selectModel(next: ModelChoice): void {
    this.selectedModel.set(next);
  }

  setRole(next: WorkflowRole): void {
    this.role.set(next);
    if (next === 'model') {
      this.router.navigate(['/model-owner-workspace']);
    }
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
