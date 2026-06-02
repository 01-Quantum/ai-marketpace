import { Component, computed, input, signal } from '@angular/core';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  LucideAngularModule,
  Search,
  Sigma,
} from 'lucide-angular';
import {
  CoefficientDesignerConfig,
  CoefficientFeature,
  CoefficientFeatureFilter,
} from '../coefficient-regression.types';

const PAGE_SIZE_OPTIONS = [10, 20, 30] as const;

function formatSigned(value: number, decimals = 3): string {
  const fixed = value.toFixed(decimals);
  return value > 0 ? `+${fixed}` : fixed;
}

function formatPlain(value: number, decimals = 3): string {
  return value.toFixed(decimals);
}

@Component({
  selector: 'app-coefficient-regression-designer',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './coefficient-regression-designer.html',
  styleUrl: './coefficient-regression-designer.css',
})
export class CoefficientRegressionDesigner {
  readonly features = input.required<CoefficientFeature[]>();
  readonly intercept = input.required<number>();
  readonly config = input.required<CoefficientDesignerConfig>();

  readonly searchQuery = signal('');
  readonly featureFilter = signal<CoefficientFeatureFilter>('all');
  readonly page = signal(1);
  readonly pageSize = signal<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  readonly chartDirection = signal<'positive' | 'negative'>('positive');

  readonly SigmaIcon = Sigma;
  readonly SearchIcon = Search;
  readonly DownloadIcon = Download;
  readonly ChevronDownIcon = ChevronDown;
  readonly InfoIcon = Info;
  readonly ChevronLeftIcon = ChevronLeft;
  readonly ChevronRightIcon = ChevronRight;

  readonly totalFeatures = computed(() => this.features().length);

  readonly filteredFeatures = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    let rows: CoefficientFeature[] = [...this.features()];

    if (query) {
      rows = rows.filter((row) => row.name.toLowerCase().includes(query));
    }

    switch (this.featureFilter()) {
      case 'positive':
        rows = rows.filter((row) => row.weight > 0);
        break;
      case 'negative':
        rows = rows.filter((row) => row.weight < 0);
        break;
      case 'top':
        rows = [...rows].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
        break;
      default:
        rows = [...rows];
    }

    if (this.featureFilter() !== 'top') {
      rows.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
    }

    return rows;
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredFeatures().length / this.pageSize())),
  );

  readonly pagedFeatures = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.filteredFeatures().slice(start, start + this.pageSize());
  });

  readonly maxAbsWeight = computed(() => {
    const rows = this.pagedFeatures();
    if (!rows.length) return 1;
    return Math.max(...rows.map((row) => Math.abs(row.weight)), 0.001);
  });

  readonly chartFeatures = computed(() => {
    const direction = this.chartDirection();
    const filtered =
      direction === 'positive'
        ? this.features().filter((row) => row.weight > 0)
        : this.features().filter((row) => row.weight < 0);

    return [...filtered]
      .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
      .slice(0, 8);
  });

  readonly chartMaxAbs = computed(() => {
    const rows = this.chartFeatures();
    if (!rows.length) return 1;
    return Math.max(...rows.map((row) => Math.abs(row.weight)), 0.001);
  });

  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  formatCoef = formatSigned;
  formatIntercept = formatPlain;

  featureBadgeLabel(): string {
    const suffix = this.config().featureBadgeSuffix ?? '';
    return `${this.totalFeatures()}${suffix} features`;
  }

  impactWidth(value: number, max: number): number {
    return Math.min(100, (Math.abs(value) / max) * 100);
  }

  setFilter(filter: CoefficientFeatureFilter): void {
    this.featureFilter.set(filter);
    this.page.set(1);
  }

  onSearchInput(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
    this.page.set(1);
  }

  setPage(next: number): void {
    const clamped = Math.min(Math.max(1, next), this.totalPages());
    this.page.set(clamped);
  }

  setPageSize(size: number): void {
    this.pageSize.set(size as (typeof PAGE_SIZE_OPTIONS)[number]);
    this.page.set(1);
  }

  setChartDirection(direction: 'positive' | 'negative'): void {
    this.chartDirection.set(direction);
  }

  exportFeatures(): void {
    const header = ['Feature', 'Coef'];
    const lines = this.filteredFeatures().map((row) => [row.name, row.weight].join(','));
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = this.config().exportFileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  pageNumbers(): number[] {
    return Array.from({ length: this.totalPages() }, (_, index) => index + 1);
  }
}
