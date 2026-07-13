// components/layouts/GuestHeader.tsx

import Link from "next/link";

export function GuestHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link
          href="/"
          className="text-2xl font-bold tracking-tight text-primary transition-opacity hover:opacity-80"
        >
          EzManage
        </Link>
      </div>
    </header>
  );
}