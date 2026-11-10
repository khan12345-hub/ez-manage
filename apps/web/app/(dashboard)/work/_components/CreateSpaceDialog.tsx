"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronDown, Folder, Info, LayoutTemplate, List as ListIcon, Search, UserPlus, Users, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { userName, workApi, type SpacePermission, type SpaceTemplate } from "@/services/work.api";
import { Avatar } from "./primitives";
import { SPACE_COLORS, SPACE_ICONS, SpaceIcon } from "./SpaceIcon";

const PERMS: { id: SpacePermission; label: string; hint: string }[] = [
  { id: "full", label: "Full edit", hint: "Can create and edit entities in this Space. Owners and admins can manage Space settings." },
  { id: "edit", label: "Edit", hint: "Can create and edit entities in this Space. Can't manage Space settings or delete entities." },
  { id: "comment", label: "Comment", hint: "Can comment on entities within this Space. Can't manage Space settings or edit entities." },
  { id: "view", label: "View only", hint: "Read-only. Can't edit entities or comment in this Space." },
];
const errMsg = (e: any) => e?.response?.data?.message?.toString?.() ?? "Couldn't create the space.";

/** Create a Space (ClickUp): icon & colour, name, description, default permission, private + share only with, templates. */
export function CreateSpaceDialog({ open, onOpenChange, workspace, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; workspace: string; onCreated?: (space: { uid: string }) => void }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [color, setColor] = useState(SPACE_COLORS[6]!);
  const [perm, setPerm] = useState<SpacePermission>("full");
  const [isPrivate, setPrivate] = useState(false);
  const [share, setShare] = useState<number[]>([]);
  const [tpl, setTpl] = useState<SpaceTemplate | null>(null);
  const [center, setCenter] = useState(false);
  const [busy, setBusy] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);
  const [permOpen, setPermOpen] = useState(false);
  const [iq, setIq] = useState("");
  const { data: people } = useQuery({ queryKey: ["work", "people", workspace], queryFn: () => workApi.people(workspace), enabled: open && isPrivate });
  const members = (people?.members ?? []).map((m) => m.user).filter((u) => u.id !== user?.id);

  const reset = () => {
    setName(""); setDescription(""); setIcon(null); setColor(SPACE_COLORS[6]!); setPerm("full"); setPrivate(false); setShare([]); setTpl(null);
  };
  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) reset();
  };
  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const space = await workApi.createSpace(workspace, {
        name: name.trim(),
        color,
        ...(icon ? { icon } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
        defaultPermission: perm,
        isPrivate,
        ...(isPrivate && share.length ? { memberIds: share } : {}),
        ...(tpl ? { templateId: tpl.id } : {}),
      });
      toast.success(tpl ? `Space created from “${tpl.name}”` : "Space created");
      onCreated?.(space as { uid: string });
      close(false);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  const icons = Object.keys(SPACE_ICONS).filter((k) => !iq.trim() || k.includes(iq.trim().toLowerCase()));
  const permMeta = PERMS.find((p) => p.id === perm)!;

  return (
    <>
      <Dialog open={open && !center} onOpenChange={close}>
        <DialogContent className="gap-0 p-0 sm:max-w-[560px]">
          <div className="px-6 pb-2 pt-6">
            <DialogTitle className="text-[18px] font-semibold">Create a Space</DialogTitle>
            <DialogDescription className="mt-1 text-[13px]">A Space represents teams, departments, or groups, each with its own Lists, workflows, and settings.</DialogDescription>

            <label className="mt-5 block text-[13px] font-medium text-muted-foreground">Icon &amp; name</label>
            <div className="mt-1.5 flex items-center gap-2">
              <Popover open={iconOpen} onOpenChange={setIconOpen}>
                <PopoverTrigger asChild>
                  <button type="button" aria-label="Space icon and colour" className="flex h-10 w-10 items-center justify-center rounded-lg border border-border hover:bg-accent">
                    <SpaceIcon name={name || "S"} color={color} icon={icon} size={26} />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[320px] p-2">
                  <div className="flex items-center gap-1.5">
                    <div className="flex h-8 flex-1 items-center gap-1.5 rounded-md border border-border px-2">
                      <Search className="h-3.5 w-3.5 text-muted-foreground" />
                      <input value={iq} onChange={(e) => setIq(e.target.value)} placeholder="Search…" aria-label="Search icons" className="h-full flex-1 bg-transparent text-[13px] outline-none" />
                    </div>
                  </div>
                  <div role="radiogroup" aria-label="Colour" className="mt-2 flex flex-wrap gap-1.5">
                    {SPACE_COLORS.map((c) => (
                      <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} onClick={() => setColor(c)} className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: c }}>
                        {color === c && <Check className="h-3.5 w-3.5 text-white" />}
                      </button>
                    ))}
                  </div>
                  <div role="radiogroup" aria-label="Icon" className="mt-2 grid max-h-52 grid-cols-8 gap-1 overflow-y-auto">
                    <button type="button" role="radio" aria-checked={!icon} aria-label="Letter" onClick={() => setIcon(null)} className={cn("flex h-8 w-8 items-center justify-center rounded-md text-[13px] font-bold hover:bg-accent", !icon && "bg-accent ring-1 ring-border")}>
                      {(name || "S").charAt(0).toUpperCase()}
                    </button>
                    {icons.map((k) => {
                      const I = SPACE_ICONS[k]!;
                      return (
                        <button key={k} type="button" role="radio" aria-checked={icon === k} aria-label={k} title={k} onClick={() => { setIcon(k); setIconOpen(false); }} className={cn("flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent", icon === k && "bg-accent ring-1 ring-border")}>
                          <I className="h-4 w-4" style={{ color }} />
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                maxLength={80}
                placeholder="e.g. Marketing, Engineering, HR"
                aria-label="Space name"
                className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-[14px] outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
              />
            </div>

            <label htmlFor="space-desc" className="mt-4 block text-[13px] font-medium text-muted-foreground">Description <span className="font-normal">(optional)</span></label>
            <input id="space-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-[14px] outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10" />

            {!isPrivate && (
              <div className="mt-5 flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-[13.5px] font-medium">Default permission</span>
                <span title="What Work members can do in this Space. Owners and admins can always manage it."><Info className="h-3.5 w-3.5 text-muted-foreground" /></span>
                <span className="flex-1" />
                <Popover open={permOpen} onOpenChange={setPermOpen}>
                  <PopoverTrigger asChild>
                    <button type="button" aria-label="Default permission" className="flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[12.5px] hover:bg-accent">{permMeta.label} <ChevronDown className="h-3 w-3" /></button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72 p-1">
                    {PERMS.map((p) => (
                      <button key={p.id} type="button" onClick={() => { setPerm(p.id); setPermOpen(false); }} className="flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left hover:bg-accent">
                        <span className="flex-1">
                          <span className="block text-[13px] font-medium">{p.label}</span>
                          <span className="block text-[11.5px] leading-snug text-muted-foreground">{p.hint}</span>
                        </span>
                        {perm === p.id && <Check className="mt-0.5 h-4 w-4 text-primary" />}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <div className="mt-5 flex items-center gap-3">
              <span className="flex-1">
                <span className="block text-[13.5px] font-medium">Make Private</span>
                <span className="block text-[12.5px] text-muted-foreground">Only you and invited members have access</span>
              </span>
              <Switch checked={isPrivate} onCheckedChange={setPrivate} aria-label="Make Private" />
            </div>
            {isPrivate && (
              <div className="mt-3 flex items-center gap-2">
                <span className="flex-1 text-[13px] text-muted-foreground">Share only with:</span>
                <span className="flex -space-x-1.5">
                  {user && <Avatar user={user as any} size={26} />}
                  {share.map((id) => { const m = members.find((x) => x.id === id); return m ? <Avatar key={id} user={m} size={26} /> : null; })}
                </span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" aria-label="Share with people" className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-muted-foreground/50 text-muted-foreground hover:text-foreground"><UserPlus className="h-3.5 w-3.5" /></button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="max-h-72 w-64 overflow-y-auto p-1">
                    {members.length === 0 && <p className="px-2 py-3 text-[12.5px] text-muted-foreground">No other Work members yet.</p>}
                    {members.map((m) => {
                      const on = share.includes(m.id);
                      return (
                        <button key={m.id} type="button" role="menuitemcheckbox" aria-checked={on} onClick={() => setShare(on ? share.filter((x) => x !== m.id) : [...share, m.id])} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent">
                          <Avatar user={m} size={20} /> <span className="flex-1 truncate">{userName(m)}</span>
                          {on && <Check className="h-3.5 w-3.5 text-primary" />}
                        </button>
                      );
                    })}
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {tpl && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[12.5px]">
                <LayoutTemplate className="h-4 w-4 text-primary" />
                <span className="flex-1">Template: <strong>{tpl.name}</strong> · {tpl.folders.length} folders, {tpl.lists.length + tpl.folders.reduce((a, f) => a + f.lists.length, 0)} lists, {tpl.statuses.length} statuses</span>
                <button type="button" aria-label="Remove template" onClick={() => setTpl(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
              </div>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border bg-muted/30 px-6 py-3">
            <button type="button" onClick={() => setCenter(true)} className="text-[13px] font-medium text-muted-foreground hover:text-foreground">Use Templates</button>
            <button type="button" disabled={!name.trim() || busy} onClick={submit} className="h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground hover:bg-forest/90 disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">
              {busy ? "Creating…" : "Continue"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <TemplateCenter
        open={open && center}
        onClose={() => setCenter(false)}
        onPick={(t) => {
          setTpl(t);
          if (!name.trim()) setName(t.name);
          setColor(t.color);
          setIcon(t.icon in SPACE_ICONS ? t.icon : null);
          setCenter(false);
        }}
      />
    </>
  );
}

/** Template Center: built-in Space templates by category. */
function TemplateCenter({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (t: SpaceTemplate) => void }) {
  const { data = [] } = useQuery({ queryKey: ["work", "space-templates"], queryFn: () => workApi.spaceTemplates(), enabled: open, staleTime: Infinity });
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const cats = useMemo(() => [...new Set(data.map((t) => t.category))], [data]);
  const shown = data.filter((t) => (!cat || t.category === cat) && (!q.trim() || `${t.name} ${t.description}`.toLowerCase().includes(q.trim().toLowerCase())));
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[min(720px,90vh)] gap-0 p-0 sm:max-w-[1040px]">
        <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-muted/30 p-3 sm:flex">
          <DialogTitle className="flex items-center gap-2 px-2 py-1.5 text-[15px] font-semibold"><LayoutTemplate className="h-4 w-4 text-primary" /> Template Center</DialogTitle>
          <DialogDescription className="sr-only">Pick a ready-made Space</DialogDescription>
          <p className="mt-4 px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Space templates</p>
          <button type="button" onClick={() => setCat(null)} className={cn("mt-1 flex items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px]", !cat ? "bg-accent font-medium" : "hover:bg-accent/60")}>
            All <span className="font-mono text-[11px] text-muted-foreground">{data.length}</span>
          </button>
          {cats.map((c) => (
            <button key={c} type="button" onClick={() => setCat(c)} className={cn("flex items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px]", cat === c ? "bg-accent font-medium" : "hover:bg-accent/60")}>
              {c} <span className="font-mono text-[11px] text-muted-foreground">{data.filter((t) => t.category === c).length}</span>
            </button>
          ))}
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-border p-4">
            <div className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-border px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search templates…" aria-label="Search templates" className="h-full flex-1 bg-transparent text-[13.5px] outline-none" />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((t) => (
                <li key={t.id} className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
                  <div className="space-y-1 border-b border-border bg-muted/30 p-3 text-[11.5px]" aria-hidden>
                    {t.folders.slice(0, 2).map((f) => (
                      <div key={f.name}>
                        <span className="flex items-center gap-1.5 font-medium"><Folder className="h-3 w-3" /> {f.name}</span>
                        {f.lists.slice(0, 2).map((l) => <span key={l} className="ml-4 flex items-center gap-1.5 text-muted-foreground"><ListIcon className="h-3 w-3" /> {l}</span>)}
                      </div>
                    ))}
                    {t.lists.slice(0, 3).map((l) => <span key={l} className="flex items-center gap-1.5 text-muted-foreground"><ListIcon className="h-3 w-3" /> {l}</span>)}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {t.statuses.map((s) => <span key={s.name} className="rounded px-1.5 py-0.5 text-[9.5px] font-semibold uppercase text-white" style={{ background: s.color }}>{s.name}</span>)}
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-3">
                    <span className="flex items-center gap-2 text-[14px] font-semibold"><SpaceIcon name={t.name} color={t.color} icon={t.icon} size={20} /> {t.name}</span>
                    <span className="mt-1 flex-1 text-[12.5px] text-muted-foreground">{t.description}</span>
                    <button type="button" onClick={() => onPick(t)} aria-label={`Use ${t.name}`} className="mt-3 h-8 rounded-md border border-border text-[12.5px] font-semibold hover:bg-accent">Use template</button>
                  </div>
                </li>
              ))}
            </ul>
            {shown.length === 0 && <p className="py-16 text-center text-[13px] text-muted-foreground">No templates match.</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
