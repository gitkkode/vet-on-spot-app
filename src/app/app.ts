import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavBackService } from './services/nav-back.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
  styles: [':host { display: block; min-height: 100vh; }'],
})
export class App {
  constructor() {
    inject(NavBackService).start();
  }
}
