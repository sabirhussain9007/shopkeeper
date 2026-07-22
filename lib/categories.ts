export type CategoryOption = {
  _id: string | { _id?: unknown; $oid?: string };
  name: string;
  parentId?: string | { _id?: unknown; $oid?: string };
  sortOrder?: number;
};

export function categoryResourceId(value?: string | { _id?: unknown; $oid?: string } | null) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    if ("_id" in value && value._id != null) return String(value._id);
    if ("$oid" in value && value.$oid) return String(value.$oid);
  }
  return String(value);
}

export function buildCategoryNameMap(categories: CategoryOption[]) {
  return new Map(categories.map((category) => [categoryResourceId(category._id), category.name]));
}

export function isCategoryDeleted(category: { deletedAt?: string | Date | null }) {
  return Boolean(category.deletedAt);
}

export function categoryParentName(category: CategoryOption, nameById: Map<string, string>) {
  const parentId = categoryResourceId(category.parentId);
  if (!parentId) return "";
  return nameById.get(parentId) ?? "";
}

function collectDescendantIds(categories: CategoryOption[], rootId: string) {
  const childrenByParent = new Map<string, string[]>();
  for (const category of categories) {
    const parentId = categoryResourceId(category.parentId);
    if (!parentId) continue;
    const siblings = childrenByParent.get(parentId) ?? [];
    siblings.push(categoryResourceId(category._id));
    childrenByParent.set(parentId, siblings);
  }

  const descendants = new Set<string>();
  const stack = [...(childrenByParent.get(rootId) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop();
    if (!id || descendants.has(id)) continue;
    descendants.add(id);
    stack.push(...(childrenByParent.get(id) ?? []));
  }
  return descendants;
}

export function activeCategories<T extends CategoryOption & { deletedAt?: string | Date | null }>(categories: T[]) {
  return categories.filter((category) => !isCategoryDeleted(category));
}

/** Top-level categories that can be chosen as a parent (no self or descendants). */
export function parentCategoryOptions(categories: CategoryOption[], editingId?: string) {
  const visible = activeCategories(categories as Array<CategoryOption & { deletedAt?: string | Date | null }>);
  const descendants = editingId ? collectDescendantIds(visible, editingId) : new Set<string>();
  return visible
    .filter((category) => {
      if (categoryResourceId(category._id) === editingId) return false;
      if (descendants.has(categoryResourceId(category._id))) return false;
      return !categoryResourceId(category.parentId);
    })
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
}

/** Flat list with indentation for product/category pickers. */
export function hierarchicalCategoryOptions(categories: CategoryOption[]) {
  const visible = activeCategories(categories as Array<CategoryOption & { deletedAt?: string | Date | null }>);
  const knownIds = new Set(visible.map((category) => categoryResourceId(category._id)));
  const childrenByParent = new Map<string, CategoryOption[]>();

  for (const category of visible) {
    const parentId = categoryResourceId(category.parentId);
    const parentKey = parentId && knownIds.has(parentId) ? parentId : "__root__";
    const siblings = childrenByParent.get(parentKey) ?? [];
    siblings.push(category);
    childrenByParent.set(parentKey, siblings);
  }

  const options: { _id: string; label: string }[] = [];

  const walk = (parentKey: string, depth: number) => {
    const siblings = (childrenByParent.get(parentKey) ?? []).sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name),
    );
    for (const category of siblings) {
      const prefix = depth > 0 ? `${"— ".repeat(depth)}` : "";
      options.push({ _id: categoryResourceId(category._id), label: `${prefix}${category.name}` });
      walk(categoryResourceId(category._id), depth + 1);
    }
  };

  walk("__root__", 0);
  return options;
}
