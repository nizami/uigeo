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
import {Position} from '../../models/position.model';
import {Size} from '../../models/size.model';
import {CursorService, CursorType} from '../../services/cursor.service';

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
  size = model<Size>({width: 0.2, height: 0.2});
  rotation = model<number>(0);

  styleLeft = computed(() => this.position().x * 100);
  styleTop = computed(() => this.position().y * 100);
  styleWidth = computed(() => this.size().width * 100);
  styleHeight = computed(() => this.size().height * 100);
  styleTransform = computed(() => `rotate(${this.rotation()}deg)`);

  isMoving = signal(false);
  isResizing = signal(false);
  isRotating = signal(false);
  isTransforming = computed(() => this.isMoving() || this.isResizing() || this.isRotating());

  private containerSize: Size = {width: 0, height: 0};
  private currentAnchor: Position = {x: 0, y: 0};
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
    this.startX = event.clientX - this.position().x * this.containerSize.width;
    this.startY = event.clientY - this.position().y * this.containerSize.height;

    this.cursorService.setCursor(CursorType.Move);
  }

  private handleMoving() {
    const newLeft = this.cursorPosition.x - this.startX;
    const newTop = this.cursorPosition.y - this.startY;

    const x = newLeft / this.containerSize.width;
    const y = newTop / this.containerSize.height;

    this.position.set({x, y});
  }

  startResize(event: MouseEvent, anchor: Position) {
    event.preventDefault();
    event.stopPropagation();
    this.isResizing.set(true);
    this.currentAnchor = anchor;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.startLeft = this.position().x * this.containerSize.width;
    this.startTop = this.position().y * this.containerSize.height;
    this.startWidth = this.size().width * this.containerSize.width;
    this.startHeight = this.size().height * this.containerSize.height;
  }

  private handleResizing() {
    const dx = this.cursorPosition.x - this.startX;
    const dy = this.cursorPosition.y - this.startY;

    let newWidth = this.startWidth + dx * this.currentAnchor.x;
    let newHeight = this.startHeight + dy * this.currentAnchor.y;
    let newLeft = this.startLeft + dx * (this.currentAnchor.x < 0 ? 1 : 0);
    let newTop = this.startTop + dy * (this.currentAnchor.y < 0 ? 1 : 0);

    const minWidth = 14;
    const minHeight = 14;

    newWidth = Math.max(minWidth, newWidth);
    newHeight = Math.max(minHeight, newHeight);
    newLeft = Math.min(this.startLeft + this.startWidth - minWidth, newLeft);
    newTop = Math.min(this.startTop + this.startHeight - minHeight, newTop);

    const width = newWidth / this.containerSize.width;
    const height = newHeight / this.containerSize.height;
    const x = newLeft / this.containerSize.width;
    const y = newTop / this.containerSize.height;

    this.size.set({width, height});
    this.position.set({x, y});
  }

  startRotate(event: MouseEvent, anchor: Position) {
    event.preventDefault();
    event.stopPropagation();

    this.isRotating.set(true);
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.startCursorAngle = ((Math.atan2(anchor.x, anchor.y * -1) * 180) / Math.PI + 360) % 360;

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

// function setWidthWithCompensation(elem, newWidth) {
//   const style = getComputedStyle(elem);
//   const angle = parseFloat(style.transform.match(/rotate\(([-\d.]+)deg\)/)?.[1] || 0) * Math.PI / 180;

//   const oldWidth = parseFloat(style.width);
//   const dx = (newWidth - oldWidth) / 2 * Math.cos(angle);
//   const dy = (newWidth - oldWidth) / 2 * Math.sin(angle);

//   const oldLeft = parseFloat(style.left);
//   const oldTop = parseFloat(style.top);

//   elem.style.width = newWidth + 'px';
//   elem.style.left = (oldLeft - dx) + 'px';
//   elem.style.top = (oldTop - dy) + 'px';
// }
