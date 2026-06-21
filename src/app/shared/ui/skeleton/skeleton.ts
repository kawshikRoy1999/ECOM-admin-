import { Component, input } from '@angular/core';

@Component({
  selector: 'app-skeleton',
  imports: [],
  template: `
    <div [class]="'animate-pulse ' + className()">
      @switch (type()) {
        @case ('text') {
          <div class="flex flex-col gap-2">
            @for (row of rowsArray; track $index) {
              <div 
                class="h-3.5 bg-slate-200/80 rounded-md" 
                [style.width]="rowWidth($index)"
              ></div>
            }
          </div>
        }
        @case ('circle') {
          <div class="rounded-full bg-slate-200/80" [style.width]="width() || '40px'" [style.height]="height() || '40px'"></div>
        }
        @case ('rectangle') {
          <div class="bg-slate-200/80 rounded-xl" [style.width]="width() || '100%'" [style.height]="height() || '150px'"></div>
        }
        @case ('card') {
          <div class="fluent-card p-5 bg-white border border-slate-200/80 rounded-xl flex flex-col gap-4">
            <div class="h-28 bg-slate-100 rounded-lg"></div>
            <div class="h-4 bg-slate-200/80 rounded-md w-3/4"></div>
            <div class="h-3 bg-slate-200/80 rounded-md w-1/2"></div>
          </div>
        }
        @case ('list') {
          <div class="flex flex-col gap-3">
            @for (row of rowsArray; track $index) {
              <div class="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                <div class="h-8 w-8 rounded-full bg-slate-200/80 shrink-0"></div>
                <div class="flex-1 flex flex-col gap-1.5 min-w-0">
                  <div class="h-3.5 bg-slate-200/80 rounded-md w-1/3"></div>
                  <div class="h-2.5 bg-slate-200/60 rounded-md w-2/3"></div>
                </div>
              </div>
            }
          </div>
        }
        @case ('input') {
          <div class="flex flex-col gap-1.5">
            <div class="h-3 bg-slate-200/60 rounded-sm w-16"></div>
            <div class="h-8.5 bg-slate-100 border border-slate-200/40 rounded-lg"></div>
          </div>
        }
        @case ('form') {
          <div class="fluent-card p-5 bg-white border border-slate-200/80 rounded-xl flex flex-col gap-5">
            <div class="h-4 bg-slate-200/80 rounded-md w-1/4 mb-2"></div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              @for (field of rowsArray; track $index) {
                <div class="flex flex-col gap-1.5">
                  <div class="h-3 bg-slate-200/60 rounded-sm w-20"></div>
                  <div class="h-8.5 bg-slate-100 border border-slate-200/40 rounded-lg"></div>
                </div>
              }
            </div>
          </div>
        }
      }
    </div>
  `
})
export class Skeleton {
  readonly type = input<'text' | 'circle' | 'rectangle' | 'card' | 'list' | 'input' | 'form'>('text');
  readonly rows = input<number>(1);
  readonly width = input<string>('');
  readonly height = input<string>('');
  readonly className = input<string>('');

  get rowsArray(): number[] {
    return Array.from({ length: this.rows() }, (_, i) => i);
  }

  rowWidth(index: number): string {
    if (this.width()) return this.width();
    const widths = ['100%', '95%', '85%', '90%', '70%', '60%', '40%'];
    return widths[index % widths.length];
  }
}
