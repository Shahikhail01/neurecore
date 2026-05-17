// ─── IRepository.ts ──────────────────────────────────────────────────────────
// LSP: Any concrete repository is substitutable for any other of the same <T>.
// DIP: All services receive IRepository<T>, never a concrete class.

export interface QueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  [key: string]: string | number | boolean | undefined;
}

export interface IRepository<T, CreateDto = Partial<T>, UpdateDto = Partial<T>> {
  findAll(query?: QueryParams): Promise<{ items: T[]; total: number }>;
  findById(id: string): Promise<T | null>;
  create(data: CreateDto): Promise<T>;
  update(id: string, data: UpdateDto): Promise<T>;
  remove(id: string): Promise<void>;
}

/** Base abstract class: default caching behaviour shared by all repositories. */
export abstract class BaseRepository<T, CreateDto = Partial<T>, UpdateDto = Partial<T>>
  implements IRepository<T, CreateDto, UpdateDto>
{
  abstract findAll(query?: QueryParams): Promise<{ items: T[]; total: number }>;
  abstract findById(id: string): Promise<T | null>;
  abstract create(data: CreateDto): Promise<T>;
  abstract update(id: string, data: UpdateDto): Promise<T>;
  abstract remove(id: string): Promise<void>;

  /** Utility: build a standardised cache key from entity name + query */
  protected cacheKey(entity: string, suffix: string | QueryParams = ''): string {
    return `${entity}:${typeof suffix === 'string' ? suffix : JSON.stringify(suffix)}`;
  }
}
