import ExpensesPage from "./ExpensesPage";

interface Props {
  params: Promise<{ workspaceId: string }>;
}

export default async function Page({ params }: Props) {
  const { workspaceId } = await params;
  return <ExpensesPage workspaceId={workspaceId} />;
}
