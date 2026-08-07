import { FormBuilder } from "./BoardFeatureForm/FormBuilder";


interface PageProps {
  params: Promise<{
    boardId: string;
  }>;
}

export default async function NewFormPage({
  params,
}: PageProps) {
  const { boardId } = await params;

  // Replace this with your existing board/groups query.
  const groups = [] as any[];

  return (
    <FormBuilder
      boardId={Number(boardId)}
      groups={groups}
    />
  );
}