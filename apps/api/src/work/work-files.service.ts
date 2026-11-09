import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationEntityType, NotificationType, Prisma } from 'generated/prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { STORAGE_SERVICE } from 'src/storage/storage.module';
import type { StorageProvider } from 'src/storage/storage.types';
import { NotificationsService } from 'src/notifications/notifications.service';
import { WorkAccessService } from './work-access.service';
import { WorkDetailService } from './work-detail.service';

const USER_MINI = { id: true, firstName: true, lastName: true, avatarUrl: true, email: true } as const;

export const ATTACHMENT_SELECT = {
  id: true,
  source: true,
  commentId: true,
  createdAt: true,
  uploadedBy: { select: USER_MINI },
  file: { select: { id: true, fileName: true, mimeType: true, fileSize: true, url: true } },
} as const;

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv',
  'application/zip', 'application/x-zip-compressed',
  'video/mp4', 'video/webm', 'video/quicktime',
  'audio/mpeg', 'audio/wav', 'audio/webm',
]);

export type AttachmentSource = 'task' | 'comment' | 'description';

/** Work task files (attachments gallery), web links and Work notifications. */
@Injectable()
export class WorkFilesService {
  private readonly logger = new Logger(WorkFilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkAccessService,
    private readonly detail: WorkDetailService,
    private readonly notifications: NotificationsService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageProvider,
  ) {}

  /* ───────────────────────── attachments ───────────────────────── */

  async listAttachments(taskId: number, userId: number) {
    await this.access.requireTask(taskId, userId, 'view');
    return this.prisma.workAttachment.findMany({ where: { taskId }, orderBy: { createdAt: 'desc' }, select: ATTACHMENT_SELECT });
  }

  async upload(taskId: number, userId: number, files: Express.Multer.File[], source: AttachmentSource = 'task') {
    await this.access.requireTask(taskId, userId, 'edit');
    if (!files?.length) throw new BadRequestException('No files received.');
    if (!['task', 'comment', 'description'].includes(source)) throw new BadRequestException('Unknown attachment source.');
    for (const f of files) {
      if (!ALLOWED_MIME_TYPES.has(f.mimetype)) {
        throw new BadRequestException(`"${f.originalname}" (${f.mimetype || 'unknown type'}) is not allowed. Use images, video, audio, PDF, Office, text, CSV or ZIP files.`);
      }
    }
    const created: Prisma.WorkAttachmentGetPayload<{ select: typeof ATTACHMENT_SELECT }>[] = [];
    for (const f of files) {
      const up = await this.storage.upload(f, 'work-tasks');
      const file = await this.prisma.file.create({
        data: { fileName: up.fileName, mimeType: up.mimeType, fileSize: up.fileSize, storageKey: up.storageKey, url: this.storage.getUrl(up.storageKey), uploadedById: userId },
      });
      created.push(
        await this.prisma.workAttachment.create({ data: { taskId, fileId: file.id, source, uploadedById: userId }, select: ATTACHMENT_SELECT }),
      );
    }
    // comment files are logged with the comment; others show in the history now
    if (source !== 'comment') await this.detail.log(taskId, userId, 'attachment_added', null, created.map((a) => a.file.fileName));
    return created;
  }

  async deleteAttachment(id: number, userId: number) {
    const a = await this.prisma.workAttachment.findUnique({ where: { id }, select: { id: true, taskId: true, uploadedById: true, file: { select: { id: true, storageKey: true, fileName: true } } } });
    if (!a) throw new NotFoundException('Attachment not found.');
    const { access } = await this.access.requireTask(a.taskId, userId, 'edit');
    if (a.uploadedById !== userId && !access.canManage) throw new ForbiddenException('Only the uploader or a manager can delete this file.');
    await this.prisma.file.delete({ where: { id: a.file.id } }); // cascades to the attachment
    this.storage.delete(a.file.storageKey).catch((e) => this.logger.warn(`storage delete failed: ${e?.message ?? e}`));
    await this.detail.log(a.taskId, userId, 'attachment_removed', a.file.fileName, null);
    return { deleted: true };
  }

  /** Bind files uploaded from the composer to the comment just posted. */
  async bindToComment(taskId: number, userId: number, commentId: number, attachmentIds?: number[]) {
    if (!attachmentIds?.length) return;
    await this.prisma.workAttachment.updateMany({
      where: { id: { in: attachmentIds }, taskId, uploadedById: userId, commentId: null },
      data: { commentId, source: 'comment' },
    });
  }

  /* ───────────────────────── web links ───────────────────────── */

  async listLinks(taskId: number, userId: number) {
    await this.access.requireTask(taskId, userId, 'view');
    return this.prisma.workWebLink.findMany({ where: { taskId }, orderBy: { createdAt: 'desc' }, select: { id: true, url: true, title: true, createdAt: true, createdBy: { select: USER_MINI } } });
  }

  async addLink(taskId: number, userId: number, url: string, title?: string) {
    await this.access.requireTask(taskId, userId, 'edit');
    let parsed: URL;
    try {
      parsed = new URL(url.trim());
    } catch {
      throw new BadRequestException('That is not a valid URL.');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new BadRequestException('Only http and https links are allowed.');
    const link = await this.prisma.workWebLink.create({
      data: { taskId, url: parsed.toString(), title: title?.trim() || parsed.hostname.replace(/^www\./, ''), createdById: userId },
      select: { id: true, url: true, title: true, createdAt: true, createdBy: { select: USER_MINI } },
    });
    await this.detail.log(taskId, userId, 'link_added', null, link.title);
    return link;
  }

  async deleteLink(id: number, userId: number) {
    const l = await this.prisma.workWebLink.findUnique({ where: { id }, select: { id: true, taskId: true, title: true, createdById: true } });
    if (!l) throw new NotFoundException('Link not found.');
    const { access } = await this.access.requireTask(l.taskId, userId, 'edit');
    if (l.createdById !== userId && !access.canManage) throw new ForbiddenException('Only whoever added the link or a manager can remove it.');
    await this.prisma.workWebLink.delete({ where: { id } });
    await this.detail.log(l.taskId, userId, 'link_removed', l.title, null);
    return { deleted: true };
  }

  /* ───────────────────────── reactions ───────────────────────── */

  static readonly EMOJIS = ['👍', '❤️', '😂', '🎉', '👀', '🙏', '🔥', '✅', '🚀', '💯', '👏', '😮'];

  /** Toggle one emoji on a comment; the comment's author hears about new reactions. */
  async toggleReaction(commentId: number, userId: number, emoji: string) {
    if (!WorkFilesService.EMOJIS.includes(emoji)) throw new BadRequestException('Unsupported reaction.');
    const c = await this.prisma.workComment.findFirst({ where: { id: commentId, deletedAt: null }, select: { id: true, taskId: true, userId: true, content: true } });
    if (!c) throw new NotFoundException('Comment not found.');
    await this.access.requireTask(c.taskId, userId, 'view');
    const existing = await this.prisma.workCommentReaction.findUnique({ where: { commentId_userId_emoji: { commentId, userId, emoji } } });
    if (existing) {
      await this.prisma.workCommentReaction.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.workCommentReaction.create({ data: { commentId, userId, emoji } });
      const snippet = c.content.length > 120 ? `${c.content.slice(0, 120)}…` : c.content;
      await this.notify(c.taskId, userId, [c.userId], NotificationType.COMMENT_CREATED, 'Reacted to your comment', snippet, { event: 'reaction', emoji, commentId });
    }
    return this.reactionsOf(commentId);
  }

  reactionsOf(commentId: number) {
    return this.prisma.workCommentReaction.findMany({
      where: { commentId },
      orderBy: { createdAt: 'asc' },
      select: { emoji: true, userId: true, user: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  /* ───────────────────────── notification settings ───────────────────────── */

  static readonly KINDS = ['mention', 'assigned', 'assigned_comment', 'reply', 'comment', 'reaction', 'status', 'overdue'] as const;

  async getSettings(userId: number) {
    const rows = await this.prisma.workNotificationPref.findMany({ where: { userId } });
    const by = new Map(rows.map((r) => [r.kind, r]));
    return WorkFilesService.KINDS.map((kind) => {
      const r = by.get(kind);
      return { kind, inbox: r?.inbox ?? true, email: r?.email ?? false, browser: r?.browser ?? true };
    });
  }

  async setSetting(userId: number, kind: string, v: { inbox: boolean; email: boolean; browser: boolean }) {
    if (!(WorkFilesService.KINDS as readonly string[]).includes(kind)) throw new BadRequestException('Unknown notification kind.');
    await this.prisma.workNotificationPref.upsert({
      where: { userId_kind: { userId, kind } },
      update: v,
      create: { userId, kind, ...v },
    });
    return this.getSettings(userId);
  }

  /* ───────────────────────── notifications ───────────────────────── */

  /**
   * Notify people about a Work task event. Never throws: a failed
   * notification must not fail the action that caused it.
   */
  /** Notification without a person behind it (e.g. "Task is overdue"). */
  notifySystem(taskId: number, recipients: number[], type: NotificationType, title: string, message: string, extra: Record<string, unknown> = {}) {
    return this.notify(taskId, 0, recipients, type, title, message, extra);
  }

  async notify(taskId: number, actorId: number, recipients: number[], type: NotificationType, title: string, message: string, extra: Record<string, unknown> = {}) {
    const ids = [...new Set(recipients)].filter((id) => id && id !== actorId);
    if (!ids.length) return;
    try {
      const t = await this.prisma.workTask.findUnique({
        where: { id: taskId },
        select: { uid: true, name: true, list: { select: { uid: true, name: true, space: { select: { workspace: { select: { uid: true } } } } } } },
      });
      if (!t) return;
      const actor = actorId ? await this.prisma.user.findUnique({ where: { id: actorId }, select: { firstName: true, lastName: true, avatarUrl: true } }) : null;
      const metadata = {
        product: 'work',
        taskUid: t.uid,
        taskName: t.name,
        listUid: t.list.uid,
        listName: t.list.name,
        workspaceUid: t.list.space.workspace.uid,
        url: `/work/${t.list.space.workspace.uid}/list/${t.list.uid}?task=${t.uid}`,
        actorName: `${actor?.firstName ?? ''} ${actor?.lastName ?? ''}`.trim(),
        actorId: actorId || null,
        actorAvatar: actor?.avatarUrl ?? null,
        ...extra,
      };
      const kind = (extra.event as string | undefined) ?? 'comment';
      const prefs = await this.prisma.workNotificationPref.findMany({ where: { userId: { in: ids }, kind } });
      const byUser = new Map(prefs.map((p) => [p.userId, p]));
      for (const recipientId of ids) {
        const pref = byUser.get(recipientId);
        if (pref && !pref.inbox && !pref.email) continue; // this person turned this kind off
        await this.notifications.notify({
          recipientId, type, title, message,
          entityType: NotificationEntityType.TASK, entityId: taskId,
          metadata: { ...metadata, push: pref ? pref.browser : true, inboxHidden: pref ? !pref.inbox : false },
          sendEmail: pref?.email ?? false,
          product: 'work',
        });
      }
    } catch (e: any) {
      this.logger.warn(`work notification failed: ${e?.message ?? e}`);
    }
  }
}
