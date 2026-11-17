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

export function categoryPath(category: Pick<CategoryDto, 'name' | 'ancestors'> | null | undefined): string {
  if (!category) {
    return '';
  }

  const ancestors = [...(category.ancestors ?? [])]
    .reverse()
    .map((item) => item.name)
    .filter(Boolean);

  return [...ancestors, category.name].filter(Boolean).join(' / ');
}

export interface CategoryProductLinkDto {
  id: string;
  name: string;
  code: string | null;
  imagePath: string | null;
  isLinked: boolean;
}

export interface CategorySupplierLinkDto {
  id: string;
  companyName: string;
  primaryEmail: string | null;
  country: string | null;
  isLinked: boolean;
}

export interface CreateCategoryFormValue {
  name: string;
  description: string;
  parentCategoryId: string | null;
  productIds: string[];
  supplierIds: string[];
}

export interface UpdateCategoryFormValue {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  parentCategoryId: string | null;
}
