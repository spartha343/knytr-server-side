export const productSearchableFields: string[] = [
  "name",
  "description",
  "slug"
];

export const productFilterableFields: string[] = [
  "searchTerm",
  "categoryId",
  "brandId",
  "storeId",
  "isActive",
  "isPublished",
  "isFeatured",
  "minPrice",
  "maxPrice",
  "includeVariants"
];

export const productRelationalFields: string[] = ["category", "brand", "store"];
export const productRelationalFieldsMapper: Record<string, string> = {
  category: "categoryId",
  brand: "brandId",
  store: "storeId"
};
