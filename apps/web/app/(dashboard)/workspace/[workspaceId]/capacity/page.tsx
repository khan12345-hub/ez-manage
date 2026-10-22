import WorkspaceCapacity from "./WorkspaceCapacity";

interface Props {
  params: Promise<{ workspaceId: string }>;
}

export default async function CapacityPage({ params }: Props) {
  const { workspaceId } = await params;
  return <WorkspaceCapacity workspaceId={workspaceId} />;
}
