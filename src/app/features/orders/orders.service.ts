import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import {
  DeliveryPersonOption,
  OrderDetail,
  OrderFilters,
  OrderItem,
  OrderListResponse,
  RefundItem,
  ReturnItem,
  StockBin,
  UpdateStatusPayload,
  Warehouse,
} from './order.models';

/** A per-item stock allocation for invoice generation. */
export interface InvoiceAllocation {
  item: OrderItem;
  warehouseId: number;
  warehouseName: string;
  binId: number;
  binName: string;
  qty: number;
}

/** Maps an order tab (custOrdStatus) to its gateway endpoint. */
const TAB_ENDPOINT: Record<string, string> = {
  '': 'ProductManagement/GetOrderListNew',
  cancelrequested: 'ProductManagement/GetOrderListCancelRequestNew',
  cancelled: 'ProductManagement/GetOrderListCancelNew',
  delivered: 'ProductManagement/GetOrderListDelivered',
};

@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  list(filters: Partial<OrderFilters>): Observable<OrderListResponse> {
    const status = filters.custOrdStatus ?? '';
    const endpoint = TAB_ENDPOINT[status] ?? TAB_ENDPOINT[''];
    return this.api.post<OrderListResponse>(endpoint, {
      companyid: this.auth.companyId(),
      cName: filters.cName ?? '',
      orderno: filters.orderno ?? '',
      custphone: filters.custphone ?? '',
      pinCode: filters.pinCode ?? '',
      // wide default range avoids DateTime.MinValue rejection server-side
      fromDate: filters.fromDate || '2000-01-01',
      toDate: filters.toDate || new Date().toISOString().slice(0, 10),
      pageNo: filters.pageNo ?? 1,
      recordPerPage: 20,
      custOrdStatus: status,
      ispageload: true,
      fetchOrder: true,
    });
  }

  /** Refund tab — order-detail-level rows. */
  listRefunds(filters: Partial<OrderFilters>): Observable<RefundItem[]> {
    return this.api
      .post<{ orderDetailV2?: RefundItem[] }>('ProductManagement/GetOrderRefund', {
        companyid: this.auth.companyId(),
        cName: filters.cName ?? '',
        orderno: filters.orderno ?? '',
        custphone: filters.custphone ?? '',
        pinCode: filters.pinCode ?? '',
        fromDate: filters.fromDate || '2000-01-01',
        toDate: filters.toDate || new Date().toISOString().slice(0, 10),
        pageNo: filters.pageNo ?? 1,
        recordPerPage: 20,
        ispageload: true,
      })
      .pipe(map((d) => d?.orderDetailV2 ?? []));
  }

  approveRefund(orderId: number, orderDetailId: number): Observable<unknown> {
    return this.api.post('ProductManagement/ApproveRefund', {
      OrderId: orderId,
      CompanyId: this.auth.companyId(),
      OrderDetailId: orderDetailId,
      CreatedBy: this.auth.userId(),
      UserName: this.auth.displayName(),
    });
  }

  /** Return tab — return-item rows. */
  listReturns(filters: Partial<OrderFilters>): Observable<ReturnItem[]> {
    return this.api
      .post<{ returnItems?: ReturnItem[] }>('ProductManagement/GetReturnItems', {
        CompanyId: this.auth.companyId(),
        PageNo: filters.pageNo ?? 1,
        PageSize: 20,
      })
      .pipe(map((d) => d?.returnItems ?? []));
  }

  updateReturnStatus(r: ReturnItem, statusId: number): Observable<unknown> {
    return this.api.post('ProductManagement/UpdateReturnItemStatus', {
      ReturnItemId: r.returnItemId,
      StatusId: statusId,
      CompanyId: this.auth.companyId(),
      OrderDetailId: r.orderDetaiId,
      OrderId: r.orderId,
      PickupDate: r.pickupDate,
    });
  }

  detail(orderId: number): Observable<OrderDetail> {
    return this.api.post<OrderDetail>('ProductManagement/GetOrderDetail', {
      OrderId: orderId,
      companyid: this.auth.companyId(),
      userId: this.auth.userId(),
    });
  }

  // --- Invoice generation (warehouse / bin allocation) ---
  warehouses(itemId: number, variantId: number): Observable<Warehouse[]> {
    return this.api
      .post<{ storeList?: Warehouse[] }>('ProductManagement/GetWarehouseDetails', {
        ItemId: itemId,
        VariantId: variantId,
        CompanyId: this.auth.companyId(),
      })
      .pipe(map((d) => d?.storeList ?? []));
  }

  bins(itemId: number, variantId: number, warehouseId: number): Observable<StockBin[]> {
    return this.api.post<StockBin[]>('ProductManagement/GetBinList', {
      ItemId: itemId,
      VariantId: variantId,
      WarehouseId: warehouseId,
      CompanyId: this.auth.companyId(),
    });
  }

  generateInvoice(
    orderId: number,
    allocations: InvoiceAllocation[],
    payment: { mode: string; status: string; note: string; isLastInvoice: boolean },
  ): Observable<unknown> {
    return this.api.post('ProductManagement/GenerateInvoiceForDelivery', {
      CompanyId: this.auth.companyId(),
      OrderId: orderId,
      UserId: this.auth.userId(),
      UserName: this.auth.displayName(),
      PaymentMode: payment.mode,
      PaymentStatus: payment.status,
      PaymentNote: payment.note,
      IsLastInvoice: payment.isLastInvoice,
      InvoiceOrderDetail: allocations.map((a, i) => ({
        ItemId: a.item.itemId,
        ItemVariantId: a.item.itemVariantId,
        OrderDetailId: a.item.orderDetailId,
        InvoiceQty: a.qty,
        Status: '',
        StockId: 0,
        Index: i,
        SerialNumber: '',
        IsSerialized: a.item.isSerialized ? '1' : '0',
      })),
      WarehouseData: allocations.map((a, i) => ({
        VariantId: a.item.itemVariantId,
        ItemId: a.item.itemId,
        Index: i,
        DataList: [{
          WarehouseId: a.warehouseId,
          Warehouse: a.warehouseName,
          BinId: a.binId,
          Bin: a.binName,
          BatchCode: null,
          Qty: a.qty,
        }],
      })),
    });
  }

  /** Update payment + delivery status (SaveUpdateInvoiceDetail). */
  updateStatus(p: UpdateStatusPayload): Observable<unknown> {
    return this.api.post('ProductManagement/SavePaymentAndDeliveryStatus', {
      OrderId: p.orderId,
      InvoiceId: p.invoiceId,
      InvId: p.invId,
      CompanyId: this.auth.companyId(),
      UserId: this.auth.userId(),
      InvGenUId: this.auth.userId(),
      PaymentStatusValue: p.paymentStatusValue,
      DelvStatusLkupValue: p.delvStatusLkupValue,
      PaymentNote: p.paymentNote,
      DelvNote: p.delvNote,
      PaidAmt: p.paidAmt,
      DelvChargeAmt: p.delvChargeAmt,
      DelvTrackingUrl: p.delvTrackingUrl,
      DelvTrackingId: p.delvTrackingId,
    });
  }

  /** Fetch the rendered invoice HTML for display/print (GetStatementInv). */
  getStatement(invoiceNo: string): Observable<{ html: string; htmlc: string }> {
    return this.api
      .postRaw<{ html: string; htmlc: string }>('ProductManagement/GetStatementInv', {
        invoiceNo,
        companyId: this.auth.companyId(),
      })
      .pipe(
        map((res) => {
          // gateway may return direct {html,htmlc} or wrapped {data:{html,htmlc}}
          const d = (res as any)?.data ?? res;
          return { html: d?.html ?? '', htmlc: d?.htmlc ?? '' };
        }),
      );
  }

  /** Delivery persons assigned to a specific warehouse (by storeId). */
  getDeliveryPersonsByWarehouse(warehouseId: number): Observable<DeliveryPersonOption[]> {
    return this.api
      .post<DeliveryPersonOption[]>('Delivery/GetDeliveryPersonByWarehouse', {
        WarehouseId: String(warehouseId),
        CompanyId: this.auth.companyId(),
      });
  }

  /** Assign a delivery person to an invoice. */
  assignDeliveryPerson(
    deliveryPersonId: string,
    invoiceId: number,
    warehouseId: number,
  ): Observable<unknown> {
    return this.api.post('Delivery/AssignInvoiceToDeliveryPersonByAdmin', {
      DeliveryPersonId: deliveryPersonId,
      InvoiceId: String(invoiceId),
      WarehouseId: String(warehouseId),
      CompanyId: this.auth.companyId(),
      Latitude: null,
      Longitude: null,
    });
  }

  sendInvoiceEmail(invoiceId: number): Observable<unknown> {
    return this.api.post('ProductManagement/SendInvoiceEmail', {
      InvoiceId: invoiceId,
      CompanyId: this.auth.companyId(),
    });
  }

  /** Email the customer their delivery tracking details (SendTrackingEmail). */
  sendTrackingEmail(p: {
    invId: number;
    trackingId: string;
    trackingUrl: string;
    invoiceNumber: string;
    invoiceDate: string;
  }): Observable<unknown> {
    return this.api.post('ProductManagement/SendTrackingEmail', {
      CompanyId: this.auth.companyId(),
      UserId: this.auth.userId(),
      InvId: p.invId,
      TrackingId: p.trackingId,
      TrackingUrl: p.trackingUrl,
      InvoiceNumber: p.invoiceNumber,
      InvoiceDate: p.invoiceDate,
    });
  }
}
