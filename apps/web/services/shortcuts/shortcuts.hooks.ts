"use client";

import { useEffect } from "react";
import { useShortcuts } from "@/providers/ShortcutsProvider";

export function useShortcut(
  keys: string,
  callback: () => void,
) {
  const { register } = useShortcuts();

  useEffect(() => {
    return register(keys, callback);
  }, [keys, callback, register]);
}