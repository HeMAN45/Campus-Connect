import { createContext, useCallback, useContext, useState } from 'react';

const ToastCtx = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (message, opts = {}) => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((t) => [...t.slice(-2), { id, message, ...opts }]);
      setTimeout(() => dismiss(id), opts.duration || 4000);
    },
    [dismiss],
  );
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        className="fixed z-[60] left-1/2 -translate-x-1/2 bottom-[76px] md:bottom-6 md:left-6 md:translate-x-0 flex flex-col gap-2 items-center md:items-start pointer-events-none w-[calc(100%-24px)] md:w-auto"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto bg-ink text-white text-ui px-4 py-3 rounded shadow-float flex items-center justify-between gap-4 w-full md:w-auto md:max-w-md"
          >
            <span>{t.message}</span>
            {t.action && (
              <button
                className="font-semibold text-[#A9C3E8] hover:underline shrink-0"
                onClick={() => {
                  t.action.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
