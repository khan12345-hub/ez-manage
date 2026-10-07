import Link from "next/link";

export function GuestHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-14 items-center px-4">
        <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
          <div className="grid h-7 w-7 grid-cols-2 gap-[3px] rotate-45">
            <div className="rounded-[2px] bg-[#FF3D57]" />
            <div className="rounded-[2px] bg-[#00CFF4]" />
            <div className="rounded-[2px] bg-[#FFCB00]" />
            <div className="rounded-[2px] bg-[#00C875]" />
          </div>
          <span className="text-base font-bold tracking-tight text-foreground">EzManage</span>
        </Link>
      </div>
    </header>
  );
}