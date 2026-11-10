export enum ProductScope {
  General = 1,
  VesselSpecific = 2,
}

export interface CategoryDto {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface CategoryLookupDto {
  id: string;
  name: string;
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
  categoryName: string;
  quantityOnHand: number | null;
  vesselNames: string[];
}

export interface ProductDto {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  code: string | null;
  defaultUnit: string;
  description: string | null;
  imagePath: string | null;
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
  quantityOnHand: number;
  image: File | null;
}

export interface UpdateProductFormValue {
  id: string;
  name: string;
  code: string;
  defaultUnit: string;
  description: string;
  scope: ProductScope;
  isActive: boolean;
  image: File | null;
}
