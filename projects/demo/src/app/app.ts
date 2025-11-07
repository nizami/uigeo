import {Component} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {Canvas, Transformer} from 'uigeo';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Transformer, Canvas],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
