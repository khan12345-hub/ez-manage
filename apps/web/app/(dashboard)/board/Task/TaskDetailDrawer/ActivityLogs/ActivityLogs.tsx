interface ActivityTabProps {
  task: any;
  boardId: number;
}

export function ActivityTab({
  task,
  boardId,
}: ActivityTabProps) {
  return (
    <div className="p-5">
      <div className="flex items-start gap-3">
        <div className="mt-1 h-2 w-2 rounded-full bg-muted-foreground" />

        <div>
          <p className="text-sm">
            Task was created
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            Activity history will appear here.
          </p>
        </div>
      </div>
    </div>
  );
}