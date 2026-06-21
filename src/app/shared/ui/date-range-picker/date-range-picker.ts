import { Component, ElementRef, HostListener, inject, input, model, signal } from '@angular/core';

export interface CalendarCell {
  day: number;
  isCurrentMonth: boolean;
  date: Date;
}

@Component({
  selector: 'app-date-range-picker',
  imports: [],
  templateUrl: './date-range-picker.html',
})
export class DateRangePicker {
  private readonly elementRef = inject(ElementRef);

  readonly placeholder = input<string>('Select date range');
  readonly disabled = input<boolean>(false);
  
  readonly startDate = model<string>(''); // YYYY-MM-DD
  readonly endDate = model<string>(''); // YYYY-MM-DD
  
  readonly isOpen = signal(false);
  readonly currentMonth = signal(new Date().getMonth());
  readonly currentYear = signal(new Date().getFullYear());
  readonly calendarCells = signal<CalendarCell[]>([]);
  readonly hoveredDate = signal<Date | null>(null);
  
  readonly monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  readonly weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  constructor() {
    this.generateCalendar();
  }

  toggleDropdown(): void {
    if (this.disabled()) return;
    this.isOpen.update((v) => !v);
    if (this.isOpen()) {
      const startVal = this.startDate();
      const refDate = startVal ? this.parseDate(startVal) || new Date() : new Date();
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
    const start = this.startDate();
    const end = this.endDate();

    if (!start || (start && end)) {
      this.startDate.set(formatted);
      this.endDate.set('');
    } else {
      // We already have a start date but no end date
      const startDateObj = this.parseDate(start);
      if (startDateObj && cell.date < startDateObj) {
        // If clicked date is before start date, make it the new start date
        this.startDate.set(formatted);
      } else {
        this.endDate.set(formatted);
        this.isOpen.set(false); // Close calendar on completion
      }
    }
    this.generateCalendar();
  }

  onCellMouseEnter(cell: CalendarCell): void {
    if (this.startDate() && !this.endDate()) {
      this.hoveredDate.set(cell.date);
    }
  }

  onMouseLeaveGrid(): void {
    this.hoveredDate.set(null);
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

  private formatDisplayDate(str: string): string {
    if (!str) return '';
    const parts = str.split('-');
    if (parts.length !== 3) return str;
    const year = parts[0];
    const monthIndex = Number(parts[1]) - 1;
    const day = parts[2];
    const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day} ${shortMonths[monthIndex]} ${year}`;
  }

  displayValue(): string {
    const start = this.startDate();
    const end = this.endDate();
    if (!start && !end) return '';
    if (start && !end) {
      return `${this.formatDisplayDate(start)} — Select end date`;
    }
    return `${this.formatDisplayDate(start)} — ${this.formatDisplayDate(end)}`;
  }

  isSelectedStart(cell: CalendarCell): boolean {
    return this.startDate() === this.formatDate(cell.date);
  }

  isSelectedEnd(cell: CalendarCell): boolean {
    return this.endDate() === this.formatDate(cell.date);
  }

  isInRange(cell: CalendarCell): boolean {
    const startStr = this.startDate();
    const endStr = this.endDate();
    
    if (!startStr) return false;
    
    const cellTime = cell.date.getTime();
    const startTime = this.parseDate(startStr)!.getTime();
    
    if (endStr) {
      const endTime = this.parseDate(endStr)!.getTime();
      return cellTime > startTime && cellTime < endTime;
    } else {
      const hovered = this.hoveredDate();
      if (!hovered) return false;
      const hoveredTime = hovered.getTime();
      return cellTime > startTime && cellTime <= hoveredTime;
    }
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
