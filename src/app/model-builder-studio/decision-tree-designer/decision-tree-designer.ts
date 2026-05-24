import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Hand, Leaf, LucideAngularModule, Maximize2, Minus, Plus } from 'lucide-angular';
import { ModelBuilderService } from '../model-builder.service';

type DragState =
  | {
      kind: 'pan';
      pointerId: number;
      captureTarget: HTMLElement;
      startX: number;
      startY: number;
      scrollLeft: number;
      scrollTop: number;
    }
  | {
      kind: 'node';
      pointerId: number;
      captureTarget: HTMLElement;
      nodeId: number;
      startX: number;
      startY: number;
      originTop: number;
      originLeft: number;
    };

@Component({
  selector: 'app-decision-tree-designer',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './decision-tree-designer.html',
  styleUrl: './decision-tree-designer.css',
})
export class DecisionTreeDesigner {
  private readonly modelBuilder = inject(ModelBuilderService);

  readonly viewport = viewChild<ElementRef<HTMLElement>>('viewport');

  readonly nodes = toSignal(this.modelBuilder.nodeViews$, { initialValue: [] });
  readonly edges = toSignal(this.modelBuilder.edges$, { initialValue: [] });
  readonly selectedNodeId = toSignal(this.modelBuilder.selectedNodeId$, {
    initialValue: 3,
  });

  readonly zoomLevel = signal(1);
  readonly panActive = signal(false);
  readonly isDragging = signal(false);
  readonly draggingNodeId = signal<number | null>(null);

  readonly canvasWidth = 880;
  readonly canvasHeight = 500;
  readonly nodeHeight = 80;

  private readonly minZoom = 0.5;
  private readonly maxZoom = 1.5;
  private readonly zoomStep = 0.1;
  private readonly dragThreshold = 4;

  private dragState: DragState | null = null;
  private didDrag = false;

  readonly LeafIcon = Leaf;
  readonly PlusIcon = Plus;
  readonly MinusIcon = Minus;
  readonly Maximize2Icon = Maximize2;
  readonly HandIcon = Hand;

  zoomPercent(): number {
    return Math.round(this.zoomLevel() * 100);
  }

  canZoomOut(): boolean {
    return this.zoomLevel() > this.minZoom;
  }

  canZoomIn(): boolean {
    return this.zoomLevel() < this.maxZoom;
  }

  scaledWidth(): number {
    return this.canvasWidth * this.zoomLevel();
  }

  scaledHeight(): number {
    return this.canvasHeight * this.zoomLevel();
  }

  canvasTransform(): string {
    return `scale(${this.zoomLevel()})`;
  }

  togglePan(): void {
    this.panActive.update((active) => !active);
  }

  zoomOut(): void {
    if (!this.canZoomOut()) {
      return;
    }

    this.zoomLevel.update(
      (current) => Math.max(this.minZoom, +(current - this.zoomStep).toFixed(2)),
    );
  }

  zoomIn(): void {
    if (!this.canZoomIn()) {
      return;
    }

    this.zoomLevel.update(
      (current) => Math.min(this.maxZoom, +(current + this.zoomStep).toFixed(2)),
    );
  }

  resetView(): void {
    this.zoomLevel.set(1);
    this.resetScroll();
  }

  async toggleFullscreen(): Promise<void> {
    const viewport = this.viewport()?.nativeElement;
    if (!viewport) {
      return;
    }

    if (document.fullscreenElement === viewport) {
      await document.exitFullscreen();
      return;
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }

    await viewport.requestFullscreen();
  }

  onViewportPointerDown(event: PointerEvent): void {
    if (!this.panActive() || event.button !== 0) {
      return;
    }

    const viewport = this.viewport()?.nativeElement;
    if (!viewport) {
      return;
    }

    event.preventDefault();
    viewport.setPointerCapture(event.pointerId);
    this.isDragging.set(true);
    this.didDrag = false;
    this.dragState = {
      kind: 'pan',
      pointerId: event.pointerId,
      captureTarget: viewport,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };
  }

  onNodePointerDown(event: PointerEvent, nodeId: number): void {
    if (this.panActive() || event.button !== 0) {
      return;
    }

    const node = this.nodes().find((entry) => entry.id === nodeId);
    if (!node) {
      return;
    }

    const captureTarget = event.currentTarget as HTMLElement;

    event.preventDefault();
    event.stopPropagation();
    captureTarget.setPointerCapture(event.pointerId);
    this.isDragging.set(true);
    this.draggingNodeId.set(nodeId);
    this.didDrag = false;
    this.dragState = {
      kind: 'node',
      pointerId: event.pointerId,
      captureTarget,
      nodeId,
      startX: event.clientX,
      startY: event.clientY,
      originTop: node.top,
      originLeft: node.left,
    };
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.dragState || this.dragState.pointerId !== event.pointerId) {
      return;
    }

    if (this.dragState.kind === 'pan') {
      const viewport = this.viewport()?.nativeElement;
      if (!viewport) {
        return;
      }

      const dx = event.clientX - this.dragState.startX;
      const dy = event.clientY - this.dragState.startY;

      if (Math.abs(dx) > this.dragThreshold || Math.abs(dy) > this.dragThreshold) {
        this.didDrag = true;
      }

      viewport.scrollLeft = this.dragState.scrollLeft - dx;
      viewport.scrollTop = this.dragState.scrollTop - dy;
      return;
    }

    const dx = (event.clientX - this.dragState.startX) / this.zoomLevel();
    const dy = (event.clientY - this.dragState.startY) / this.zoomLevel();

    if (Math.abs(dx) > this.dragThreshold || Math.abs(dy) > this.dragThreshold) {
      this.didDrag = true;
    }

    this.modelBuilder.moveNode(
      this.dragState.nodeId,
      Math.max(0, Math.round(this.dragState.originTop + dy)),
      Math.max(0, Math.round(this.dragState.originLeft + dx)),
    );
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.dragState || this.dragState.pointerId !== event.pointerId) {
      return;
    }

    if (this.dragState.kind === 'node' && !this.didDrag) {
      this.modelBuilder.selectNode(this.dragState.nodeId);
    }

    this.clearDrag(event.pointerId);
  }

  onPointerCancel(event: PointerEvent): void {
    if (this.dragState?.pointerId === event.pointerId) {
      this.clearDrag(event.pointerId);
    }
  }

  edgePath(edge: { fromId: number; toId: number }): string {
    const ends = this.edgeEndpoints(edge);
    if (!ends) return '';
    const midY = (ends.fromY + ends.toY) / 2;
    return `M ${ends.fromX} ${ends.fromY} C ${ends.fromX} ${midY}, ${ends.toX} ${midY}, ${ends.toX} ${ends.toY}`;
  }

  edgeLabelPosition(edge: { fromId: number; toId: number }): { left: number; top: number } {
    const ends = this.edgeEndpoints(edge);
    if (!ends) return { left: 0, top: 0 };
    return {
      left: (ends.fromX + ends.toX) / 2,
      top: (ends.fromY + ends.toY) / 2 - 12,
    };
  }

  private edgeEndpoints(edge: { fromId: number; toId: number }): {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  } | null {
    const nodes = this.nodes();
    const from = nodes.find((n) => n.id === edge.fromId);
    const to = nodes.find((n) => n.id === edge.toId);
    if (!from || !to) return null;
    return {
      fromX: from.left + from.width / 2,
      fromY: from.top + this.nodeHeight,
      toX: to.left + to.width / 2,
      toY: to.top,
    };
  }

  private resetScroll(): void {
    const viewport = this.viewport()?.nativeElement;
    if (viewport) {
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
    }
  }

  private clearDrag(pointerId: number): void {
    if (this.dragState?.captureTarget.hasPointerCapture(pointerId)) {
      this.dragState.captureTarget.releasePointerCapture(pointerId);
    }

    this.dragState = null;
    this.isDragging.set(false);
    this.draggingNodeId.set(null);
    this.didDrag = false;
  }
}
