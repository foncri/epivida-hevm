const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

export function clampPageSize(value, fallback = DEFAULT_PAGE_SIZE) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(parsed)));
}

export function createCursorState(pageSize = DEFAULT_PAGE_SIZE) {
  return {
    pageSize: clampPageSize(pageSize),
    page: 0,
    firstCursor: null,
    lastCursor: null,
    previous: [],
    hasNext: false,
    hasPrevious: false
  };
}

export function getCursorState(state = {}) {
  return {
    pageSize: clampPageSize(state.pageSize),
    page: Math.max(0, Number(state.page) || 0),
    firstCursor: state.firstCursor || null,
    lastCursor: state.lastCursor || null,
    previous: Array.isArray(state.previous) ? [...state.previous] : [],
    hasNext: Boolean(state.hasNext),
    hasPrevious: Boolean(state.hasPrevious)
  };
}

export function resetPagination(state = {}) {
  Object.assign(state, createCursorState(state.pageSize));
  return state;
}

export async function loadNextPage(state, loader) {
  const current = getCursorState(state);
  const result = await loader({
    direction: "next",
    pageSize: current.pageSize,
    cursor: current.lastCursor,
    state: current
  });
  const previous = current.firstCursor ? [...current.previous, current.firstCursor] : current.previous;
  Object.assign(state, {
    pageSize: current.pageSize,
    page: current.page + 1,
    firstCursor: result.firstCursor || null,
    lastCursor: result.lastCursor || null,
    previous,
    hasNext: Boolean(result.hasNext),
    hasPrevious: previous.length > 0
  });
  return result;
}

export async function loadPreviousPage(state, loader) {
  const current = getCursorState(state);
  const previous = [...current.previous];
  const cursor = previous.pop() || null;
  const result = await loader({
    direction: "previous",
    pageSize: current.pageSize,
    cursor: current.firstCursor,
    state: current
  });
  Object.assign(state, {
    pageSize: current.pageSize,
    page: Math.max(0, current.page - 1),
    firstCursor: result.firstCursor || cursor,
    lastCursor: result.lastCursor || null,
    previous,
    hasNext: true,
    hasPrevious: previous.length > 0
  });
  return result;
}
