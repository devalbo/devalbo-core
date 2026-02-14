import { createContext, useContext, type Context } from 'react';
import type { DevalboStore } from '../store';

export const StoreContext: Context<DevalboStore | null> = createContext<DevalboStore | null>(null);

export const useStore = (): DevalboStore => {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error('StoreContext is not available');
  }
  return store;
};
