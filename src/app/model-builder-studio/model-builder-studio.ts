import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ChartScatter,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Info,
  LucideAngularModule,
  MoreVertical,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Plus,
  ShieldCheck,
} from 'lucide-angular';
import { AppTopBar } from '../shared/app-top-bar/app-top-bar';
import { DecisionTreeDesigner } from './decision-tree-designer/decision-tree-designer';
import { DecisionTreeModelService } from './decision-tree-model.service';
import { ModelBuilderService } from './model-builder.service';
import { LibraryModel } from './model-builder.types';
import { ModelSidebarPanel } from './model-sidebar-panel/model-sidebar-panel';

const LIBRARY_ICONS: Record<LibraryModel['iconKind'], typeof Network> = {
  tree: Network,
  scatter: ChartScatter,
  shield: ShieldCheck,
};

@Component({
  selector: 'app-model-builder-studio',
  standalone: true,
  imports: [
    LucideAngularModule,
    AppTopBar,
    DecisionTreeDesigner,
    ModelSidebarPanel,
  ],
  templateUrl: './model-builder-studio.html',
  styleUrl: './model-builder-studio.css',
})
export class ModelBuilderStudio {
  private readonly modelBuilder = inject(ModelBuilderService);
  private readonly decisionTreeModel = inject(DecisionTreeModelService);

  readonly libraryItems = toSignal(this.modelBuilder.libraryModels$, {
    initialValue: [] as LibraryModel[],
  });
  readonly selectedLibraryId = toSignal(this.modelBuilder.selectedModelId$, {
    initialValue: 'iris-dt',
  });
  readonly selectedModel = toSignal(this.modelBuilder.selectedModel$, { initialValue: null });

  readonly editingName = signal(false);
  readonly nameDraft = signal('');
  readonly libraryCollapsed = signal(false);
  readonly propertiesCollapsed = signal(false);

  readonly NetworkIcon = Network;
  readonly ShieldCheckIcon = ShieldCheck;
  readonly PlusIcon = Plus;
  readonly MoreVerticalIcon = MoreVertical;
  readonly CircleHelpIcon = CircleHelp;
  readonly InfoIcon = Info;
  readonly ChevronDownIcon = ChevronDown;
  readonly ChevronRightIcon = ChevronRight;
  readonly PencilIcon = Pencil;
  readonly CheckIcon = Check;
  readonly PanelLeftCloseIcon = PanelLeftClose;
  readonly PanelLeftOpenIcon = PanelLeftOpen;
  readonly PanelRightCloseIcon = PanelRightClose;
  readonly PanelRightOpenIcon = PanelRightOpen;

  toggleLibrary(): void {
    this.libraryCollapsed.update((value) => !value);
  }

  toggleProperties(): void {
    this.propertiesCollapsed.update((value) => !value);
  }

  selectLibrary(id: string): void {
    this.modelBuilder.selectModel(id);
    this.editingName.set(false);
  }

  startEditingName(): void {
    const model = this.selectedModel();
    if (!model) return;
    this.nameDraft.set(model.name);
    this.editingName.set(true);
  }

  saveModelName(): void {
    this.modelBuilder.renameModel(this.nameDraft());
    this.editingName.set(false);
  }

  cancelEditingName(): void {
    this.editingName.set(false);
  }

  onNameDraftInput(event: Event): void {
    this.nameDraft.set((event.target as HTMLInputElement).value);
  }

  onNameKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.saveModelName();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelEditingName();
    }
  }

  iconForLibrary(kind: LibraryModel['iconKind']): typeof Network {
    return LIBRARY_ICONS[kind];
  }

  signOut(): void {}

  publishToEnclave(): void {
    this.decisionTreeModel.publishTestData();
  }
}
