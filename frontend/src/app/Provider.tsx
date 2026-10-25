import { MotionConfig } from 'motion/react';
import { createContext, useContext, useEffect, useReducer, useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { createSeed } from '../data/mock/seed';
import { demoReducer, type DemoAction } from '../data/mock/service';
import type { DemoState } from '../types';
interface Context {
  state: DemoState;
  dispatch: React.Dispatch<DemoAction>;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}
const DemoContext = createContext<Context | null>(null);
export function Provider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(demoReducer, undefined, createSeed);
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);
  return (
    <DemoContext.Provider
      value={{
        state,
        dispatch,
        theme,
        toggleTheme: () => setTheme((t) => (t === 'light' ? 'dark' : 'light')),
      }}
    >
      <MotionConfig reducedMotion="user">
        {children}
        <Toaster position="bottom-right" theme={theme} richColors closeButton />
      </MotionConfig>
    </DemoContext.Provider>
  );
}
export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error('Demo provider is missing');
  return context;
}
