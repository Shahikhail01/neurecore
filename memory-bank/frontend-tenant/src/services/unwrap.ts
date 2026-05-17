// Utility to normalize API responses which may be wrapped inconsistently
export function unwrapList(res: any): { items: any[]; total?: number } {
  const data = res?.data ?? res ?? {};

  const getItems = (v: any): any[] => {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    if (Array.isArray(v.items)) return v.items;
    if (v && v.data !== undefined) return getItems(v.data);
    return [];
  };

  const root = data?.data ?? data;
  const items = getItems(root);

  const total =
    root?.total ??
    root?.pagination?.total ??
    root?.data?.total ??
    root?.data?.pagination?.total ??
    data?.total ??
    data?.pagination?.total;

  return { items, total };
}

export function unwrapItem(res: any): any | null {
  const { items } = unwrapList(res);
  if (items.length > 0) return items[0];
  const data = res?.data ?? res;
  // Handle nested data object (e.g., { status, data: { user, tokens } })
  if (data?.data && !Array.isArray(data.data)) return data.data;
  // Handle flat data object (e.g., { user, tokens } at top level of response)
  if (typeof data === "object" && data !== null && !Array.isArray(data))
    return data;
  return null;
}

export function unwrapArrayOrEmpty(res: any): any[] {
  return unwrapList(res).items ?? [];
}
