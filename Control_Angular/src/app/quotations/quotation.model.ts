export interface Result<T> {
  succeeded: boolean;
  messages: string[];
  data: T | null;
}

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
