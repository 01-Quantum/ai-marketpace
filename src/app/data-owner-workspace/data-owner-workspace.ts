import { Component, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { filter, take } from 'rxjs';
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
  List,
  LoaderCircle,
  Lock,
  LucideAngularModule,
  Network,
  Pencil,
  ShieldCheck,
  Trash2,
  User,
  X,
} from 'lucide-angular';
import { AppTopBar } from '../shared/app-top-bar/app-top-bar';
import { AuthService } from '../shared/auth.service';
import { WorkflowHeader } from '../shared/workflow-header/workflow-header';
import { FheKey, FheKeysService } from './fhe-keys.service';

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
  imports: [LucideAngularModule, FormsModule, AppTopBar, WorkflowHeader],
  templateUrl: './data-owner-workspace.html',
  styleUrl: './data-owner-workspace.css',
})
export class DataOwnerWorkspace {
  private readonly router = inject(Router);
  private readonly fheKeys = inject(FheKeysService);
  private readonly auth = inject(AuthService);

  readonly selectedModel = signal<ModelChoice>('tree');

  readonly currentKey = signal<FheKey | null>(null);
  readonly loadingKey = signal(true);
  readonly busy = signal(false);
  readonly keyError = signal('');

  readonly showKeyModal = signal(false);
  readonly editingKeyId = signal<number | null>(null);
  readonly formName = signal('');
  readonly formScheme = signal('OpenFHE CKKS');
  readonly formDepth = signal(16);

  readonly showSelectModal = signal(false);
  readonly allKeys = signal<FheKey[]>([]);
  readonly loadingAllKeys = signal(false);

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
  readonly PencilIcon = Pencil;
  readonly ListIcon = List;
  readonly LoaderIcon = LoaderCircle;
  readonly CloseIcon = X;
  readonly UserIcon = User;

  constructor() {
    // Wait until AuthService has restored the session before querying, otherwise
    // user()?.id is still null on a fresh page load and the key query returns nothing.
    toObservable(this.auth.initialized)
      .pipe(filter(Boolean), take(1))
      .subscribe(() => void this.refreshLatestKey());
  }

  private async refreshLatestKey(): Promise<void> {
    this.loadingKey.set(true);
    this.currentKey.set(await this.fheKeys.loadLatestKey());
    this.loadingKey.set(false);
  }

  formatCreated(iso: string): string {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  selectModel(next: ModelChoice): void {
    this.selectedModel.set(next);
  }

  openGenerateModal(): void {
    this.keyError.set('');
    this.editingKeyId.set(null);
    this.formName.set(this.suggestKeyName());
    this.formScheme.set('OpenFHE CKKS');
    this.formDepth.set(16);
    this.showKeyModal.set(true);
  }

  /**
   * Suggest a default key name so the user doesn't have to type one.
   * Increments the trailing number of the current key when present
   * (e.g. alice_key_01 -> alice_key_02), otherwise builds one from the username.
   */
  private suggestKeyName(): string {
    const current = this.currentKey()?.key_name;
    const match = current?.match(/^(.*?)(\d+)$/);
    if (match) {
      const [, prefix, digits] = match;
      const next = String(Number(digits) + 1).padStart(digits.length, '0');
      return `${prefix}${next}`;
    }

    const slug =
      (this.auth.displayName() || 'user')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'user';
    return `${slug}_key_01`;
  }

  openEditModal(): void {
    const key = this.currentKey();
    if (!key) return;
    this.keyError.set('');
    this.editingKeyId.set(key.id);
    this.formName.set(key.key_name);
    this.formScheme.set(key.scheme);
    this.formDepth.set(key.multiplicative_depth);
    this.showKeyModal.set(true);
  }

  closeKeyModal(): void {
    if (this.busy()) return;
    this.showKeyModal.set(false);
  }

  onModalBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeKeyModal();
  }

  isEditing(): boolean {
    return this.editingKeyId() !== null;
  }

  async saveKey(): Promise<void> {
    if (this.busy()) return;

    const name = this.formName().trim();
    if (!name) {
      this.keyError.set('Enter a key name.');
      return;
    }

    const editingId = this.editingKeyId();
    this.busy.set(true);
    this.keyError.set('');

    try {
      if (editingId !== null) {
        const updated = await this.fheKeys.updateKey(editingId, { key_name: name });
        if (!updated) {
          this.keyError.set('Could not rename the key. The name may already be in use.');
          return;
        }
        this.currentKey.set(updated);
        this.showKeyModal.set(false);
        return;
      }

      const depth = Number(this.formDepth());
      if (!Number.isInteger(depth) || depth <= 0) {
        this.keyError.set('Multiplicative depth must be a positive integer.');
        return;
      }

      const created = await this.fheKeys.generateKey({
        key_name: name,
        scheme: this.formScheme(),
        multiplicative_depth: depth,
      });
      if (!created) {
        this.keyError.set('Key generation failed. Check the vault service and try again.');
        return;
      }
      this.currentKey.set(created);
      this.showKeyModal.set(false);
    } finally {
      this.busy.set(false);
    }
  }

  async openSelectModal(): Promise<void> {
    this.showSelectModal.set(true);
    this.loadingAllKeys.set(true);
    this.allKeys.set(await this.fheKeys.loadAllKeys());
    this.loadingAllKeys.set(false);
  }

  closeSelectModal(): void {
    if (this.busy()) return;
    this.showSelectModal.set(false);
  }

  onSelectBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeSelectModal();
  }

  async selectKey(key: FheKey): Promise<void> {
    if (this.busy()) return;
    if (key.id === this.currentKey()?.id) {
      this.showSelectModal.set(false);
      return;
    }

    this.busy.set(true);
    const active = await this.fheKeys.setActiveKey(key.id);
    this.busy.set(false);

    if (active) {
      this.currentKey.set(active);
      this.showSelectModal.set(false);
    }
  }

  async deleteKey(): Promise<void> {
    const key = this.currentKey();
    if (!key || this.busy()) return;
    if (!confirm(`Delete key "${key.key_name}"? This cannot be undone.`)) return;

    this.busy.set(true);
    const ok = await this.fheKeys.deleteKey(key.id);
    this.busy.set(false);
    if (ok) await this.refreshLatestKey();
  }

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
