// ── Request ──────────────────────────────────────────────────────────────────
export type DashboardPeriod = 'today' | 'thisweek' | 'thismonth' | 'last3m' | 'thisyear' | 'custom';

export interface DashboardRequest {
  companyId: number;
  period: DashboardPeriod;
  fromDate?: string;
  toDate?: string;
}

// ── Response ─────────────────────────────────────────────────────────────────
export interface DashboardKpis {
  totalRevenue: number;
  totalOrders: number;
  pendingOrders: number;
  activeCustomers: number;
  newCustomersToday: number;
  avgOrderValue: number;
  deliveredCount: number;
  deliveredRate: number;
  returnCount: number;
  returnRate: number;
  activeOffers: number;
  expiringOffers: number;
  stockAlerts: number;
  cancellationRate: number;
  avgDeliveryDays: number;
  repeatCustomerRate: number;
  refundValue: number;
}

export interface DashboardTrendItem {
  change: number;
  direction: 'up' | 'down' | 'neutral';
}

export interface DashboardTrends {
  revenue: DashboardTrendItem;
  orders: DashboardTrendItem;
  customers: DashboardTrendItem;
  avgOrderValue: DashboardTrendItem;
  deliveredRate: DashboardTrendItem;
  returnRate: DashboardTrendItem;
  activeOffers: DashboardTrendItem;
  stockAlerts: DashboardTrendItem;
}

export interface DashboardRevenueChart {
  labels: string[];
  revenue: number[];
  orders: number[];
}

export interface DashboardOrderStatusSplit {
  delivered: number;
  pending: number;
  processing: number;
  cancelled: number;
}

export interface DashboardWeeklyOrders {
  labels: string[];
  counts: number[];
}

export interface DashboardRecentOrder {
  orderNo: string;
  customerName: string;
  orderDate: string;
  total: number;
  status: string;
}

export interface DashboardTopProduct {
  productId: string;
  productName: string;
  variant: string;
  unitsSold: number;
  revenue: number;
  sharePercent: number;
}

export interface DashboardSlaScorecard {
  onTimeShipment: number;
  invoiceGeneration: number;
  deliveryConfirmation: number;
  customerSatisfaction: number;
}

export interface DashboardSummary {
  success: boolean;
  period: { label: string; from: string; to: string };
  kpis: DashboardKpis;
  trends: DashboardTrends;
  revenueChart: DashboardRevenueChart;
  orderStatusSplit: DashboardOrderStatusSplit;
  weeklyOrders: DashboardWeeklyOrders;
  recentOrders: DashboardRecentOrder[];
  topProducts: DashboardTopProduct[];
  slaScorecard: DashboardSlaScorecard;
}
