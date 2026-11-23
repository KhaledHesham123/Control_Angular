export interface PaginationResponse<T> {
  count: number;
  data: T[];
  pageNumber: number;
  pageSize: number;
}

export interface QuotationItem {
  id: string;
  itemNo: string;
  partName: string;
  partNumber: string;
  quantity: number;
  unit: string;
  unitPriceUSD: number;
  totalPriceUSD: number;
  deliveryTime: string;
  remarks: string;
}

export interface QuotationListItem {
  id: string;
  quotationNo: string;
  quotationDate: string;
  supplierName: string;
  vesselName: string;
  manufacturer: string;
  engineType: string;
  paymentTerm: string;
  validity: string;
  currency: string;
  partCondition: string;
  subTotal: number;
  total: number;
  itemsCount: number;
  items: QuotationItem[];
}

export interface QuotationQuery {
  searchTerm?: string;
  pageNumber: number;
  pageSize: number;
}

export enum QuotationStatus {
  Draft = 1,
  Submitted = 2,
  Approved = 3,
  Rejected = 4,
}

export const QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
  [QuotationStatus.Draft]: 'مسودة',
  [QuotationStatus.Submitted]: 'عرض واصل',
  [QuotationStatus.Approved]: 'معتمد',
  [QuotationStatus.Rejected]: 'مرفوض',
};

export interface OfferLineInput {
  id?: string | null;
  productId: string;
  quantity: number;
  unitPrice: number;
  remarks?: string | null;
}

export interface SaveOfferCommand {
  id?: string | null;
  rfqRequestId: string;
  supplierId: string;
  notes?: string | null;
  pdfPath?: string | null;
  asDraft: boolean;
  items: OfferLineInput[];
}

export interface ReceiveLineInput {
  productId: string;
  quantity: number;
}

export interface OfferSupplierOption {
  id: string;
  companyName: string;
  primaryEmail: string | null;
  fromParentCategory: boolean;
}

export interface OfferItem {
  id: string;
  productId: string | null;
  partName: string;
  partNumber: string | null;
  quantity: number;
  unit: string;
  unitPriceUSD: number;
  totalPriceUSD: number;
  remarks: string | null;
}

export interface OfferSummary {
  id: string;
  quotationNo: string;
  supplierId: string | null;
  supplierName: string;
  status: QuotationStatus;
  quotationDate: string;
  total: number;
  pdfPath: string | null;
  notes: string | null;
  items: OfferItem[];
}

export interface OfferLinePrice {
  quotationId: string;
  supplierName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  missing: boolean;
  shortQuantity: boolean;
  aboveMarket: boolean;
}

export interface OfferComparisonLine {
  productId: string;
  name: string;
  unit: string;
  requestedQuantity: number;
  offerCount: number;
  marketAverage: number | null;
  prices: OfferLinePrice[];
}

export interface OfferComparison {
  rfqRequestId: string;
  title: string;
  vesselName: string;
  submittedAt: string;
  status: number;
  deliveryDate: string | null;
  approvedQuotationId: string | null;
  pdfPath: string | null;
  categories: { id: string; name: string; parentName: string | null }[];
  suppliers: OfferSupplierOption[];
  offers: OfferSummary[];
  lines: OfferComparisonLine[];
}
