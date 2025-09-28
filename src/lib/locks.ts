// Simple per-process mutex. Good for "don't run this twice at once" in
// one server instance or one browser tab. Not a distributed lock.

type Release = () => void;

// queue tail promise per key
const tails = new Map<string, Promise<void>>();

async function acquire(key: string): Promise<Release> {
  const prev = tails.get(key) ?? Promise.resolve();

  let release!: () => void;
  const curr = new Promise<void>((resolve) => (release = resolve));

  // chain current onto previous
  tails.set(key, prev.then(() => curr));

  // wait our turn
  await prev;

  // releasing resolves our promise and cleans up if we're the tail
  return () => {
    release();
    // cleanup after microtask so any next waiter can chain
    queueMicrotask(() => {
      if (tails.get(key) === curr) tails.delete(key);
    });
  };
}

/** Run `fn` exclusively per `key`. */
export async function withLock<T>(key: string, fn: () => Promise<T> | T): Promise<T> {
  const release = await acquire(key);
  try {
    return await fn();
  } finally {
    release();
  }
}
