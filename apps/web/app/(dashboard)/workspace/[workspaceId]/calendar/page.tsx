import WorkspaceCalendar from "./WorkspaceCalendar";

interface Props {
  params: Promise<{ workspaceId: string }>;
}

export default async function WorkspaceCalendarPage({ params }: Props) {
  const { workspaceId } = await params;
  return <WorkspaceCalendar workspaceId={workspaceId} />;
}
