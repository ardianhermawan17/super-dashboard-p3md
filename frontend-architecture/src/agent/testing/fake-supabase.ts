/**
 * Test-only stand-in for a supabase-js query builder.
 *
 * Tools chain filters (`.order()`, `.eq()`, …) and then `await` the builder, so the fake has
 * to be both chainable and thenable. Shared by the agent suites so a tool that starts using a
 * new filter does not break one test file but not the other.
 *
 * Filters are applied for real (eq/gte/lt/lte/ilike) so a test can assert that a tool scoped
 * its query, and `.order()`/`.limit()` behave like PostgREST.
 */
type Op = { kind: 'eq' | 'gte' | 'lt' | 'lte' | 'ilike'; column: string; value: unknown };
type Sort = { column: string; ascending: boolean };

export class Builder<T extends Record<string, unknown>> implements PromiseLike<{
  data: T[];
  error: null;
}> {
  #rows: T[];
  #ops: Op[] = [];
  #sort: Sort | null = null;
  #limit: number | null = null;

  constructor(rows: T[]) {
    this.#rows = rows;
  }

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.#ops.push({ kind: 'eq', column, value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.#ops.push({ kind: 'gte', column, value });
    return this;
  }

  lt(column: string, value: unknown) {
    this.#ops.push({ kind: 'lt', column, value });
    return this;
  }

  lte(column: string, value: unknown) {
    this.#ops.push({ kind: 'lte', column, value });
    return this;
  }

  ilike(column: string, value: unknown) {
    this.#ops.push({ kind: 'ilike', column, value });
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.#sort = { column, ascending: opts?.ascending ?? true };
    return this;
  }

  limit(n: number) {
    this.#limit = n;
    return this;
  }

  #resolve(): T[] {
    let rows = this.#rows.filter((row) =>
      this.#ops.every((op) => {
        const cell = row[op.column];
        switch (op.kind) {
          case 'eq':
            return cell === op.value;
          case 'gte':
            return typeof cell === 'string' && typeof op.value === 'string'
              ? cell >= op.value
              : Number(cell) >= Number(op.value);
          case 'lt':
            return typeof cell === 'string' && typeof op.value === 'string'
              ? cell < op.value
              : Number(cell) < Number(op.value);
          case 'lte':
            return typeof cell === 'string' && typeof op.value === 'string'
              ? cell <= op.value
              : Number(cell) <= Number(op.value);
          case 'ilike': {
            const pattern = String(op.value).replaceAll('%', '').toLowerCase();
            return String(cell ?? '').toLowerCase().includes(pattern);
          }
        }
      })
    );
    const sort = this.#sort;
    if (sort) {
      const dir = sort.ascending ? 1 : -1;
      rows = rows.toSorted((a, b) => {
        const av = a[sort.column];
        const bv = b[sort.column];
        if (av === bv) return 0;
        return (av ?? '') > (bv ?? '') ? dir : -dir;
      });
    }
    if (this.#limit !== null) rows = rows.slice(0, this.#limit);
    return rows;
  }

  // oxlint-disable-next-line unicorn/no-thenable -- the mock must be awaitable (tools do `await q`); a thenable is the point of the class
  then<TResult1 = { data: T[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: T[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: this.#resolve(), error: null }).then(onfulfilled);
  }
}

export function builder<T extends Record<string, unknown>>(rows: T[]) {
  return new Builder<T>(rows);
}