/**
 * Query Builder & Filter System
 * Adapted from NocoBase's query/filter patterns
 * Type-safe API query construction with filtering, sorting, pagination
 */

"use client";

export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: any;
  logic?: "and" | "or";
}

export interface SortSpecification {
  field: string;
  direction: "asc" | "desc";
  order?: number;
}

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
  offset?: number;
  limit?: number;
}

export type FilterOperator =
  | "eq"
  | "neq"
  | "contains"
  | "notContains"
  | "like"
  | "notLike"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "nin"
  | "between"
  | "notBetween"
  | "empty"
  | "notEmpty"
  | "regex"
  | "startsWith"
  | "endsWith";

export class QueryBuilder {
  private filters: Map<string, FilterCondition[]> = new Map();
  private sorts: SortSpecification[] = [];
  private pagination: PaginationOptions = { page: 1, pageSize: 20 };
  private fields?: string[];
  private groupLogic: "and" | "or" = "and";

  /**
   * Add a filter condition
   */
  addFilter(condition: FilterCondition): this {
    const key = condition.field;
    if (!this.filters.has(key)) {
      this.filters.set(key, []);
    }
    this.filters.get(key)!.push(condition);
    return this;
  }

  /**
   * Add condition: field equals value
   */
  eq(field: string, value: any): this {
    return this.addFilter({ field, operator: "eq", value });
  }

  /**
   * Add condition: field does not equal value
   */
  neq(field: string, value: any): this {
    return this.addFilter({ field, operator: "neq", value });
  }

  /**
   * Add condition: field contains value (partial match)
   */
  contains(field: string, value: string): this {
    return this.addFilter({ field, operator: "contains", value });
  }

  /**
   * Add condition: field does not contain value
   */
  notContains(field: string, value: string): this {
    return this.addFilter({ field, operator: "notContains", value });
  }

  /**
   * Add condition: field matches pattern (SQL LIKE)
   */
  like(field: string, pattern: string): this {
    return this.addFilter({ field, operator: "like", value: pattern });
  }

  /**
   * Add condition: field greater than value
   */
  gt(field: string, value: number | Date): this {
    return this.addFilter({ field, operator: "gt", value });
  }

  /**
   * Add condition: field greater than or equal
   */
  gte(field: string, value: number | Date): this {
    return this.addFilter({ field, operator: "gte", value });
  }

  /**
   * Add condition: field less than value
   */
  lt(field: string, value: number | Date): this {
    return this.addFilter({ field, operator: "lt", value });
  }

  /**
   * Add condition: field less than or equal
   */
  lte(field: string, value: number | Date): this {
    return this.addFilter({ field, operator: "lte", value });
  }

  /**
   * Add condition: field in array of values
   */
  in(field: string, values: any[]): this {
    return this.addFilter({ field, operator: "in", value: values });
  }

  /**
   * Add condition: field not in array of values
   */
  nin(field: string, values: any[]): this {
    return this.addFilter({ field, operator: "nin", value: values });
  }

  /**
   * Add condition: field is between two values
   */
  between(field: string, min: any, max: any): this {
    return this.addFilter({ field, operator: "between", value: [min, max] });
  }

  /**
   * Add condition: field is empty
   */
  empty(field: string): this {
    return this.addFilter({ field, operator: "empty", value: null });
  }

  /**
   * Add condition: field is not empty
   */
  notEmpty(field: string): this {
    return this.addFilter({ field, operator: "notEmpty", value: null });
  }

  /**
   * Add condition: field matches regex pattern
   */
  regex(field: string, pattern: string | RegExp): this {
    return this.addFilter({
      field,
      operator: "regex",
      value: pattern instanceof RegExp ? pattern.source : pattern,
    });
  }

  /**
   * Add sort specification
   */
  sort(field: string, direction: "asc" | "desc" = "asc"): this {
    const order = this.sorts.length;
    this.sorts.push({ field, direction, order });
    return this;
  }

  /**
   * Clear all sorts and add new sort
   */
  resetSort(field: string, direction: "asc" | "desc" = "asc"): this {
    this.sorts = [];
    return this.sort(field, direction);
  }

  /**
   * Set pagination
   */
  paginate(page: number, pageSize: number = 20): this {
    this.pagination = { page, pageSize };
    return this;
  }

  /**
   * Set offset-based pagination
   */
  offset(offset: number, limit: number = 20): this {
    this.pagination = { offset, limit };
    return this;
  }

  /**
   * Set fields to retrieve (column projection)
   */
  select(...fields: string[]): this {
    this.fields = fields;
    return this;
  }

  /**
   * Set grouping logic for filters (AND/OR)
   */
  setGroupLogic(logic: "and" | "or"): this {
    this.groupLogic = logic;
    return this;
  }

  /**
   * Build query as API search params
   */
  toParams(): URLSearchParams {
    const params = new URLSearchParams();

    // Add filters
    if (this.filters.size > 0) {
      const filterArray: any[] = [];
      this.filters.forEach((conditions, field) => {
        conditions.forEach((condition) => {
          filterArray.push(condition);
        });
      });

      if (filterArray.length > 0) {
        params.append(
          "filters",
          JSON.stringify({
            logic: this.groupLogic,
            conditions: filterArray,
          }),
        );
      }
    }

    // Add sorts
    if (this.sorts.length > 0) {
      params.append("sorts", JSON.stringify(this.sorts));
    }

    // Add pagination
    if (this.pagination.page !== undefined) {
      params.append("page", this.pagination.page.toString());
    }
    if (this.pagination.pageSize !== undefined) {
      params.append("pageSize", this.pagination.pageSize.toString());
    }
    if (this.pagination.offset !== undefined) {
      params.append("offset", this.pagination.offset.toString());
    }
    if (this.pagination.limit !== undefined) {
      params.append("limit", this.pagination.limit.toString());
    }

    // Add field selection
    if (this.fields && this.fields.length > 0) {
      params.append("fields", JSON.stringify(this.fields));
    }

    return params;
  }

  /**
   * Build query as object (for POST requests)
   */
  toQueryObject(): Record<string, any> {
    const query: Record<string, any> = {};

    if (this.filters.size > 0) {
      const filterArray: any[] = [];
      this.filters.forEach((conditions, field) => {
        conditions.forEach((condition) => {
          filterArray.push(condition);
        });
      });
      if (filterArray.length > 0) {
        query.filters = {
          logic: this.groupLogic,
          conditions: filterArray,
        };
      }
    }

    if (this.sorts.length > 0) {
      query.sorts = this.sorts;
    }

    if (this.pagination.page !== undefined) {
      query.page = this.pagination.page;
    }
    if (this.pagination.pageSize !== undefined) {
      query.pageSize = this.pagination.pageSize;
    }
    if (this.pagination.offset !== undefined) {
      query.offset = this.pagination.offset;
    }
    if (this.pagination.limit !== undefined) {
      query.limit = this.pagination.limit;
    }

    if (this.fields && this.fields.length > 0) {
      query.fields = this.fields;
    }

    return query;
  }

  /**
   * Build complete URL with query string (for GET requests)
   */
  toUrl(baseUrl: string): string {
    const url = new URL(baseUrl);
    const params = this.toParams();
    params.forEach((value, key) => {
      url.searchParams.append(key, value);
    });
    return url.toString();
  }

  /**
   * Clear all filters
   */
  clearFilters(): this {
    this.filters.clear();
    return this;
  }

  /**
   * Clear all sorts
   */
  clearSorts(): this {
    this.sorts = [];
    return this;
  }

  /**
   * Clear all settings (reset to initial state)
   */
  clear(): this {
    this.filters.clear();
    this.sorts = [];
    this.pagination = { page: 1, pageSize: 20 };
    this.fields = undefined;
    return this;
  }

  /**
   * Get current filters
   */
  getFilters(): FilterCondition[] {
    const result: FilterCondition[] = [];
    this.filters.forEach((conditions) => {
      result.push(...conditions);
    });
    return result;
  }

  /**
   * Get current sorts
   */
  getSorts(): SortSpecification[] {
    return [...this.sorts];
  }

  /**
   * Get current pagination
   */
  getPagination(): PaginationOptions {
    return { ...this.pagination };
  }

  /**
   * Clone this query builder
   */
  clone(): QueryBuilder {
    const cloned = new QueryBuilder();
    cloned.filters = new Map(this.filters);
    cloned.sorts = [...this.sorts];
    cloned.pagination = { ...this.pagination };
    cloned.fields = this.fields ? [...this.fields] : undefined;
    cloned.groupLogic = this.groupLogic;
    return cloned;
  }
}

/**
 * Factory function for convenient query building
 */
export function query(): QueryBuilder {
  return new QueryBuilder();
}

/**
 * Pre-built queries for common patterns
 */
export const QueryPatterns = {
  /**
   * Search query (matches common search fields)
   */
  search: (searchTerm: string, ...fields: string[]) => {
    const qb = new QueryBuilder();
    fields.forEach((field, index) => {
      if (index > 0) {
        qb.setGroupLogic("or");
      }
      qb.contains(field, searchTerm);
    });
    return qb;
  },

  /**
   * Status filter
   */
  byStatus: (status: string | string[]) => {
    const qb = new QueryBuilder();
    if (Array.isArray(status)) {
      qb.in("status", status);
    } else {
      qb.eq("status", status);
    }
    return qb;
  },

  /**
   * Date range filter
   */
  dateRange: (field: string, startDate: Date, endDate: Date) => {
    return new QueryBuilder().between(field, startDate, endDate);
  },

  /**
   * Pagination with defaults
   */
  paginated: (page: number = 1, pageSize: number = 20) => {
    return new QueryBuilder().paginate(page, pageSize);
  },
};

export default QueryBuilder;
