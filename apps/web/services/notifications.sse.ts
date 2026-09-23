export interface FileImportProgress {
  boardId: number;
  pending: number;
  done: number;
  total: number;
}

export function connectNotificationStream(
  onNotification: (notification: any) => void,
  onFileImportProgress?: (progress: FileImportProgress) => void,
  onBoardUpdate?: (data: { boardId: number }) => void,
  onBoardsUpdated?: (data: { workspaceId: number }) => void,
) {
  const url = `${process.env.NEXT_PUBLIC_API_URL}/notifications/stream`;

  const eventSource = new EventSource(url, { withCredentials: true });

  eventSource.addEventListener("notification", (event) => {
    try { onNotification(JSON.parse(event.data)); } catch {}
  });

  eventSource.addEventListener("file_import_progress", (event) => {
    try { onFileImportProgress?.(JSON.parse(event.data)); } catch {}
  });

  // Automation ran and changed board data (e.g. MOVE_TO_GROUP).
  eventSource.addEventListener("board_update", (event) => {
    try { onBoardUpdate?.(JSON.parse(event.data)); } catch {}
  });

  // A board was deleted — sidebar needs to refresh.
  eventSource.addEventListener("boards_updated", (event) => {
    try { onBoardsUpdated?.(JSON.parse(event.data)); } catch {}
  });

  eventSource.onmessage = (event) => {
    try { onNotification(JSON.parse(event.data)); } catch {}
  };

  return () => eventSource.close();
}