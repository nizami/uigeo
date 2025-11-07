import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {CursorService} from '../../services/cursor.service';

@Component({
  selector: 'geo-canvas',
  imports: [],
  templateUrl: './canvas.html',
  styleUrl: './canvas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.cursor]': 'cursorService.cursorStyle()',
  },
})
export class Canvas {
  protected readonly cursorService = inject(CursorService);
}
