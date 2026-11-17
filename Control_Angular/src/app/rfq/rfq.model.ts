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

export enum RfqRequestStatus {
  Draft = 1,
  ReadyToSend = 2,
  Sent = 3,
  OffersReceived = 4,
  UnderAnalysis = 5,
  DecisionPending = 6,
  Closed = 7,
}

export const RFQ_STATUS_LABELS: Record<RfqRequestStatus, string> = {
  [RfqRequestStatus.Draft]: 'Draft',
  [RfqRequestStatus.ReadyToSend]: 'Ready to send',
  [RfqRequestStatus.Sent]: 'Sent',
  [RfqRequestStatus.OffersReceived]: 'Offers received',
  [RfqRequestStatus.UnderAnalysis]: 'Under analysis',
  [RfqRequestStatus.DecisionPending]: 'Decision pending',
  [RfqRequestStatus.Closed]: 'Closed',
};

export interface RfqRequestCategoryDto {
  id: string;
  name: string;
  parentCategoryId: string | null;
  parentName: string | null;
}

export function formatCategoryLabel(category: {
  name?: string | null;
  parentName?: string | null;
}): string {
  const name = category.name?.trim() ?? '';
  const parent = category.parentName?.trim();
  if (!name) {
    return '';
  }
  return parent ? `${parent} / ${name}` : name;
}

export interface RfqRequestListItemDto {
  id: string;
  vesselId: string;
  vesselName: string;
  categories: RfqRequestCategoryDto[];
  title: string;
  notes: string | null;
  subject: string | null;
  startDate: string | null;
  deliveryDate: string | null;
  latestDeliveryDate: string | null;
  status: RfqRequestStatus;
  itemsCount: number;
  supplierEmailsCount: number;
  createdAt: string;
}

export interface CreateRfqRequestItemInput {
  productId: string;
  quantity: number;
  notes?: string | null;
}

export interface CreateRfqRequestCommand {
  title?: string | null;
  notes?: string | null;
  categoryIds: string[];
  /** Nullable — leave null on create unless set later. */
  startDate?: string | null;
  /** Nullable — leave null on create unless set later. */
  deliveryDate?: string | null;
  /** Nullable — last delivery deadline; leave null on create unless set later. */
  latestDeliveryDate?: string | null;
  items: CreateRfqRequestItemInput[];
}

export interface RfqRequestItemDto {
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

/** @deprecated Prefer RfqRequestItemDto */
export type RfqRequestItem = RfqRequestItemDto;

export interface RfqRequestConfirmItemDto {
  id: string;
  productId: string;
  categoryId: string | null;
  categoryName: string | null;
  productDescription: string | null;
  itemNo: string;
  name: string;
  code: string | null;
  quantity: number;
  unit: string;
  notes: string | null;
  shelfLifeValue: number | null;
  shelfLifeUnit: number | null;
}

export interface RfqRequestConfirmDto {
  id: string;
  vesselId: string;
  vesselName: string;
  categories: RfqRequestCategoryDto[];
  title: string;
  notes: string | null;
  startDate: string | null;
  deliveryDate: string | null;
  latestDeliveryDate: string | null;
  status: RfqRequestStatus;
  items: RfqRequestConfirmItemDto[];
}

export interface RfqRequestEmailSupplierDto {
  id: string;
  primaryEmail: string | null;
  alternateEmail: string | null;
  phone: string | null;
}

export interface RfqRequestForEmailDto {
  id: string;
  vesselName: string;
  categories: RfqRequestCategoryDto[];
  title: string;
  notes: string | null;
  suppliers: RfqRequestEmailSupplierDto[];
}

export interface ConfirmRfqRequestCommand {
  id: string;
  title: string;
  notes: string | null;
  startDate: string;
  deliveryDate: string;
  latestDeliveryDate: string;
  status: RfqRequestStatus;
  items: RfqRequestConfirmItemDto[];
}

export enum SupplierRfqEmailStatus {
  Draft = 1,
  Queued = 2,
  Sent = 3,
  Failed = 4,
  Replied = 5,
  Closed = 6,
}

export const SUPPLIER_RFQ_EMAIL_STATUS_LABELS: Record<SupplierRfqEmailStatus, string> = {
  [SupplierRfqEmailStatus.Draft]: 'Draft',
  [SupplierRfqEmailStatus.Queued]: 'Queued',
  [SupplierRfqEmailStatus.Sent]: 'Sent',
  [SupplierRfqEmailStatus.Failed]: 'Failed',
  [SupplierRfqEmailStatus.Replied]: 'Replied',
  [SupplierRfqEmailStatus.Closed]: 'Closed',
};

export interface RfqRequestSupplierEmail {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierEmail: string | null;
  subject: string;
  body: string;
  status: SupplierRfqEmailStatus;
  conversationKey: string | null;
  sentAt: string | null;
  lastInboundAt: string | null;
}

export interface PrepareSupplierRfqEmailCommand {
  rfqRequestId: string;
  supplierIds: string[];
}

export interface PrepareSupplierRfqEmailDto {
  rfqEmailId: string;
  rfqRequestId: string;
  rfqTitle: string;
  categories: RfqRequestCategoryDto[];
  supplierId: string;
  supplierName: string;
  supplierEmail: string;
  conversationKey: string;
  subject: string;
  body: string;
  status: SupplierRfqEmailStatus;
  alreadyExisted: boolean;
}

export interface SendSupplierRfqEmailItemInput {
  supplierId: string;
  subject: string;
  body: string;
}

export interface SendSupplierRfqEmailsCommand {
  rfqRequestId: string;
  items: SendSupplierRfqEmailItemInput[];
}

export interface SendSupplierRfqEmailItemResultDto {
  rfqEmailId: string | null;
  supplierId: string;
  supplierName: string | null;
  supplierEmail: string | null;
  subject: string;
  status: SupplierRfqEmailStatus | null;
  succeeded: boolean;
  providerMessageId: string | null;
  errorMessage: string | null;
}

export interface SendSupplierRfqEmailsResultDto {
  rfqRequestId: string;
  sentCount: number;
  failedCount: number;
  items: SendSupplierRfqEmailItemResultDto[];
}

export interface PrepareAllSuppliersRfqEmailDto {
  rfqRequestId: string;
  rfqTitle: string;
  categories: RfqRequestCategoryDto[];
  createdCount: number;
  alreadyExistedCount: number;
  skippedInvalidEmailCount: number;
  items: PrepareSupplierRfqEmailDto[];
}

export interface RfqRequest {
  id: string;
  vesselId: string;
  vesselName: string;
  categories: RfqRequestCategoryDto[];
  title: string;
  notes: string | null;
  subject: string | null;
  body: string | null;
  startDate: string | null;
  deliveryDate: string | null;
  latestDeliveryDate: string | null;
  status: RfqRequestStatus | number | string;
  items: RfqRequestItem[];
  supplierEmails: RfqRequestSupplierEmail[];
}

export interface GenerateEmailContentForSuppliersCommand {
  id: string;
  supplierIds: string[];
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
  categoryId: string;
  categoryName: string;
}
