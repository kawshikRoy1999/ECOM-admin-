import { Component, ElementRef, ViewChild, forwardRef, input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-wysiwyg-editor',
  standalone: true,
  imports: [],
  template: `
    <div class="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10 transition-all flex flex-col">
      <!-- Toolbar -->
      <div class="flex items-center gap-1 p-1.5 border-b border-slate-100 bg-slate-50/50 select-none shrink-0 flex-wrap">
        <button type="button" (click)="exec('bold')" [class.bg-slate-200]="queryState('bold')" class="p-1 rounded hover:bg-slate-200 text-slate-650 hover:text-slate-900 transition-colors flex items-center justify-center h-7 w-7" title="Bold">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3.75h4.25a3.25 3.25 0 013.25 3.25v0a3.25 3.25 0 01-3.25 3.25H6.75V3.75z M6.75 10.25h5a3.25 3.25 0 013.25 3.25v0a3.25 3.25 0 01-3.25 3.25h-5v-6.5z" /></svg>
        </button>
        <button type="button" (click)="exec('italic')" [class.bg-slate-200]="queryState('italic')" class="p-1 rounded hover:bg-slate-200 text-slate-650 hover:text-slate-900 transition-colors flex items-center justify-center h-7 w-7" title="Italic">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M10.25 3.75h4.5M9.25 20.25h4.5M12.25 3.75l-2.5 16.5" /></svg>
        </button>
        <button type="button" (click)="exec('underline')" [class.bg-slate-200]="queryState('underline')" class="p-1 rounded hover:bg-slate-200 text-slate-650 hover:text-slate-900 transition-colors flex items-center justify-center h-7 w-7" title="Underline">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M18.75 9.75v3a6.75 6.75 0 01-13.5 0v-3.5 M5.25 20.25h13.5" /></svg>
        </button>
        <button type="button" (click)="exec('strikeThrough')" [class.bg-slate-200]="queryState('strikeThrough')" class="p-1 rounded hover:bg-slate-200 text-slate-650 hover:text-slate-900 transition-colors flex items-center justify-center h-7 w-7" title="Strikethrough">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12h18 M5.25 7.5h13.5M7.5 16.5h9" /></svg>
        </button>
        
        <div class="h-4 w-px bg-slate-200 mx-1"></div>

        <button type="button" (click)="exec('insertUnorderedList')" class="p-1 rounded hover:bg-slate-200 text-slate-650 hover:text-slate-900 transition-colors flex items-center justify-center h-7 w-7" title="Bullet List">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12M8.25 17.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
        </button>
        <button type="button" (click)="exec('insertOrderedList')" class="p-1 rounded hover:bg-slate-200 text-slate-650 hover:text-slate-900 transition-colors flex items-center justify-center h-7 w-7" title="Numbered List">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12M8.25 17.25h12M3 5.25c0-.6.4-1 1-1h1.5a1 1 0 010 2H4 M3 11.25c0-.6.4-1 1-1h1.5v2.5H3.5" /></svg>
        </button>

        <div class="h-4 w-px bg-slate-200 mx-1"></div>
        
        <button type="button" (click)="exec('removeFormat')" class="p-1 rounded hover:bg-slate-200 text-slate-650 hover:text-slate-900 transition-colors flex items-center justify-center h-7 w-7" title="Clear Formatting">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </button>
      </div>

      <!-- Editor Body -->
      <div
        #editorEl
        contenteditable="true"
        (input)="onInput()"
        (blur)="onBlur()"
        [style.minHeight.px]="minHeight()"
        class="p-3 w-full bg-white text-[13px] text-slate-700 leading-relaxed focus:outline-none overflow-y-auto max-h-[300px]"
      ></div>
    </div>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => WysiwygEditor),
      multi: true,
    },
  ],
})
export class WysiwygEditor implements ControlValueAccessor {
  @ViewChild('editorEl', { static: true }) editorEl!: ElementRef<HTMLDivElement>;

  readonly minHeight = input<number>(120);

  onChange: (val: string) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(value: string): void {
    const val = value || '';
    if (this.editorEl) {
      this.editorEl.nativeElement.innerHTML = val;
    }
  }

  registerOnChange(fn: (val: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (this.editorEl) {
      this.editorEl.nativeElement.contentEditable = isDisabled ? 'false' : 'true';
    }
  }

  exec(command: string, value: string = ''): void {
    document.execCommand(command, false, value);
    this.onInput();
  }

  queryState(command: string): boolean {
    try {
      return document.queryCommandState(command);
    } catch {
      return false;
    }
  }

  onInput(): void {
    const html = this.editorEl.nativeElement.innerHTML;
    const isClean = this.editorEl.nativeElement.textContent?.trim() === '' && !this.editorEl.nativeElement.querySelector('img, hr, br');
    const valueToSend = isClean ? '' : html;
    this.onChange(valueToSend);
  }

  onBlur(): void {
    this.onTouched();
  }
}
