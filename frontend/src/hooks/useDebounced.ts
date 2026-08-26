import { useEffect, useState } from 'react';

/** Devuelve `value` retrasado `delay` ms; reinicia el temporizador en cada cambio. */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
