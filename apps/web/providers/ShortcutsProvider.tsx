"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";

type ShortcutCallback = () => void;

type Shortcut = {
  keys: string;
  callback: ShortcutCallback;
};

type ShortcutsContextType = {
  register: (keys: string, callback: ShortcutCallback) => () => void;
};

const ShortcutsContext = createContext<ShortcutsContextType | null>(null);

export function ShortcutsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const shortcuts = useRef<Shortcut[]>([]);

  const register = useCallback(
    (keys: string, callback: ShortcutCallback) => {
      shortcuts.current.push({ keys, callback });

      return () => {
        shortcuts.current = shortcuts.current.filter(
          (shortcut) =>
            shortcut.keys !== keys || shortcut.callback !== callback,
        );
      };
    },
    [],
  );

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const key = [
        e.ctrlKey ? "ctrl" : "",
        e.metaKey ? "meta" : "",
        e.shiftKey ? "shift" : "",
        e.altKey ? "alt" : "",
        e.key.toLowerCase(),
      ]
        .filter(Boolean)
        .join("+");

      const shortcut = shortcuts.current.find(
        (item) => item.keys === key,
      );

      if (!shortcut) return;

      e.preventDefault();

      shortcut.callback();
    };

    window.addEventListener("keydown", handle);

    return () =>
      window.removeEventListener("keydown", handle);
  }, []);

  return (
    <ShortcutsContext.Provider value={{ register }}>
      {children}
    </ShortcutsContext.Provider>
  );
}

export function useShortcuts() {
  const context = useContext(ShortcutsContext);

  if (!context) {
    throw new Error(
      "useShortcuts must be used within ShortcutsProvider",
    );
  }

  return context;
}