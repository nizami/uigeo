import {Component} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import { Cursor, Transformer, Canvas } from 'uigeo';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Transformer, Cursor, Canvas],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
