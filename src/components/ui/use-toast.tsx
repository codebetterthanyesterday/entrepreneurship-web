"use client";

import * as React from "react";

interface ToastContextType {
  toast: (message: string) => void;
  message: string | null;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = React.useState<string | null>(null);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  const toast = React.useCallback((newMessage: string) => {
    setMessage(newMessage);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setMessage(null);
    }, 2000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast, message }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
