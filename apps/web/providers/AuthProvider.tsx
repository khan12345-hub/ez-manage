"use client";

import {
  createContext,
  useContext,
  ReactNode,
} from "react";

import { useMe } from "@/services/auth/auth.hooks";

type AuthContextType = {
  user: any | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refetch: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const {
    data,
    isPending,
    refetch,
  } = useMe();

  const value: AuthContextType = {
    user: data ?? null,
    isLoading: isPending,
    isAuthenticated: !!data,
    refetch: () => {
      refetch();
    },
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}