import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from 'prisma/prisma.service';
import { WorkAccessService } from './work-access.service';
import { WorkService } from './work.service';

const TYPES = ['text', 'textarea', 'email', 'number', 'date', 'select'] as const;
const MAPS = ['name', 'description', 'dueDate', 'priority'] as const;
type Field = { id: string; label: string; type: (typeof TYPES)[number]; required: boolean; options?: string[]; maps?: (typeof MAPS)[number] | null };
const PRIORITY: Record<string, string> = { urgent: 'URGENT', high: 'HIGH', normal: 'NORMAL', low: 'LOW' };
const uid = () => randomBytes(9).toString('base64url');
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Work → Forms: a form on a list; every submission becomes a task in that list (created by
 * Work as the form's owner, so the usual notifications and activity apply). Fields can fill
 * the task's name, description, due date or priority; everything else goes in the description.
 */
@Injectable()
export class WorkFormsService {
  constructor(private readonly prisma: PrismaService, private readonly access: WorkAccessService, private readonly work: WorkService) {}

  private cleanFields(raw: unknown): Field[] {
    if (!Array.isArray(raw) || !raw.length) throw new BadRequestException('Add at least one question.');
    if (raw.length > 40) throw new BadRequestException('Up to 40 questions.');
    const seenMaps = new Set<string>();
    return raw.map((f: any, i) => {
      const type = TYPES.includes(f?.type) ? f.type : 'text';
      const label = String(f?.label ?? '').trim().slice(0, 200);
      if (!label) throw new BadRequestException(`Question ${i + 1} needs a label.`);
      const options = type === 'select' ? [...new Set((Array.isArray(f.options) ? f.options : []).map((o: unknown) => String(o).trim()).filter(Boolean))].slice(0, 50) as string[] : undefined;
      if (type === 'select' && !options?.length) throw new BadRequestException(`"${label}" needs at least one choice.`);
      const maps = MAPS.includes(f?.maps) ? f.maps : null;
      if (maps && seenMaps.has(maps)) throw new BadRequestException(`Only one question can fill the task's ${maps}.`);
      if (maps) seenMaps.add(maps);
      return { id: /^[\w-]{1,40}$/.test(f?.id ?? '') ? f.id : `q${i + 1}`, label, type, required: !!f?.required, ...(options ? { options } : {}), maps } as Field;
    });
  }

  private async listOf(listId: number, workspaceId: number, userId: number) {
    const l = await this.prisma.workList.findFirst({ where: { id: listId, space: { workspaceId } }, select: { id: true, spaceId: true, name: true, uid: true } });
    if (!l) throw new BadRequestException('Pick a list in this workspace.');
    await this.access.requireSpace(l.spaceId, userId, 'edit');
    return l;
  }

  async list(workspaceId: number, userId: number) {
    await this.access.requireWorkspace(workspaceId, userId, 'view');
    const forms = await this.prisma.workForm.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' } });
    const lists = await this.prisma.workList.findMany({ where: { id: { in: forms.map((f) => f.listId) } }, select: { id: true, uid: true, name: true, spaceId: true } });
    // only forms that feed a list in a space this person can open (guests / limited members see their spaces only)
    const ok = new Set<number>();
    for (const sid of [...new Set(lists.map((l) => l.spaceId))]) { try { await this.access.requireSpace(sid, userId, 'view'); ok.add(sid); } catch { /* hidden */ } }
    const byId = new Map(lists.filter((l) => ok.has(l.spaceId)).map(({ spaceId, ...l }) => [l.id, l]));
    return forms.filter((f) => byId.has(f.listId)).map((f) => ({ ...f, list: byId.get(f.listId)! }));
  }

  async create(workspaceId: number, userId: number, dto: { name?: string; description?: string; listId?: number; fields?: unknown }) {
    await this.access.requireWorkspace(workspaceId, userId, 'edit');
    const name = (dto.name ?? '').trim();
    if (!name) throw new BadRequestException('Name the form.');
    await this.listOf(Number(dto.listId), workspaceId, userId);
    const fields = dto.fields ? this.cleanFields(dto.fields) : [{ id: 'q1', label: 'Title', type: 'text', required: true, maps: 'name' } as Field, { id: 'q2', label: 'Details', type: 'textarea', required: false, maps: 'description' } as Field];
    return this.prisma.workForm.create({ data: { uid: uid(), workspaceId, listId: Number(dto.listId), name: name.slice(0, 200), description: dto.description?.trim().slice(0, 2000) || null, fields: fields as any, createdById: userId } });
  }

  private async formOf(id: number, userId: number) {
    const f = await this.prisma.workForm.findUnique({ where: { id } });
    if (!f) throw new NotFoundException('Form not found.');
    await this.access.requireWorkspace(f.workspaceId, userId, 'edit');
    return f;
  }

  async update(id: number, userId: number, dto: { name?: string; description?: string | null; listId?: number; fields?: unknown; active?: boolean }) {
    const f = await this.formOf(id, userId);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) { const n = dto.name.trim(); if (!n) throw new BadRequestException('Name the form.'); data.name = n.slice(0, 200); }
    if (dto.description !== undefined) data.description = dto.description?.trim().slice(0, 2000) || null;
    if (dto.listId !== undefined) { await this.listOf(Number(dto.listId), f.workspaceId, userId); data.listId = Number(dto.listId); }
    if (dto.fields !== undefined) data.fields = this.cleanFields(dto.fields);
    if (typeof dto.active === 'boolean') data.active = dto.active;
    return this.prisma.workForm.update({ where: { id }, data });
  }

  async remove(id: number, userId: number) {
    await this.formOf(id, userId);
    await this.prisma.workForm.delete({ where: { id } });
    return { ok: true };
  }

  // ---------- public ----------

  async publicForm(formUid: string) {
    const f = await this.prisma.workForm.findUnique({ where: { uid: formUid } });
    if (!f || !f.active) throw new NotFoundException('This form is not open.');
    const ws = await this.prisma.workWorkspace.findUnique({ where: { id: f.workspaceId }, select: { name: true } });
    return { name: f.name, description: f.description, company: ws?.name ?? null, fields: (f.fields as Field[]).map(({ id, label, type, required, options }) => ({ id, label, type, required, ...(options ? { options } : {}) })) };
  }

  async submit(formUid: string, answers: Record<string, unknown>) {
    const f = await this.prisma.workForm.findUnique({ where: { uid: formUid } });
    if (!f || !f.active) throw new NotFoundException('This form is not open.');
    const fields = f.fields as Field[];
    const a = answers && typeof answers === 'object' ? answers : {};
    const values: { field: Field; value: string }[] = [];
    for (const field of fields) {
      const v = String(a[field.id] ?? '').trim().slice(0, field.type === 'textarea' ? 10000 : 1000);
      if (field.required && !v) throw new BadRequestException(`"${field.label}" is required.`);
      if (v && field.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) throw new BadRequestException(`"${field.label}" must be an email.`);
      if (v && field.type === 'number' && !Number.isFinite(Number(v))) throw new BadRequestException(`"${field.label}" must be a number.`);
      if (v && field.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new BadRequestException(`"${field.label}" must be a date.`);
      if (v && field.type === 'select' && !field.options?.includes(v)) throw new BadRequestException(`Pick one of the choices for "${field.label}".`);
      values.push({ field, value: v });
    }
    const pick = (m: Field['maps']) => values.find((x) => x.field.maps === m)?.value || '';
    const name = (pick('name') || `${f.name} — ${new Date().toISOString().slice(0, 10)}`).slice(0, 500);
    const rest = values.filter((x) => x.value && x.field.maps !== 'name' && x.field.maps !== 'dueDate' && x.field.maps !== 'priority');
    const description = `<p><em>Submitted through the form “${esc(f.name)}”.</em></p>` + rest.map((x) => `<p><strong>${esc(x.field.label)}</strong><br>${esc(x.value).replace(/\n/g, '<br>')}</p>`).join('');
    const due = pick('dueDate');
    const priority = PRIORITY[pick('priority').toLowerCase()];
    const task: any = await this.work.createTask(f.listId, f.createdById, { name, description, ...(due ? { dueDate: new Date(`${due}T17:00:00Z`).toISOString() } : {}), ...(priority ? { priority } : {}) } as any);
    await this.prisma.workForm.update({ where: { id: f.id }, data: { submissions: { increment: 1 } } });
    return { ok: true, task: task?.uid ?? null };
  }
}
