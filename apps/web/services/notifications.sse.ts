export function connectNotificationStream(
  onNotification: (notification: any) => void,
) {
  const url =
    `${process.env.NEXT_PUBLIC_API_URL}` +
    `/notifications/stream`;

  console.log(
    "[SSE] Creating EventSource:",
    url,
  );

  const eventSource = new EventSource(url, {
    withCredentials: true,
  });

  eventSource.onopen = () => {
    console.log(
      "[SSE] ✅ Connection opened",
    );
  };

  eventSource.onmessage = (event) => {
    console.log(
      "[SSE] 📨 Raw event received:",
      event.data,
    );

    try {
      const notification =
        JSON.parse(event.data);

      console.log(
        "[SSE] Parsed notification:",
        notification,
      );

      onNotification(notification);
    } catch (error) {
      console.error(
        "[SSE] Failed to parse event:",
        error,
      );
    }
  };

  eventSource.onerror = (error) => {
    console.error(
      "[SSE] ❌ Connection error:",
      error,
      "readyState:",
      eventSource.readyState,
    );
  };

  return () => {
    console.log(
      "[SSE] Closing connection",
    );

    eventSource.close();
  };
}