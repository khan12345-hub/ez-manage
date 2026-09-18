export interface FileImportProgress {
  boardId: number;
  pending: number;
  done: number;
  total: number;
}

export function connectNotificationStream(
  onNotification: (notification: any) => void,
  onFileImportProgress?: (progress: FileImportProgress) => void,
) {
  const url = `${process.env.NEXT_PUBLIC_API_URL}/notifications/stream`;

  const eventSource = new EventSource(url, { withCredentials: true });

  eventSource.addEventListener("notification", (event) => {
    try {
      onNotification(JSON.parse(event.data));
    } catch {}
  });

  eventSource.addEventListener("file_import_progress", (event) => {
    try {
      onFileImportProgress?.(JSON.parse(event.data));
    } catch {}
  });

  eventSource.onmessage = (event) => {
    try {
      onNotification(JSON.parse(event.data));
    } catch {}
  };

  return () => eventSource.close();
}