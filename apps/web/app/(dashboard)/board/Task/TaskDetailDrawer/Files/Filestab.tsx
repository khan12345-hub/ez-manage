interface FilesTabProps {
  task: any;
  
}
export function FilesTab({
  task,
  
}: FilesTabProps) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center px-8 text-center">
      <h3 className="text-lg font-semibold">
        No files yet
      </h3>

      <p className="mt-2 text-sm text-muted-foreground">
        Files attached to this task will
        appear here.
      </p>

      <button
        type="button"
        className="mt-5 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
      >
        Upload file
      </button>
    </div>
  );
}