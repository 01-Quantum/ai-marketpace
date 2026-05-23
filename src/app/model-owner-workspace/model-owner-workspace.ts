import { DecimalPipe } from '@angular/common';
import { Component, signal } from '@angular/core';
import {
  ChartScatter,
  CircleCheck,
  CircleDashed,
  CircleDot,
  Clock,
  CloudCog,
  Database,
  Download,
  FileLock,
  KeyRound,
  ListChecks,
  LoaderCircle,
  Lock,
  LucideAngularModule,
  Network,
  Play,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-angular';
import { AppTopBar } from '../shared/app-top-bar/app-top-bar';
import { WorkflowHeader } from '../shared/workflow-header/workflow-header';

export type ModelChoice = 'tree' | 'logistic';

interface IncomingDataset {
  name: string;
  submittedBy: string;
  model: string;
  status: 'FHE Encrypted';
  records: number;
  submittedAt: string;
}

type JobStatus = 'queued' | 'running' | 'completed';

interface InferenceJob {
  jobId: string;
  dataset: string;
  model: string;
  status: JobStatus;
  startedAt: string | null;
  completedAt: string | null;
}

@Component({
  selector: 'app-model-owner-workspace',
  standalone: true,
  imports: [LucideAngularModule, DecimalPipe, AppTopBar, WorkflowHeader],
  templateUrl: './model-owner-workspace.html',
  styleUrl: './model-owner-workspace.css',
})
export class ModelOwnerWorkspace {
  readonly selectedModel = signal<ModelChoice>('tree');

  readonly datasets: IncomingDataset[] = [
    {
      name: 'Loan_Applications_May',
      submittedBy: 'alice',
      model: 'Decision Tree',
      status: 'FHE Encrypted',
      records: 12_540,
      submittedAt: 'May 21, 2025 09:14 AM',
    },
    {
      name: 'Credit_Risk_Q2',
      submittedBy: 'alice',
      model: 'Decision Tree',
      status: 'FHE Encrypted',
      records: 8_231,
      submittedAt: 'May 20, 2025 04:42 PM',
    },
    {
      name: 'Customer_Onboarding_Apr',
      submittedBy: 'alice',
      model: 'Decision Tree',
      status: 'FHE Encrypted',
      records: 5_812,
      submittedAt: 'May 19, 2025 11:03 AM',
    },
  ];

  readonly jobs: InferenceJob[] = [
    {
      jobId: 'job_9f3e7a1c',
      dataset: 'Loan_Applications_May',
      model: 'Decision Tree',
      status: 'queued',
      startedAt: 'May 21, 2025 09:15 AM',
      completedAt: null,
    },
    {
      jobId: 'job_4b2d9c8e',
      dataset: 'Credit_Risk_Q2',
      model: 'Decision Tree',
      status: 'running',
      startedAt: 'May 21, 2025 09:16 AM',
      completedAt: null,
    },
    {
      jobId: 'job_a7c5d2f9',
      dataset: 'Customer_Onboarding_Apr',
      model: 'Decision Tree',
      status: 'completed',
      startedAt: 'May 20, 2025 02:34 PM',
      completedAt: 'May 20, 2025 02:37 PM',
    },
  ];

  readonly ShieldCheckIcon = ShieldCheck;
  readonly ShieldAlertIcon = ShieldAlert;
  readonly FileLockIcon = FileLock;
  readonly CloudCogIcon = CloudCog;
  readonly LockIcon = Lock;
  readonly NetworkIcon = Network;
  readonly ChartScatterIcon = ChartScatter;
  readonly CircleCheckIcon = CircleCheck;
  readonly CircleDashedIcon = CircleDashed;
  readonly CircleDotIcon = CircleDot;
  readonly DatabaseIcon = Database;
  readonly ListChecksIcon = ListChecks;
  readonly ClockIcon = Clock;
  readonly LoaderIcon = LoaderCircle;
  readonly DownloadIcon = Download;
  readonly PlayIcon = Play;
  readonly KeyRoundIcon = KeyRound;

  selectModel(next: ModelChoice): void {
    this.selectedModel.set(next);
  }

  runInference(_dataset: IncomingDataset): void {}

  saveResult(_job: InferenceJob): void {}

  signOut(): void {}
}
