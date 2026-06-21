import { Component, inject, AfterViewInit, OnDestroy, ElementRef, ViewChild, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { DatePicker } from '../../shared/ui/date-picker/date-picker';

declare var Chart: any;

interface KpiCard {
  label: string;
  value: string;
  sub: string;
  trend: number; // % change
  icon: string; // SVG path
  iconBg: string;
  iconColor: string;
}

interface RecentOrder {
  id: string;
  customer: string;
  date: string;
  amount: number;
  status: 'Delivered' | 'Pending' | 'Processing' | 'Cancelled';
}

interface TopProduct {
  name: string;
  variant: string;
  sold: number;
  revenue: number;
  share: number; // 0–100
}

@Component({
  selector: 'app-dashboard',
  imports: [DecimalPipe, FormsModule, DatePicker],
  templateUrl: './dashboard.html',
})
export class Dashboard implements AfterViewInit, OnDestroy {
  private readonly auth = inject(AuthService);
  readonly name = this.auth.displayName;

  // ── Filter State ───────────────────────────────────────────────────────────
  readonly fromDate = signal('');
  readonly toDate   = signal('');
  readonly selectedPeriod = signal<string>('thisMonth');

  readonly periods = [
    { id: 'today',     label: 'Today'       },
    { id: 'thisWeek',  label: 'This Week'   },
    { id: 'thisMonth', label: 'This Month'  },
    { id: 'last3m',    label: 'Last 3 Mo.'  },
    { id: 'thisYear',  label: 'This Year'   },
    { id: 'custom',    label: 'Custom'      },
  ];

  selectPeriod(id: string): void {
    this.selectedPeriod.set(id);
    if (id !== 'custom') {
      this.fromDate.set('');
      this.toDate.set('');
    }
  }

  applyFilter(): void { /* hook into real API when connected */ }
  clearFilter(): void {
    this.fromDate.set('');
    this.toDate.set('');
    this.selectedPeriod.set('thisMonth');
  }

  @ViewChild('revenueChart') revenueChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('statusChart')  statusChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('weeklyChart')  weeklyChartRef!: ElementRef<HTMLCanvasElement>;

  private charts: any[] = [];

  // ── KPI Cards ──────────────────────────────────────────────────────────────
  readonly kpis: KpiCard[] = [
    {
      label: 'Total Revenue',
      value: '₹ 4,83,210',
      sub: 'This month',
      trend: +18.4,
      icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      label: 'Total Orders',
      value: '1,247',
      sub: '156 pending',
      trend: +9.1,
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
      iconBg: 'bg-brand-50',
      iconColor: 'text-brand-600',
    },
    {
      label: 'Active Customers',
      value: '8,432',
      sub: '24 new today',
      trend: +4.7,
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
    },
    {
      label: 'Avg. Order Value',
      value: '₹ 3,874',
      sub: 'Per transaction',
      trend: +6.3,
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      label: 'Delivered Rate',
      value: '94.2%',
      sub: '1,175 of 1,247',
      trend: +2.1,
      icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      label: 'Return Rate',
      value: '2.4%',
      sub: '30 returned',
      trend: -1.2,
      icon: 'M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6',
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
    },
    {
      label: 'Active Offers',
      value: '12',
      sub: '3 expiring soon',
      trend: 0,
      icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z',
      iconBg: 'bg-orange-50',
      iconColor: 'text-orange-600',
    },
    {
      label: 'Stock Alerts',
      value: '7',
      sub: 'Low inventory items',
      trend: -3,
      icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
      iconBg: 'bg-red-50',
      iconColor: 'text-red-600',
    },
  ];

  // ── Recent Orders ──────────────────────────────────────────────────────────
  readonly recentOrders: RecentOrder[] = [
    { id: 'ORD/SpSHOP/2025-26/1131', customer: 'John Patra',   date: '18 Jun 2026, 12:47 PM', amount: 2374,  status: 'Delivered'  },
    { id: 'ORD/SpSHOP/2025-26/1130', customer: 'Rina Sharma',  date: '17 Jun 2026, 09:15 AM', amount: 5880,  status: 'Processing' },
    { id: 'ORD/SpSHOP/2025-26/1129', customer: 'Surya Sen',    date: '16 Jun 2026, 10:48 AM', amount: 156,   status: 'Pending'    },
    { id: 'ORD/SpSHOP/2025-26/1128', customer: 'Amit Dey',     date: '15 Jun 2026, 03:22 PM', amount: 8450,  status: 'Delivered'  },
    { id: 'ORD/SpSHOP/2025-26/1127', customer: 'John Patra',   date: '15 Jun 2026, 10:24 AM', amount: 156,   status: 'Cancelled'  },
    { id: 'ORD/SpSHOP/2025-26/1126', customer: 'Priya Nair',   date: '14 Jun 2026, 02:10 PM', amount: 4315,  status: 'Delivered'  },
    { id: 'ORD/SpSHOP/2025-26/1125', customer: 'Kabir Khan',   date: '14 Jun 2026, 08:55 AM', amount: 82,    status: 'Pending'    },
  ];

  // ── Top Products ────────────────────────────────────────────────────────────
  readonly topProducts: TopProduct[] = [
    { name: 'Handcrafted Leather Belt', variant: 'Natural Tan',  sold: 312, revenue: 124800, share: 88 },
    { name: 'Silk Necktie',             variant: 'Sky Blue',      sold: 298, revenue:  89400, share: 74 },
    { name: 'Ringer T-Shirt',           variant: 'Black / 32',    sold: 247, revenue:  49400, share: 61 },
    { name: 'Kids Shoe New',            variant: 'Black / 6',     sold: 193, revenue:  57900, share: 48 },
    { name: 'Casual Canvas Sneaker',    variant: 'White / 42',    sold: 141, revenue:  42300, share: 35 },
  ];

  // ── Status Badge Helpers ───────────────────────────────────────────────────
  statusBadge(s: RecentOrder['status']): string {
    const map: Record<RecentOrder['status'], string> = {
      Delivered:  'bg-emerald-50 text-emerald-700 border-emerald-100',
      Pending:    'bg-amber-50 text-amber-700 border-amber-100',
      Processing: 'bg-brand-50 text-brand-700 border-brand-100',
      Cancelled:  'bg-rose-50 text-rose-700 border-rose-100',
    };
    return map[s];
  }
  statusDot(s: RecentOrder['status']): string {
    const map: Record<RecentOrder['status'], string> = {
      Delivered: 'bg-emerald-500', Pending: 'bg-amber-500',
      Processing: 'bg-brand-500',  Cancelled: 'bg-rose-500',
    };
    return map[s];
  }

  // ── Chart Init ─────────────────────────────────────────────────────────────
  ngAfterViewInit(): void {
    this.waitForChart();
  }

  private waitForChart(attempts = 0): void {
    if (typeof Chart === 'undefined') {
      if (attempts < 30) setTimeout(() => this.waitForChart(attempts + 1), 100);
      return;
    }
    this.initRevenueChart();
    this.initStatusChart();
    this.initWeeklyChart();
  }

  private initRevenueChart(): void {
    const ctx = this.revenueChartRef?.nativeElement?.getContext('2d');
    if (!ctx) return;
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        datasets: [
          {
            label: 'Revenue (₹)',
            data: [42000, 58000, 81000, 74000, 96000, 124500, 110000, 135000, 98000, 142000, 160000, 185000],
            borderColor: '#0078d4',
            backgroundColor: (ctx: any) => {
              const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.chartArea?.bottom ?? 300);
              gradient.addColorStop(0,   'rgba(0,120,212,0.15)');
              gradient.addColorStop(1,   'rgba(0,120,212,0.00)');
              return gradient;
            },
            borderWidth: 2.5, fill: true, tension: 0.45,
            pointBackgroundColor: '#0078d4', pointRadius: 3, pointHoverRadius: 6,
          },
          {
            label: 'Orders',
            data: [85, 112, 158, 139, 187, 241, 215, 262, 193, 278, 310, 355],
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
            borderColor: '#334155', borderWidth: 1,
            padding: 10, cornerRadius: 8,
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
    if (!ctx) return;
    const chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Delivered', 'Pending', 'Processing', 'Cancelled'],
        datasets: [{
          data: [720, 210, 215, 102],
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
  }

  private initWeeklyChart(): void {
    const ctx = this.weeklyChartRef?.nativeElement?.getContext('2d');
    if (!ctx) return;
    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [{
          label: 'Orders',
          data: [34, 42, 38, 55, 61, 48, 27],
          backgroundColor: (ctx: any) => {
            const max = 61;
            const val = ctx.raw as number;
            const alpha = 0.4 + 0.6 * (val / max);
            return `rgba(0,120,212,${alpha.toFixed(2)})`;
          },
          borderRadius: 6,
          borderSkipped: false,
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

  ngOnDestroy(): void {
    this.charts.forEach(c => c?.destroy());
  }
}
