export function connectNotificationStream(
  onNotification: (notification: any) => void,
) {
  const url =
    "http://localhost:3001/api/notifications/stream";

  console.log("[SSE] Connecting to:", url);

  const eventSource = new EventSource(url, {
    withCredentials: true,
  });

  eventSource.onopen = () => {
    console.log("[SSE] Connection opened");
  };

  eventSource.onmessage = (event) => {
    console.log(
      "[SSE] Raw event received:",
      event.data,
    );

    try {
      const notification = JSON.parse(
        event.data,
      );

      onNotification(notification);
    } catch (error) {
      console.error(
        "[SSE] Failed to parse notification:",
        error,
      );
    }
  };

  eventSource.onerror = (error) => {
    console.error(
      "[SSE] Connection error:",
      error,
    );
  };

  return () => {
    console.log(
      "[SSE] Closing connection",
    );

    eventSource.close();
  };
}