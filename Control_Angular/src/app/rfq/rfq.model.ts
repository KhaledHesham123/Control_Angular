export interface CategoryProductItem {
  id: string;
  name: string;
  code: string | null;
  defaultUnit: string;
  description: string | null;
  isActive: boolean;
}

export interface CategoryWithProducts {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  products: CategoryProductItem[];
}

export interface CreateRfqRequestItemInput {
  productId: string;
  quantity: number;
  notes?: string | null;
}

export interface CreateRfqRequestCommand {
  notes?: string | null;
  categoryId: string;
  items: CreateRfqRequestItemInput[];
}

export interface RfqRequestItem {
  id: string;
  productId: string;
  productDescription: string | null;
  itemNo: string;
  name: string;
  code: string | null;
  quantity: number;
  unit: string;
  notes: string | null;
}

export interface RfqRequestSupplierEmail {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierEmail: string | null;
  subject: string;
  body: string;
  status: number | string;
  conversationKey: string | null;
  sentAt: string | null;
  lastInboundAt: string | null;
}

export interface RfqRequest {
  id: string;
  categoryId: string;
  categoryName: string;
  title: string;
  notes: string | null;
  subject: string | null;
  body: string | null;
  status: number | string;
  items: RfqRequestItem[];
  supplierEmails: RfqRequestSupplierEmail[];
}

export interface GenerateRfqRequestContentCommand {
  id: string;
}

export interface GeneratedSupplierRfqEmail {
  supplierId: string;
  supplierName: string;
  supplierEmail?: string | null;
  subject: string;
  body: string;
}

export interface GeneratedRfqRequestContent {
  rfqRequestId: string;
  title: string;
  subject: string;
  separator: string;
  rawEmailsText: string;
  emails: GeneratedSupplierRfqEmail[];
}

export interface SelectedRfqProduct {
  productId: string;
  name: string;
  code: string | null;
  unit: string;
  quantity: number;
  notes: string;
}
