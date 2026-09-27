/**
 * Test-only stand-in for a supabase-js query builder.
 *
 * Tools chain filters (`.order()`, `.eq()`, …) and then `await` the builder, so the fake has
 * to be both chainable and thenable. Shared by the agent suites so a tool that starts using a
 * new filter does not break one test file but not the other.
 */
export class Builder<T> implements PromiseLike<{ data: T[]; error: null }> {
  #rows: T[];
  constructor(rows: T[]) {
    this.#rows = rows;
  }
  select() { return this; }
  eq() { return this; }
  gte() { return this; }
  lt() { return this; }
  ilike() { return this; }
  order() { return this; }
  limit() { return this; }
  // oxlint-disable-next-line unicorn/no-thenable -- the mock must be awaitable (tools do `await q`); a thenable is the point of the class
  then<TResult1 = { data: T[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: T[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: this.#rows, error: null }).then(onfulfilled);
  }
}

export function builder<T>(rows: T[]) {
  return new Builder<T>(rows);
}
