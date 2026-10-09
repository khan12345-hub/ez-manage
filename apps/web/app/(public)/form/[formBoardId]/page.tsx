import { PublicBoardForm } from "../PublicBoardForm";

interface PageProps {
  params: Promise<{
    formBoardId: string;
  }>;
}

export default async function Page({ params }: PageProps) {
  const { formBoardId } = await params;

  if (!formBoardId?.trim()) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Invalid form URL.</p>
      </div>
    );
  }

  return <PublicBoardForm identifier={formBoardId} />;
}