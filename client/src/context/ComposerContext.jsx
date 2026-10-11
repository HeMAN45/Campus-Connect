import { createContext, lazy, Suspense, useCallback, useContext, useState } from 'react';

const Composer = lazy(() => import('../components/Composer.jsx'));
const ComposerCtx = createContext(() => {});

export function ComposerProvider({ children }) {
  const [opts, setOpts] = useState(null);
  const open = useCallback((o = {}) => setOpts({ ...o, key: Date.now() }), []);
  return (
    <ComposerCtx.Provider value={open}>
      {children}
      {opts && (
        <Suspense fallback={null}>
          <Composer key={opts.key} {...opts} onClose={() => setOpts(null)} />
        </Suspense>
      )}
    </ComposerCtx.Provider>
  );
}

export const useComposer = () => useContext(ComposerCtx);
