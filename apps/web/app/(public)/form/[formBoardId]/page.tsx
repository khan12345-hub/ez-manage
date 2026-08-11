import { PublicBoardForm } from "../PublicBoardForm";


interface PageProps {
  params: Promise<{
    formBoardId: string;
  }>;
}

export default async function Page({ params }: PageProps) {
  const { formBoardId } = await params;

  const boardId = Number(formBoardId);

  if (!Number.isInteger(boardId) || boardId <= 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Invalid form URL.
        </p>
      </div>
    );
  }

  return <PublicBoardForm boardId={boardId} />;
}