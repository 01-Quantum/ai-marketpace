import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ChartScatter,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Info,
  LucideAngularModule,
  MoreVertical,
  Network,
  Plus,
  ShieldCheck,
} from 'lucide-angular';
import { AppTopBar } from '../shared/app-top-bar/app-top-bar';
import { DecisionTreeDesigner } from './decision-tree-designer/decision-tree-designer';
import { ModelBuilderService } from './model-builder.service';
import { LibraryModel, ModelType } from './model-builder.types';
import { NodeProperties } from './node-properties/node-properties';

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
    NodeProperties,
  ],
  templateUrl: './model-builder-studio.html',
  styleUrl: './model-builder-studio.css',
})
export class ModelBuilderStudio {
  private readonly modelBuilder = inject(ModelBuilderService);

  readonly libraryItems = toSignal(this.modelBuilder.libraryModels$, {
    initialValue: [] as LibraryModel[],
  });
  readonly selectedLibraryId = toSignal(this.modelBuilder.selectedModelId$, {
    initialValue: 'iris-dt',
  });
  readonly modelType = toSignal(this.modelBuilder.modelType$, {
    initialValue: 'tree' as ModelType,
  });

  readonly ChartScatterIcon = ChartScatter;
  readonly NetworkIcon = Network;
  readonly ShieldCheckIcon = ShieldCheck;
  readonly PlusIcon = Plus;
  readonly MoreVerticalIcon = MoreVertical;
  readonly CircleHelpIcon = CircleHelp;
  readonly InfoIcon = Info;
  readonly ChevronDownIcon = ChevronDown;
  readonly ChevronRightIcon = ChevronRight;

  setModelType(type: ModelType): void {
    this.modelBuilder.setModelType(type);
  }

  selectLibrary(id: string): void {
    this.modelBuilder.selectModel(id);
  }

  iconForLibrary(kind: LibraryModel['iconKind']): typeof Network {
    return LIBRARY_ICONS[kind];
  }

  signOut(): void {}
}
