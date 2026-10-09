export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface PageRequest {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function parsePage(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = Number(candidate);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function normalizePageRequest(input: PageRequest = {}) {
  const page = Number.isSafeInteger(input.page) && input.page! > 0 ? input.page! : 1;
  const requestedSize = Number.isSafeInteger(input.pageSize) && input.pageSize! > 0
    ? input.pageSize!
    : DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(requestedSize, MAX_PAGE_SIZE);
  return {
    page,
    pageSize,
    from: (page - 1) * pageSize,
    to: page * pageSize - 1,
    search: input.search?.trim() || undefined,
  };
}

export function createPageResult<T>(items: T[], total: number, page: number, pageSize: number): PageResult<T> {
  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
