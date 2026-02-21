import { createContext, useContext, type ReactNode } from 'react';
import type { AppConfig } from '@devalbo/shared';

export const AppConfigContext = createContext<AppConfig | null>(null);

export const AppConfigProvider: React.FC<{ config: AppConfig; children: ReactNode }> = ({ config, children }) => (
  <AppConfigContext.Provider value={config}>{children}</AppConfigContext.Provider>
);

export const useAppConfig = (): AppConfig => {
  const ctx = useContext(AppConfigContext);
  if (!ctx) throw new Error('useAppConfig must be used inside AppConfigProvider');
  return ctx;
};
