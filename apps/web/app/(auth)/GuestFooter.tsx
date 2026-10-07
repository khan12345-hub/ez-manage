// components/layouts/GuestFooter.tsx

export function GuestFooter() {
  return (
    <footer className="border-t border-border/50 bg-background">
      <div className="container mx-auto flex h-12 items-center justify-center px-4">
        <p className="text-center text-xs text-muted-foreground/50">
          © {new Date().getFullYear()} EzManage · All rights reserved
        </p>
      </div>
    </footer>
  );
}