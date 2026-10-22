import MyTimesheet from "./MyTimesheet";

interface Props {
  params: Promise<{ workspaceId: string }>;
}

export default async function TimesheetPage({ params }: Props) {
  const { workspaceId } = await params;
  return <MyTimesheet workspaceId={workspaceId} />;
}
