import { Component, ElementRef, HostListener, Provider, forwardRef, inject, input, model, output, signal, computed, Input } from '@angular/core';
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

  /** When set, shows an "add new" action row at the bottom of the dropdown. */
  readonly addNewLabel = input<string>('');
  /** Emits the current search text (may be empty) when the add-new row is clicked. */
  readonly addNew = output<string>();

  readonly value = model<any>();
  
  readonly isOpen = signal(false);
  readonly searchQuery = signal('');
  readonly activeIndex = signal(-1);

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
    if (this.isOpen()) {
      this.isOpen.set(false);
    } else {
      this.openDropdown();
    }
  }

  private openDropdown(): void {
    this.searchQuery.set('');
    this.isOpen.set(true);
    // Pre-highlight the currently selected option for arrow navigation.
    this.activeIndex.set(this.filteredOptions().findIndex((o) => this.isSelected(o)));
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    this.activeIndex.set(0);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      if (this.isOpen()) this.onTouched();
      this.isOpen.set(false);
    }
  }

  /** Full keyboard support so the control participates in Tab order like a native select. */
  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (this.disabled) return;
    const opts = this.filteredOptions();

    if (!this.isOpen()) {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        this.openDropdown();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex.set(Math.min(opts.length - 1, this.activeIndex() + 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.set(Math.max(0, this.activeIndex() - 1));
        break;
      case 'Enter':
        event.preventDefault();
        if (this.activeIndex() >= 0 && this.activeIndex() < opts.length) {
          this.selectOption(opts[this.activeIndex()]);
        } else {
          this.isOpen.set(false);
        }
        break;
      case 'Escape':
        event.preventDefault();
        this.isOpen.set(false);
        break;
      case 'Tab':
        // Let focus move naturally; just close the panel.
        this.isOpen.set(false);
        break;
    }
  }

  emitAddNew(): void {
    this.addNew.emit(this.searchQuery().trim());
    this.isOpen.set(false);
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
