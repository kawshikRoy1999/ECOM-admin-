/** A row in the order list (OrderMasterV2). */
export interface OrderListItem {
  orderId: number;
  custOrdNo: string;
  orderDateStr: string;
  statusName: string;
  cancelReason: string;
  firstName: string;
  lastName: string;
  middleName: string;
  city: string;
  phone: string;
  pin: string;
  subTotal: number;
  tax: number;
  discount: number;
  delvCharge: number;
  total: number;
  paidAmount: number;
  isDeliver: boolean;
}

export interface OrderListResponse {
  totalRecord: number;
  totalPageNumber: number;
  recordFrom: number;
  recordTo: number;
  orderListV2: OrderListItem[];
}

/** A refund row (orderDetailV2 / OrderDetailV2). */
export interface RefundItem {
  orderId: number;
  orderDetailId: number;
  custOrdNo: string;
  invoiceNumber: string;
  items: string;
  itemQty: number;
  itemRate: number;
  itemTotalAmountAtInvoice: number;
  orderDetailsStatusName: string;
  invoiceLineItemStatus: string;
}

/** A return row (returnItems / ReturnItemResponseList). */
export interface ReturnItem {
  returnItemId: string;
  orderDetaiId: number;
  orderId: number;
  itemName: string;
  itemQty: number | null;
  statusName: string;
  statusId: number | null;
  amount: number;
  returnReason: string;
  imagePath: string;
  pickupDate: string | null;
}

/** Order list filters. */
export interface OrderFilters {
  cName: string;
  orderno: string;
  custphone: string;
  pinCode: string;
  fromDate: string;
  toDate: string;
  pageNo: number;
  custOrdStatus: string;
}

/** ---- Order detail (subset of ResponseOrder) ---- */
export interface OrderInfo {
  orderId: number;
  orderNo: string;
  orderDateString: string;
  customerName: string;
  deliveryPIN: string;
  customerSpecialInstuctions: string;
  // Delivery address & contact
  deliveryAddress1: string;
  deliveryAddress2: string;
  deliveryCity: string;
  deliveryDistrict: string;
  deliveryState: string;
  deliveryPhone: string;
  deliveryEmail: string;
  // Totals (legacy)
  totalamt: number;
  totaltaxamt: number;
  deliverychargeamt: number;
  grandtotalamt: number;
  discount_total: string;
  discount_code: string;
  // Richer amount breakdown
  orderedAmount: number;
  taxTotAmt: number;
  discountAmount: number;
  netPayableAmt: number;
  paidAmount: number;
  invDeliveryCharge: number;
  invoicedAmount: number | null;
  invoicedNetPayableAmt: number | null;
  // Per-item rate rows
  data: ItemRateQty[];
}

export interface OrderItem {
  orderDetailId: number;
  itemId: number;
  itemVariantId: number;
  itemCode: string;
  itemName: string;
  itemVariantName: string;
  orderQty: number;
  deliveredQty: number | null;
  orderStatus: string;
  brandName: string;
  categoryName: string;
  isSerialized: boolean;
  imagePath: string;
  invoiceNumber: string;
  invoiceLineItemStatus: string;
  cancelReason: string;
  unitName: string;
}

/** Per-item rate/amount row from order.data (ItemRateQuantity). */
export interface ItemRateQty {
  id: number;
  variantid: number;
  image: string;
  name: string;
  rate: number;
  quantity: number;
  itemamt: number;
  taxrate: string;
  taxamt: number;
  itemtotalamount: number;
  itemstatus: string;
}

/** A warehouse/store holding stock for an item. */
export interface Warehouse {
  storeId: number;
  storeName: string;
}

/** A storage bin with available quantity. */
export interface StockBin {
  id: number;
  name: string;
  qty: number;
}

export interface PaymentRow {
  date: string;
  mode: string;
  userName: string;
  amount: string;
}

export interface OrderLog {
  createdBy: string;
  message: string;
  createdAt: string;
  logFrom: string;
}

export interface PaymentStatusOption {
  paymentStatuslkupid: number;
  paymentStatuslkupvalue: string;
}
export interface DeliveryStatusOption {
  deliveryStatuslkupid: number;
  deliveryStatuslkupvalue: string;
}

export interface OrderDetail {
  invId: number;
  invoiceNo: string;
  invoiceDateAndTime: string;
  invoiceGeneratedby: string;
  customerPaidAmount: number;
  paymentNotes: string;
  deliveryNotes: string;
  delvTrackingUrl: string;
  delvTrackingId: string;
  refundtobePaidtoCustomer: number;
  order?: OrderInfo;
  orderDtl?: OrderItem[];
  paymentDtl?: PaymentRow[];
  logs?: OrderLog[];
  paymentStatus?: PaymentStatusOption[];
  deliveryStatus?: DeliveryStatusOption[];
  selectedPaymentStatus?: PaymentStatusOption;
  selectedDeliveryStatus?: DeliveryStatusOption;
  invoiceTrackingDetail?: InvoiceTracking[];
}

/** Per-invoice tracking entry from ResponseOrder.InvoiceTrackingDetail. */
export interface InvoiceTracking {
  invoiceId: number;
  invoiceNumber: string;
  invoiceDate: string;
  storeId: number;
  deliveryPersonId: string;
  invoiceStatusId: number;
  invoiceLineItemStatu: string;
  delvTrackingId: string;
  delvTrackingUrl: string;
}

/** Delivery person option for assignment dropdown. */
export interface DeliveryPersonOption {
  userId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  phone: string;
}

/** Payload for SavePaymentAndDeliveryStatus. */
export interface UpdateStatusPayload {
  orderId: number;
  invoiceId: number;
  invId: number;
  paymentStatusValue: string;
  delvStatusLkupValue: string;
  paymentNote: string;
  delvNote: string;
  paidAmt: number;
  delvChargeAmt: number;
  delvTrackingUrl: string;
  delvTrackingId: string;
}
