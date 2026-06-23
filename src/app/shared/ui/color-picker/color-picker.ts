import { Component, ElementRef, HostListener, Provider, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

const COLOR_PICKER_VALUE_ACCESSOR: Provider = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => ColorPicker),
  multi: true,
};

@Component({
  selector: 'app-color-picker',
  imports: [],
  templateUrl: './color-picker.html',
  providers: [COLOR_PICKER_VALUE_ACCESSOR],
})
export class ColorPicker implements ControlValueAccessor {
  private readonly elementRef = inject(ElementRef);

  readonly label = input<string>('');
  readonly placeholder = input<string>('#000000');
  readonly showInput = input<boolean>(true);
  readonly align = input<'left' | 'right'>('left');

  readonly value = signal<string>('#000000');
  readonly isOpen = signal(false);

  disabled = false;

  readonly presets = [
    { name: 'Azure Blue', hex: '#0078d4' },
    { name: 'Cobalt', hex: '#106ebe' },
    { name: 'Teal', hex: '#038387' },
    { name: 'Emerald', hex: '#107c41' },
    { name: 'Amethyst', hex: '#5c2d91' },
    { name: 'Rose', hex: '#e3008c' },
    { name: 'Amber', hex: '#d83b01' },
    { name: 'Tomato', hex: '#a80000' },
    { name: 'Slate', hex: '#3b3938' },
    { name: 'Charcoal', hex: '#201f1e' },
    { name: 'Pure White', hex: '#ffffff' },
    { name: 'Pitch Black', hex: '#000000' },
  ];

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string): void {
    this.value.set(value || '#000000');
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  toggleDropdown(): void {
    if (this.disabled) return;
    this.isOpen.update((v) => !v);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }

  selectColor(hex: string): void {
    if (this.disabled) return;
    this.value.set(hex);
    this.onChange(hex);
    this.onTouched();
    this.isOpen.set(false);
  }

  onTextChange(hex: string): void {
    if (this.disabled) return;
    let formatted = hex.trim();
    if (formatted && !formatted.startsWith('#')) {
      formatted = '#' + formatted;
    }
    if (/^#[0-9A-Ff-f]{3}$|^#[0-9A-Ff-f]{6}$/.test(formatted)) {
      this.value.set(formatted);
      this.onChange(formatted);
      this.onTouched();
    }
  }

  onNativePicker(event: Event): void {
    if (this.disabled) return;
    const target = event.target as HTMLInputElement;
    if (target && target.value) {
      const hex = target.value.toUpperCase();
      this.value.set(hex);
      this.onChange(hex);
      this.onTouched();
    }
  }
}
