// import { Injectable } from '@nestjs/common';
// import { Observable, Subject } from 'rxjs';

// @Injectable()
// export class NotificationStreamService {
//   private readonly streams = new Map<
//     number,
//     Set<Subject<any>>
//   >();

//   connect(userId: number) {
//     const stream = new Subject<any>();

//     let userStreams = this.streams.get(userId);

//     if (!userStreams) {
//       userStreams = new Set();

//       this.streams.set(
//         userId,
//         userStreams,
//       );
//     }

//     userStreams.add(stream);

//     console.log(
//       `[SSE] User ${userId} connected`,
//     );

//     return {
//       observable: stream.asObservable(),

//       cleanup: () => {
//         stream.complete();

//         userStreams!.delete(stream);

//         if (userStreams!.size === 0) {
//           this.streams.delete(userId);
//         }

//         console.log(
//           `[SSE] User ${userId} disconnected`,
//         );
//       },
//     };
//   }

//   emit(
//     userId: number,
//     notification: any,
//   ) {
//     const userStreams =
//       this.streams.get(userId);

//     if (!userStreams) {
//       console.log(
//         `[SSE] No active connection for user ${userId}`,
//       );

//       return;
//     }

//     console.log(
//       `[SSE] Sending notification to user ${userId}`,
//     );

//     for (const stream of userStreams) {
//       stream.next(notification);
//     }
//   }
// }

import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

@Injectable()
export class NotificationStreamService {
  private readonly streams = new Map<number, Set<Subject<any>>>();

  connect(userId: number) {
    console.log('[SSE] Opening notification stream for user', userId);

    const stream = new Subject<any>();

    let userStreams = this.streams.get(userId);

    if (!userStreams) {
      userStreams = new Set();

      this.streams.set(userId, userStreams);
    }

    userStreams.add(stream);

    console.log('[SSE] User connected', {
      userId,
      activeStreams: userStreams.size,
    });

    return {
      observable: stream.asObservable(),

      cleanup: () => {
        stream.complete();

        userStreams!.delete(stream);

        if (userStreams!.size === 0) {
          this.streams.delete(userId);
        }

        console.log('[SSE] User disconnected', {
          userId,
          remainingStreams: userStreams!.size,
        });
      },
    };
  }

  emit(userId: number, notification: any) {
    console.log('[SSE] Emit called:', {
      userId,
      notificationId: notification.id,
    });

    const userStreams = this.streams.get(userId);

    console.log('[SSE] Active streams:', userStreams?.size ?? 0);

    if (!userStreams) {
      console.log(`[SSE] No active connection for user ${userId}`);

      return;
    }

    console.log(`[SSE] Sending notification to user ${userId}`);

    for (const stream of userStreams) {
      console.log('[SSE] Sending notification to stream');

      stream.next(notification);
    }
  }

  /** Emit a typed non-notification event (e.g. file_import_progress). */
  emitRaw(userId: number, eventType: string, data: Record<string, any>) {
    const userStreams = this.streams.get(userId);
    if (!userStreams) return;
    for (const stream of userStreams) {
      stream.next({ __sse_event_type: eventType, ...data });
    }
  }
}
