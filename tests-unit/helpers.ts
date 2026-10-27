import type { TestContext } from 'node:test';

/** A Storage-like object backed by a Map, for code that reads localStorage or sessionStorage. */
export function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, String(value)); },
    removeItem: (key: string) => { values.delete(key); },
    clear: () => values.clear()
  };
}

/** Installs a global (sessionStorage, localStorage, document…) for one test and restores it afterwards. */
export function setGlobal(t: TestContext, name: string, value: unknown) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, name, previous);
    else delete (globalThis as Record<string, unknown>)[name];
  });
}

/** Sets environment variables for one test (undefined removes one) and restores them afterwards. */
export function setEnv(t: TestContext, vars: Record<string, string | undefined>) {
  const previous = Object.fromEntries(Object.keys(vars).map(key => [key, process.env[key]]));
  const apply = (entries: Record<string, string | undefined>) => {
    for (const [key, value] of Object.entries(entries)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  };
  apply(vars);
  t.after(() => apply(previous));
}

export type FetchCall = { url: string; init: RequestInit & { headers?: Record<string, string> } };

/** Replaces global fetch for one test. The handler answers each call; every call is recorded. */
export function stubFetch(t: TestContext, handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: FetchCall[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, init: init as FetchCall['init'] });
    return handler(url, init);
  });
  return calls;
}

export const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } });
