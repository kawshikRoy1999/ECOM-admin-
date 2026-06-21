import {
  Component, inject, AfterViewInit, OnDestroy,
  ElementRef, ViewChild, signal, computed,
} from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AuthService }      from '../../core/auth/auth.service';
import { DateRangePicker }  from '../../shared/ui/date-range-picker/date-range-picker';
import { DashboardService } from './dashboard.service';
import {
  DashboardPeriod,
  DashboardSummary,
  DashboardRecentOrder,
  DashboardTopProduct,
} from './dashboard.models';

declare var Chart: any;

interface PeriodOption { id: DashboardPeriod; label: string; }

@Component({
  selector: 'app-dashboard',
  imports: [DecimalPipe, DatePipe, FormsModule, DateRangePicker],
  templateUrl: './dashboard.html',
})
export class Dashboard implements AfterViewInit, OnDestroy {
  private readonly auth    = inject(AuthService);
  private readonly service = inject(DashboardService);
  readonly name = this.auth.displayName;

  // ── Filter state ───────────────────────────────────────────────────────────
  readonly fromDate       = signal('');
  readonly toDate         = signal('');
  readonly selectedPeriod = signal<DashboardPeriod>('thismonth');

  readonly periods: PeriodOption[] = [
    { id: 'today',     label: 'Today'      },
    { id: 'thisweek',  label: 'This Week'  },
    { id: 'thismonth', label: 'This Month' },
    { id: 'last3m',    label: 'Last 3 Mo.' },
    { id: 'thisyear',  label: 'This Year'  },
    { id: 'custom',    label: 'Custom'     },
  ];

  // ── Data state ─────────────────────────────────────────────────────────────
  readonly loading = signal(false);
  readonly error   = signal('');
  readonly data    = signal<DashboardSummary | null>(null);

  // ── Computed helpers for the template ─────────────────────────────────────
  readonly kpis       = computed(() => this.data()?.kpis       ?? null);
  readonly trends     = computed(() => this.data()?.trends     ?? null);
  readonly recentOrders = computed(() => this.data()?.recentOrders ?? []);
  readonly topProducts  = computed(() => this.data()?.topProducts  ?? []);
  readonly sla          = computed(() => this.data()?.slaScorecard ?? null);
  readonly weeklyTotal  = computed(() =>
    (this.data()?.weeklyOrders?.counts ?? []).reduce((a, b) => a + b, 0)
  );

  // ── Chart refs ─────────────────────────────────────────────────────────────
  @ViewChild('revenueChart') revenueChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('statusChart')  statusChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('weeklyChart')  weeklyChartRef!: ElementRef<HTMLCanvasElement>;

  private charts: any[] = [];

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngAfterViewInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.charts.forEach(c => c?.destroy());
  }

  // ── Filter actions ─────────────────────────────────────────────────────────
  selectPeriod(id: DashboardPeriod): void {
    this.selectedPeriod.set(id);
    if (id !== 'custom') {
      this.fromDate.set('');
      this.toDate.set('');
      this.load();
    }
  }

  applyFilter(): void { this.load(); }

  clearFilter(): void {
    this.fromDate.set('');
    this.toDate.set('');
    this.selectedPeriod.set('thismonth');
    this.load();
  }

  // ── API call ───────────────────────────────────────────────────────────────
  private load(): void {
    this.loading.set(true);
    this.error.set('');

    this.service
      .getSummary(this.selectedPeriod(), this.fromDate(), this.toDate())
      .subscribe({
        next: (res) => {
          this.data.set(res);
          this.loading.set(false);
          // Rebuild charts with fresh data
          setTimeout(() => this.buildCharts(), 50);
        },
        error: (err) => {
          this.error.set(err?.message ?? 'Failed to load dashboard data.');
          this.loading.set(false);
        },
      });
  }

  // ── Chart building ─────────────────────────────────────────────────────────
  private waitForChartJs(cb: () => void, attempt = 0): void {
    if (typeof Chart !== 'undefined') { cb(); return; }
    if (attempt < 30) setTimeout(() => this.waitForChartJs(cb, attempt + 1), 100);
  }

  private buildCharts(): void {
    this.waitForChartJs(() => {
      this.destroyCharts();
      this.initRevenueChart();
      this.initStatusChart();
      this.initWeeklyChart();
    });
  }

  private destroyCharts(): void {
    this.charts.forEach(c => c?.destroy());
    this.charts = [];
  }

  private initRevenueChart(): void {
    const ctx = this.revenueChartRef?.nativeElement?.getContext('2d');
    const rc  = this.data()?.revenueChart;
    if (!ctx || !rc) return;

    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: rc.labels,
        datasets: [
          {
            label: 'Revenue (₹)',
            data: rc.revenue,
            borderColor: '#0078d4',
            backgroundColor: (ctx: any) => {
              const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.chartArea?.bottom ?? 280);
              g.addColorStop(0, 'rgba(0,120,212,0.15)');
              g.addColorStop(1, 'rgba(0,120,212,0.00)');
              return g;
            },
            borderWidth: 2.5, fill: true, tension: 0.45,
            pointBackgroundColor: '#0078d4', pointRadius: 3, pointHoverRadius: 6,
          },
          {
            label: 'Orders',
            data: rc.orders,
            borderColor: '#f59e0b',
            backgroundColor: 'transparent',
            borderWidth: 2, fill: false, tension: 0.45,
            pointBackgroundColor: '#f59e0b', pointRadius: 3, pointHoverRadius: 6,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true, position: 'top',
            labels: {
              boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'circle',
              font: { family: 'Inter, system-ui, sans-serif', size: 11, weight: '600' },
              color: '#475569', padding: 16,
            },
          },
          tooltip: {
            backgroundColor: '#1e293b', titleColor: '#f1f5f9', bodyColor: '#cbd5e1',
            borderColor: '#334155', borderWidth: 1, padding: 10, cornerRadius: 8,
            callbacks: {
              label: (c: any) => c.datasetIndex === 0
                ? ` ₹ ${Number(c.raw).toLocaleString('en-IN')}`
                : ` ${c.raw} orders`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true, position: 'left',
            grid: { color: 'rgba(226,232,240,0.6)' },
            border: { dash: [4, 4] },
            ticks: {
              font: { family: 'Inter, system-ui, sans-serif', size: 10 }, color: '#64748b',
              callback: (v: number) => '₹' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v),
            },
          },
          y1: {
            beginAtZero: true, position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { font: { family: 'Inter, system-ui, sans-serif', size: 10 }, color: '#64748b' },
          },
          x: {
            grid: { display: false },
            ticks: { font: { family: 'Inter, system-ui, sans-serif', size: 10 }, color: '#64748b' },
          },
        },
      },
    });
    this.charts.push(chart);
  }

  private initStatusChart(): void {
    const ctx = this.statusChartRef?.nativeElement?.getContext('2d');
    const ss  = this.data()?.orderStatusSplit;
    if (!ctx || !ss) return;

    const total = (ss.delivered + ss.pending + ss.processing + ss.cancelled) || 1;
    const chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Delivered', 'Pending', 'Processing', 'Cancelled'],
        datasets: [{
          data: [ss.delivered, ss.pending, ss.processing, ss.cancelled],
          backgroundColor: ['#10b981', '#f59e0b', '#0078d4', '#ef4444'],
          borderWidth: 3, borderColor: '#ffffff', hoverOffset: 6,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 11, boxHeight: 11, usePointStyle: true, pointStyle: 'circle',
              font: { family: 'Inter, system-ui, sans-serif', size: 11, weight: '600' },
              color: '#475569', padding: 14,
            },
          },
          tooltip: {
            backgroundColor: '#1e293b', titleColor: '#f1f5f9', bodyColor: '#cbd5e1',
            borderColor: '#334155', borderWidth: 1, padding: 10, cornerRadius: 8,
          },
        },
        cutout: '68%',
      },
    });
    this.charts.push(chart);
    // Store total for the center label in the template
    this._orderTotal = total;
  }

  private initWeeklyChart(): void {
    const ctx = this.weeklyChartRef?.nativeElement?.getContext('2d');
    const wo  = this.data()?.weeklyOrders;
    if (!ctx || !wo) return;

    const maxVal = Math.max(...wo.counts, 1);
    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: wo.labels,
        datasets: [{
          label: 'Orders',
          data: wo.counts,
          backgroundColor: (ctx: any) => {
            const alpha = 0.4 + 0.6 * ((ctx.raw as number) / maxVal);
            return `rgba(0,120,212,${alpha.toFixed(2)})`;
          },
          borderRadius: 6, borderSkipped: false,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e293b', titleColor: '#f1f5f9', bodyColor: '#cbd5e1',
            borderColor: '#334155', borderWidth: 1, padding: 10, cornerRadius: 8,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(226,232,240,0.6)' },
            border: { dash: [4, 4] },
            ticks: { font: { family: 'Inter, system-ui, sans-serif', size: 10 }, color: '#64748b' },
          },
          x: {
            grid: { display: false },
            ticks: { font: { family: 'Inter, system-ui, sans-serif', size: 10 }, color: '#64748b' },
          },
        },
      },
    });
    this.charts.push(chart);
  }

  // Public so template can read it for doughnut center label
  _orderTotal = 0;

  // ── Template helpers ───────────────────────────────────────────────────────
  trendClass(dir: string | undefined): string {
    if (dir === 'up')   return 'text-emerald-600 bg-emerald-50';
    if (dir === 'down') return 'text-rose-600 bg-rose-50';
    return 'text-slate-500 bg-slate-100';
  }

  trendArrow(dir: string | undefined): string {
    if (dir === 'up')   return '↑';
    if (dir === 'down') return '↓';
    return '→';
  }

  orderStatusClass(s: string): string {
    const lower = (s ?? '').toLowerCase();
    if (lower.includes('deliver') || lower.includes('complet')) return 'success';
    if (lower.includes('cancel') || lower.includes('refund') || lower.includes('return')) return 'danger';
    if (lower.includes('placed') || lower.includes('pending') || lower.includes('process') || lower.includes('dispatch')) return 'warning';
    return 'info';
  }

  slaItems = computed(() => {
    const s = this.sla();
    if (!s) return [];
    return [
      { label: 'Orders Shipped on Time', value: s.onTimeShipment,      color: 'bg-emerald-500' },
      { label: 'Invoice Generation',     value: s.invoiceGeneration,   color: 'bg-brand-500'   },
      { label: 'Delivery Confirmation',  value: s.deliveryConfirmation, color: 'bg-violet-500'  },
      { label: 'Customer Satisfaction',  value: s.customerSatisfaction, color: 'bg-amber-500'   },
    ];
  });

  quickMetrics = computed(() => {
    const k = this.kpis();
    if (!k) return [];
    return [
      { label: 'Cancellation Rate', value: k.cancellationRate + '%',   note: 'vs prev period',   noteColor: 'text-rose-500'    },
      { label: 'Avg. Delivery Days', value: k.avgDeliveryDays + ' d',  note: 'avg fulfillment',  noteColor: 'text-slate-400'   },
      { label: 'Repeat Customers',  value: k.repeatCustomerRate + '%', note: 'loyal base',       noteColor: 'text-emerald-600' },
      { label: 'Refund Value',      value: '₹ ' + k.refundValue.toLocaleString('en-IN'), note: 'total refunded', noteColor: 'text-amber-600' },
    ];
  });
}
