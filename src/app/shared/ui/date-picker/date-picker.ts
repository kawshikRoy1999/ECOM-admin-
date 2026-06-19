import { Component, ElementRef, HostListener, Provider, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface CalendarCell {
  day: number;
  isCurrentMonth: boolean;
  date: Date;
}

const DATE_PICKER_VALUE_ACCESSOR: Provider = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => DatePicker),
  multi: true,
};

@Component({
  selector: 'app-date-picker',
  imports: [],
  templateUrl: './date-picker.html',
  providers: [DATE_PICKER_VALUE_ACCESSOR],
})
export class DatePicker implements ControlValueAccessor {
  private readonly elementRef = inject(ElementRef);

  readonly placeholder = input<string>('Select date');
  
  readonly isOpen = signal(false);
  readonly value = signal<string>(''); // YYYY-MM-DD
  
  readonly currentMonth = signal(new Date().getMonth());
  readonly currentYear = signal(new Date().getFullYear());
  readonly calendarCells = signal<CalendarCell[]>([]);
  
  disabled = false;
  
  readonly monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  readonly weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    this.generateCalendar();
  }

  writeValue(value: string): void {
    const val = value || '';
    this.value.set(val);
    if (val) {
      const parsed = this.parseDate(val);
      if (parsed) {
        this.currentMonth.set(parsed.getMonth());
        this.currentYear.set(parsed.getFullYear());
      }
    }
    this.generateCalendar();
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
    if (this.isOpen()) {
      const val = this.value();
      const refDate = val ? this.parseDate(val) || new Date() : new Date();
      this.currentMonth.set(refDate.getMonth());
      this.currentYear.set(refDate.getFullYear());
      this.generateCalendar();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }

  prevMonth(): void {
    if (this.currentMonth() === 0) {
      this.currentMonth.set(11);
      this.currentYear.update((y) => y - 1);
    } else {
      this.currentMonth.update((m) => m - 1);
    }
    this.generateCalendar();
  }

  nextMonth(): void {
    if (this.currentMonth() === 11) {
      this.currentMonth.set(0);
      this.currentYear.update((y) => y + 1);
    } else {
      this.currentMonth.update((m) => m + 1);
    }
    this.generateCalendar();
  }

  selectDate(cell: CalendarCell): void {
    const formatted = this.formatDate(cell.date);
    this.value.set(formatted);
    this.onChange(formatted);
    this.onTouched();
    this.isOpen.set(false);
  }

  private parseDate(str: string): Date | null {
    if (!str) return null;
    const parts = str.split('-');
    if (parts.length !== 3) return null;
    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    return new Date(year, month, day);
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  displayValue(): string {
    const val = this.value();
    if (!val) return '';
    const parts = val.split('-');
    if (parts.length !== 3) return val;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  isSelected(cell: CalendarCell): boolean {
    return this.value() === this.formatDate(cell.date);
  }

  isToday(cell: CalendarCell): boolean {
    const today = new Date();
    return (
      cell.date.getDate() === today.getDate() &&
      cell.date.getMonth() === today.getMonth() &&
      cell.date.getFullYear() === today.getFullYear() &&
      cell.isCurrentMonth
    );
  }

  generateCalendar(): void {
    const year = this.currentYear();
    const month = this.currentMonth();
    
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevTotalDays = new Date(year, month, 0).getDate();
    
    const cells: CalendarCell[] = [];
    
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      cells.push({
        day: prevTotalDays - i,
        isCurrentMonth: false,
        date: new Date(year, month - 1, prevTotalDays - i),
      });
    }
    
    for (let i = 1; i <= totalDays; i++) {
      cells.push({
        day: i,
        isCurrentMonth: true,
        date: new Date(year, month, i),
      });
    }
    
    const totalCells = 42;
    const remaining = totalCells - cells.length;
    for (let i = 1; i <= remaining; i++) {
      cells.push({
        day: i,
        isCurrentMonth: false,
        date: new Date(year, month + 1, i),
      });
    }
    
    this.calendarCells.set(cells);
  }
}
