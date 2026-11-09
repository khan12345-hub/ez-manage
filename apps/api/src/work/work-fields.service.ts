import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { WorkAccessService } from './work-access.service';
import { WorkDetailService } from './work-detail.service';

export const FIELD_TYPES = ['text', 'textarea', 'number', 'money', 'date', 'dropdown', 'labels', 'checkbox', 'email', 'phone', 'url', 'rating', 'progress', 'people'] as const;
export type FieldType = (typeof FIELD_TYPES)[number];
type Option = { id: string; name: string; color: string };

const FIELD_SELECT = { id: true, spaceId: true, name: true, type: true, config: true, order: true } as const;
const OPTION_COLORS = ['#2563EB', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#DB2777', '#0D9488', '#475569'];

/** ClickUp-style custom fields: defined per space, one value per task. */
@Injectable()
export class WorkFieldsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkAccessService,
    private readonly detail: WorkDetailService,
  ) {}

  async list(spaceId: number, userId: number) {
    await this.access.requireSpace(spaceId, userId, 'view');
    return this.prisma.workCustomField.findMany({ where: { spaceId, archivedAt: null }, orderBy: [{ order: 'asc' }, { id: 'asc' }], select: FIELD_SELECT });
  }

  async create(spaceId: number, userId: number, dto: { name: string; type: string; config?: any }) {
    await this.access.requireSpace(spaceId, userId, 'manage');
    if (!(FIELD_TYPES as readonly string[]).includes(dto.type)) throw new BadRequestException('Unknown field type.');
    const last = await this.prisma.workCustomField.findFirst({ where: { spaceId }, orderBy: { order: 'desc' }, select: { order: true } });
    return this.prisma.workCustomField.create({
      data: { spaceId, name: dto.name.trim(), type: dto.type, config: this.normalizeConfig(dto.type as FieldType, dto.config) as any, order: (last?.order ?? 0) + 1000, createdById: userId },
      select: FIELD_SELECT,
    });
  }

  async update(fieldId: number, userId: number, dto: { name?: string; config?: any; order?: number }) {
    const f = await this.field(fieldId);
    await this.access.requireSpace(f.spaceId, userId, 'manage');
    return this.prisma.workCustomField.update({
      where: { id: fieldId },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.config !== undefined && { config: this.normalizeConfig(f.type as FieldType, dto.config) as any }),
        ...(dto.order !== undefined && { order: dto.order }),
      },
      select: FIELD_SELECT,
    });
  }

  async remove(fieldId: number, userId: number) {
    const f = await this.field(fieldId);
    await this.access.requireSpace(f.spaceId, userId, 'manage');
    await this.prisma.workCustomField.update({ where: { id: fieldId }, data: { archivedAt: new Date() } });
    return { deleted: true };
  }

  /** { [taskId]: { [fieldId]: value } } for a list (or one task). */
  async valuesForList(listId: number, userId: number) {
    await this.access.requireList(listId, userId, 'view');
    const rows = await this.prisma.workFieldValue.findMany({ where: { task: { listId, archivedAt: null }, field: { archivedAt: null } }, select: { taskId: true, fieldId: true, value: true } });
    const out: Record<number, Record<number, unknown>> = {};
    for (const r of rows) (out[r.taskId] ??= {})[r.fieldId] = r.value;
    return out;
  }

  async valuesForTask(taskId: number, userId: number) {
    await this.access.requireTask(taskId, userId, 'view');
    const rows = await this.prisma.workFieldValue.findMany({ where: { taskId, field: { archivedAt: null } }, select: { fieldId: true, value: true } });
    return Object.fromEntries(rows.map((r) => [r.fieldId, r.value]));
  }

  async setValue(taskId: number, fieldId: number, userId: number, raw: unknown) {
    const { task, access } = await this.access.requireTask(taskId, userId, 'edit');
    const f = await this.field(fieldId);
    if (f.spaceId !== task.list.spaceId) throw new BadRequestException('That field does not belong to this space.');
    const value = await this.validate(f, raw, access.workspaceId);
    if (value === null) {
      await this.prisma.workFieldValue.deleteMany({ where: { taskId, fieldId } });
    } else {
      await this.prisma.workFieldValue.upsert({
        where: { taskId_fieldId: { taskId, fieldId } },
        update: { value: value as Prisma.InputJsonValue },
        create: { taskId, fieldId, value: value as Prisma.InputJsonValue },
      });
    }
    await this.detail.log(taskId, userId, 'field', f.name, null);
    return { fieldId, value };
  }

  /* ───────────────────────── helpers ───────────────────────── */

  private async field(id: number) {
    const f = await this.prisma.workCustomField.findFirst({ where: { id, archivedAt: null }, select: { id: true, spaceId: true, name: true, type: true, config: true } });
    if (!f) throw new NotFoundException('Field not found.');
    return f;
  }

  private normalizeConfig(type: FieldType, config: any) {
    if (type === 'dropdown' || type === 'labels') {
      const opts: Option[] = Array.isArray(config?.options) ? config.options : [];
      return {
        options: opts
          .filter((o) => typeof o?.name === 'string' && o.name.trim())
          .slice(0, 100)
          .map((o, i) => ({ id: typeof o.id === 'string' && o.id ? o.id : randomUUID().slice(0, 8), name: o.name.trim().slice(0, 80), color: /^#[0-9a-f]{6}$/i.test(o.color ?? '') ? o.color : OPTION_COLORS[i % OPTION_COLORS.length] })),
      };
    }
    if (type === 'money') return { currency: /^[A-Z]{3}$/.test(config?.currency ?? '') ? config.currency : 'USD' };
    if (type === 'number') return { decimals: Number.isInteger(config?.decimals) && config.decimals >= 0 && config.decimals <= 6 ? config.decimals : 0 };
    return null;
  }

  private async validate(f: { type: string; config: any }, v: unknown, workspaceId: number): Promise<unknown> {
    if (v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) return null;
    const bad = (m: string) => { throw new BadRequestException(m); };
    switch (f.type as FieldType) {
      case 'text':
      case 'textarea':
        if (typeof v !== 'string') bad('Text expected.');
        return (v as string).slice(0, f.type === 'text' ? 500 : 10000);
      case 'email':
        if (typeof v !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) bad('Not a valid email.');
        return (v as string).trim();
      case 'phone':
        if (typeof v !== 'string' || !/^[0-9+()\-\s.]{3,40}$/.test(v)) bad('Not a valid phone number.');
        return (v as string).trim();
      case 'url': {
        let u: URL | null = null;
        try { u = new URL(String(v)); } catch { /* fall through */ }
        if (!u || !['http:', 'https:'].includes(u.protocol)) bad('Not a valid http(s) link.');
        return u!.toString();
      }
      case 'number':
      case 'money': {
        const n = typeof v === 'number' ? v : Number(v);
        if (!Number.isFinite(n) || Math.abs(n) > 1e15) bad('Number expected.');
        return n;
      }
      case 'date': {
        const d = new Date(String(v));
        if (Number.isNaN(d.getTime())) bad('Date expected.');
        return d.toISOString();
      }
      case 'checkbox':
        if (typeof v !== 'boolean') bad('true/false expected.');
        return v ? true : null;
      case 'rating': {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 0 || n > 5) bad('Rating is 0–5.');
        return n || null;
      }
      case 'progress': {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 0 || n > 100) bad('Progress is 0–100.');
        return n;
      }
      case 'dropdown': {
        const ids = (f.config?.options ?? []).map((o: Option) => o.id);
        if (typeof v !== 'string' || !ids.includes(v)) bad('Pick one of the field options.');
        return v;
      }
      case 'labels': {
        const ids = (f.config?.options ?? []).map((o: Option) => o.id);
        if (!Array.isArray(v) || !v.every((x) => typeof x === 'string' && ids.includes(x))) bad('Pick from the field labels.');
        return [...new Set(v as string[])];
      }
      case 'people': {
        if (!Array.isArray(v) || !v.every((x) => Number.isInteger(x))) bad('People expected.');
        const ids = [...new Set(v as number[])];
        if (!(await this.access.areMembers(workspaceId, ids))) bad('People must be Work members.');
        return ids;
      }
    }
    return null;
  }
}
