import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ToastContainer } from './shared/ui/toast/toast-container';
import { ConfirmDialog } from './shared/ui/confirm/confirm-dialog';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainer, ConfirmDialog],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
