export enum ProductScope {
  General = 1,
  VesselSpecific = 2,
}

/** Shelf-life duration unit (not a calendar expiry date). */
export enum ShelfLifeUnit {
  Day = 1,
  Week = 2,
  Month = 3,
  Year = 4,
}

export const SHELF_LIFE_UNIT_LABELS: Record<ShelfLifeUnit, string> = {
  [ShelfLifeUnit.Day]: 'Day',
  [ShelfLifeUnit.Week]: 'Week',
  [ShelfLifeUnit.Month]: 'Month',
  [ShelfLifeUnit.Year]: 'Year',
};

export const SHELF_LIFE_UNIT_PLURAL_LABELS: Record<ShelfLifeUnit, string> = {
  [ShelfLifeUnit.Day]: 'Days',
  [ShelfLifeUnit.Week]: 'Weeks',
  [ShelfLifeUnit.Month]: 'Months',
  [ShelfLifeUnit.Year]: 'Years',
};

export function formatShelfLife(
  value: number | null | undefined,
  unit: ShelfLifeUnit | number | null | undefined,
): string | null {
  if (value == null || unit == null) {
    return null;
  }
  const amount = Number(value);
  const unitValue = Number(unit) as ShelfLifeUnit;
  if (!Number.isFinite(amount) || amount <= 0 || !(unitValue in SHELF_LIFE_UNIT_LABELS)) {
    return null;
  }
  const label =
    amount === 1
      ? SHELF_LIFE_UNIT_LABELS[unitValue]
      : SHELF_LIFE_UNIT_PLURAL_LABELS[unitValue];
  return `${Math.trunc(amount)} ${label}`;
}

export interface CategoryDto {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  parentCategoryId: string | null;
  parentName: string | null;
  ancestors: CategoryDto[];
  children: CategoryDto[];
}

export interface CategoryLookupDto {
  id: string;
  name: string;
  parentCategoryId: string | null;
  parentName: string | null;
}

export interface VesselDto {
  id: string;
  name: string;
}

export interface ProductVesselStockDto {
  vesselId: string;
  vesselName: string;
  quantityOnHand: number;
}

export interface ProductListDto {
  id: string;
  name: string;
  imagePath: string | null;
  categoryName: string | null;
  quantityOnHand: number | null;
  vesselNames: string[];
}

export interface ProductDto {
  id: string;
  categoryId: string | null;
  categoryName: string | null;
  name: string;
  code: string | null;
  defaultUnit: string;
  description: string | null;
  imagePath: string | null;
  shelfLifeValue: number | null;
  shelfLifeUnit: ShelfLifeUnit | null;
  isActive: boolean;
  vesselStocks: ProductVesselStockDto[];
  scope?: ProductScope;
}

export interface CreateProductFormValue {
  scope: ProductScope;
  vesselIds: string[];
  categoryId: string;
  name: string;
  code: string;
  defaultUnit: string;
  description: string;
  shelfLifeValue: number | null;
  shelfLifeUnit: ShelfLifeUnit | null;
  quantityOnHand: number;
  image: File | null;
}

export interface UpdateProductFormValue {
  id: string;
  name: string;
  code: string;
  defaultUnit: string;
  description: string;
  shelfLifeValue: number | null;
  shelfLifeUnit: ShelfLifeUnit | null;
  scope: ProductScope;
  isActive: boolean;
  image: File | null;
}
