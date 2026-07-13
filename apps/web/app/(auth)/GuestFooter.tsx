// components/layouts/GuestFooter.tsx

export function GuestFooter() {
  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto flex h-16 items-center justify-center px-4">
        <p className="text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} EzManage. All rights reserved.
        </p>
      </div>
    </footer>
  );
}