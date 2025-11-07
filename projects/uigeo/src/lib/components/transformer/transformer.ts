import {CommonModule} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  input,
  model,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import {CursorService, CursorType} from '../../services/cursor.service';
import {Position, Size} from './editor-element-model';

@Component({
  selector: 'geo-transformer',
  imports: [CommonModule],
  templateUrl: './transformer.html',
  styleUrl: './transformer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.movable]': 'movable()',
    '[class.resizable]': 'resizable()',
    '[class.rotatable]': 'rotatable()',
    '[class.selected]': 'selected()',
    '[class.transforming]': 'isTransforming()',
    '[style.left.%]': 'styleLeft()',
    '[style.top.%]': 'styleTop()',
    '[style.width.%]': 'styleWidth()',
    '[style.height.%]': 'styleHeight()',
    '[style.transform]': 'styleTransform()',
    '(mousedown)': 'onMouseDown($event)',
  },
})
export class Transformer implements OnInit, OnDestroy {
  CursorType = CursorType;

  private readonly elRef: ElementRef<HTMLElement> = inject(ElementRef<HTMLElement>);
  private readonly cursorService = inject(CursorService);

  movable = input(false);
  resizable = input(false);
  rotatable = input(false);
  selected = model(false);

  position = model<Position>({x: 0, y: 0});
  size = model<Size>({width: 10, height: 10});
  rotation = model<number>(0);

  styleLeft = computed(() => this.position().x);
  styleTop = computed(() => this.position().y);
  styleWidth = computed(() => this.size().width);
  styleHeight = computed(() => this.size().height);
  styleTransform = computed(() => `rotate(${this.rotation()}deg)`);

  isMoving = signal(false);
  isResizing = signal(false);
  isRotating = signal(false);
  isTransforming = computed(() => this.isMoving() || this.isResizing() || this.isRotating());

  private containerSize: Size = {width: 0, height: 0};
  private currentAnchor: string | null = null;
  private cursorPosition: Position = {x: 0, y: 0};
  private startLeft = 0;
  private startTop = 0;
  private startX = 0;
  private startY = 0;
  private startWidth = 0;
  private startHeight = 0;
  private startAngle = 0;
  private startCursorAngle = 0;
  private isDiscrete = false;

  private resizeObserver?: ResizeObserver;

  ngOnInit(): void {
    const parentEl = this.elRef.nativeElement.parentElement;

    if (!parentEl) {
      return;
    }

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        this.containerSize.width = entry.contentRect.width;
        this.containerSize.height = entry.contentRect.height;
      }
    });

    this.resizeObserver.observe(parentEl);

    parentEl.addEventListener('mousedown', (event) => {
      event.stopPropagation();
      this.selected.set(false);
    });
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
  }

  onMouseDown(event: MouseEvent) {
    event.stopPropagation();
    this.selected.set(true);

    if (!this.movable()) {
      return;
    }

    this.startMove(event);
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    this.cursorPosition.x = event.clientX;
    this.cursorPosition.y = event.clientY;

    if (this.isMoving()) {
      this.handleMoving();
    } else if (this.isResizing()) {
      this.handleResizing();
    } else if (this.isRotating()) {
      this.handleRotating();
    }
  }

  @HostListener('document:mouseup')
  onMouseUp() {
    this.isMoving.set(false);
    this.isResizing.set(false);
    this.isRotating.set(false);
    this.currentAnchor = null;
    this.changeDocumentCursor('');
    this.cursorService.setCursor(CursorType.Auto);
  }

  @HostListener('document:keydown', ['$event'])
  @HostListener('document:keyup', ['$event'])
  onKeyEvent(event: KeyboardEvent) {
    this.isDiscrete = event.shiftKey;

    if (this.isRotating()) {
      this.handleRotating();
    }
  }

  startMove(event: MouseEvent) {
    this.isMoving.set(true);
    this.startX = event.clientX - (this.position().x / 100) * this.containerSize.width;
    this.startY = event.clientY - (this.position().y / 100) * this.containerSize.height;

    this.cursorService.setCursor(CursorType.Move);
  }

  private handleMoving() {
    const newLeft = this.cursorPosition.x - this.startX;
    const newTop = this.cursorPosition.y - this.startY;

    const x = (newLeft / this.containerSize.width) * 100;
    const y = (newTop / this.containerSize.height) * 100;

    this.position.set({x, y});
  }

  startResize(event: MouseEvent, anchor: string) {
    event.preventDefault();
    event.stopPropagation();
    this.isResizing.set(true);
    this.currentAnchor = anchor;
    this.startLeft = (this.position().x / 100) * this.containerSize.width;
    this.startTop = (this.position().y / 100) * this.containerSize.height;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.startWidth = (this.size().width / 100) * this.containerSize.width;
    this.startHeight = (this.size().height / 100) * this.containerSize.height;
  }

  private handleResizing() {
    const dx = this.cursorPosition.x - this.startX;
    const dy = this.cursorPosition.y - this.startY;

    let newWidth = this.startWidth;
    let newHeight = this.startHeight;
    let newLeft = this.startLeft;
    let newTop = this.startTop;

    switch (this.currentAnchor) {
      case 'top-left':
        newWidth = this.startWidth - dx;
        newHeight = this.startHeight - dy;
        newLeft = this.startLeft + dx;
        newTop = this.startTop + dy;
        break;
      case 'top-right':
        newWidth = this.startWidth + dx;
        newHeight = this.startHeight - dy;
        newTop = this.startTop + dy;
        break;
      case 'bottom-left':
        newWidth = this.startWidth - dx;
        newHeight = this.startHeight + dy;
        newLeft = this.startLeft + dx;
        break;
      case 'bottom-right':
        newWidth = this.startWidth + dx;
        newHeight = this.startHeight + dy;
        break;
      case 'top':
        newHeight = this.startHeight - dy;
        newTop = this.startTop + dy;
        break;
      case 'bottom':
        newHeight = this.startHeight + dy;
        break;
      case 'left':
        newWidth = this.startWidth - dx;
        newLeft = this.startLeft + dx;
        break;
      case 'right':
        newWidth = this.startWidth + dx;
        break;
    }

    const minWidth = 14;
    const minHeight = 14;

    newWidth = Math.max(minWidth, newWidth);
    newHeight = Math.max(minHeight, newHeight);
    newLeft = Math.min(this.startLeft + this.startWidth - minWidth, newLeft);
    newTop = Math.min(this.startTop + this.startHeight - minHeight, newTop);

    const width = (newWidth / this.containerSize.width) * 100;
    const height = (newHeight / this.containerSize.height) * 100;
    const x = (newLeft / this.containerSize.width) * 100;
    const y = (newTop / this.containerSize.height) * 100;

    this.size.set({width, height});
    this.position.set({x, y});
  }

  startRotate(event: MouseEvent, startCursorAngle: number) {
    event.preventDefault();
    event.stopPropagation();

    this.isRotating.set(true);
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.startCursorAngle = startCursorAngle;
    // this.startAngle = this.rotation();

    const rect = this.elRef.nativeElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    this.startAngle = this.rotation() - this.getAngle(this.startX, this.startY, centerX, centerY);
  }

  onEnterLeave(event: MouseEvent, cursorType: CursorType, cursorInitialAngle: number): void {
    if (this.isTransforming()) {
      return;
    }

    this.cursorService.setCursor(cursorType, this.rotation() + cursorInitialAngle);
  }

  private handleRotating() {
    const rect = this.elRef.nativeElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const newAngle = this.getAngle(this.cursorPosition.x, this.cursorPosition.y, centerX, centerY);

    const step = 15;
    const angle = this.startAngle + newAngle;
    const discreteAngle = Math.round(angle / step) * step;
    const rotation = this.isDiscrete ? discreteAngle : angle;
    this.rotation.set(rotation);

    this.cursorService.setCursor(CursorType.Rotate, rotation + this.startCursorAngle);
  }

  private getAngle(x: number, y: number, centerX: number, centerY: number): number {
    return (Math.atan2(y - centerY, x - centerX) * 180) / Math.PI;
  }

  private changeDocumentCursor(cursor: string): void {
    // this.document.documentElement.style.cursor = cursor;
  }
}
