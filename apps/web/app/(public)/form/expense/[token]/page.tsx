import { PublicExpenseForm } from "./PublicExpenseForm";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function Page({ params }: PageProps) {
  const { token } = await params;
  if (!token?.trim()) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Invalid form link.</p>
      </div>
    );
  }
  return <PublicExpenseForm token={token} />;
}
