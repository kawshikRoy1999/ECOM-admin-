import { Component, ElementRef, HostListener, Provider, forwardRef, inject, input, model, signal, computed, Input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

const SELECT_VALUE_ACCESSOR: Provider = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => Select),
  multi: true,
};

@Component({
  selector: 'app-select',
  imports: [],
  templateUrl: './select.html',
  providers: [SELECT_VALUE_ACCESSOR],
})
export class Select implements ControlValueAccessor {
  private readonly elementRef = inject(ElementRef);

  readonly options = input.required<any[]>();
  readonly labelKey = input<string>('name');
  readonly valueKey = input<string>('id');
  readonly placeholder = input<string>('Select option');
  readonly searchable = input<boolean>(false);
  
  readonly defaultLabel = input<string>('');
  readonly defaultValue = input<any>(0);
  
  readonly value = model<any>();
  
  readonly isOpen = signal(false);
  readonly searchQuery = signal('');
  
  private readonly _disabled = signal(false);

  @Input()
  set disabled(val: any) {
    this._disabled.set(val === '' || !!val);
  }
  get disabled(): boolean {
    return this._disabled();
  }
  
  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: any): void {
    this.value.set(value);
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this._disabled.set(isDisabled);
  }

  toggleDropdown(): void {
    if (this.disabled) return;
    this.isOpen.update((v) => !v);
    if (this.isOpen()) {
      this.searchQuery.set('');
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }

  selectOption(opt: any): void {
    const val = this.getOptionValue(opt);
    this.value.set(val);
    this.onChange(val);
    this.onTouched();
    this.isOpen.set(false);
  }

  selectDefaultOption(): void {
    const val = this.defaultValue();
    this.value.set(val);
    this.onChange(val);
    this.onTouched();
    this.isOpen.set(false);
  }

  getOptionLabel(opt: any): string {
    if (opt === null || opt === undefined) return '';
    if (typeof opt === 'object') {
      return opt[this.labelKey()] ?? '';
    }
    return String(opt);
  }

  getOptionValue(opt: any): any {
    if (opt === null || opt === undefined) return null;
    if (typeof opt === 'object') {
      return opt[this.valueKey()] ?? null;
    }
    return opt;
  }

  selectedLabel(): string {
    const val = this.value();
    if (val === undefined || val === null) return '';
    
    if (this.defaultLabel() && val === this.defaultValue()) {
      return this.defaultLabel();
    }
    
    const opt = this.options().find((o) => this.getOptionValue(o) === val);
    return opt ? this.getOptionLabel(opt) : '';
  }

  isSelected(opt: any): boolean {
    return this.value() === this.getOptionValue(opt);
  }

  readonly filteredOptions = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const opts = this.options();
    if (!query) return opts;
    return opts.filter((o) => 
      this.getOptionLabel(o).toLowerCase().includes(query)
    );
  });
}
