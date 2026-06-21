import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DOCUMENT } from '@angular/common';

import { ToastContainer } from './shared/ui/toast/toast-container';
import { ConfirmDialog } from './shared/ui/confirm/confirm-dialog';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainer, ConfirmDialog],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private readonly document = inject(DOCUMENT);

  ngOnInit(): void {
    this.setDynamicFavicon();
  }

  private setDynamicFavicon(): void {
    // Only run in the browser
    if (typeof window === 'undefined') return;

    // Get the first letter of the company name from the document title (e.g. "ECOM Admin" -> "E")
    const title = this.document.title || 'App';
    const firstLetter = title.charAt(0).toUpperCase();

    const canvas = this.document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Draw brand-colored rounded square background
      ctx.fillStyle = '#0078d4'; // Brand 600
      ctx.beginPath();
      ctx.roundRect(0, 0, 64, 64, 16);
      ctx.fill();

      // Draw the letter
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 42px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Slight vertical adjustment for optical centering
      ctx.fillText(firstLetter, 32, 36);

      // Apply to the favicon link tag
      let link = this.document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = this.document.createElement('link');
        link.rel = 'icon';
        this.document.head.appendChild(link);
      }
      link.type = 'image/png';
      link.href = canvas.toDataURL('image/png');
    }
  }
}

