// Utility to normalize API responses which may be wrapped inconsistently
export interface UnwrappedList<T = any> {
  items: T[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export function unwrapList<T = any>(res: any): UnwrappedList<T> {
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
  // Walk all the places pagination metadata could live so callers don't have to.
  const candidates = [root, root?.pagination, root?.meta, root?.data, root?.data?.pagination, data, data?.pagination, data?.meta];
  const pick = (key: string) => {
    for (const c of candidates) {
      if (c && c[key] !== undefined) return c[key];
    }
    return undefined;
  };
  return {
    items,
    total: pick('total'),
    page: pick('page'),
    limit: pick('limit'),
    totalPages: pick('totalPages'),
  };
}

export function unwrapItem(res: any): any | null {
  // Direct: axios response is { data: { status: "success", data: {...} } }
  const body = res?.data ?? res;

  // Backend wraps success responses: { status: "success", data: {...} }
  if (body && typeof body === 'object' && body.status === 'success' && 'data' in body && body.data) {
    return body.data;
  }

  // Legacy: item list extraction (for endpoints that return arrays-wrapped-as-objects)
  const { items } = unwrapList(res);
  if (items.length > 0) return items[0];
  const data = res?.data ?? res;
  if (data?.data && !Array.isArray(data.data)) return data.data;
  if (data?.user && !Array.isArray(data.user)) return data;
  return data;
}

export function unwrapArrayOrEmpty(res: any): any[] {
  return unwrapList(res).items ?? [];
}
