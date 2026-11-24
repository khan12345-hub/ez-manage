import { api } from "@/lib/api";

export type ProductKey = "accounts" | "work" | "tracker" | "vault" | "crm" | "executive";
export type ManagerScope = { product: "accounts" | "work" | "tracker"; workspaceId: number; source: "boards" | "work" | null; mayGrantAdmin: boolean };
export type AdminProduct = "accounts" | "work" | "tracker" | "vault" | "crm";
export type MyAccess = { off: ProductKey[]; canManage: boolean; admin: boolean; scopes: ManagerScope[]; productAdminOf: AdminProduct[] };
type Ws = { id: number; uid: string; name: string };
type Switch = { on: boolean; explicit?: boolean; has?: boolean; locked?: boolean };
export type AccessUser = {
  id: number; firstName: string; lastName: string; email: string; avatarUrl: string | null; systemRole: "USER" | "SUPER_ADMIN";
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED"; lastLoginAt?: string | null; createdAt: string;
  products: {
    accounts: Switch & { companies: { workspace: Ws; role: string; boards: number }[] };
    work: Switch & { companies: { workspace: Ws; role: string }[] };
    tracker: Switch & { trackedCompanies: number; adminOf: number; devices: number };
    crm?: Switch & { companies: { workspace: Ws; role: string }[] };
    executive?: Switch;
    vault?: Switch & { setUp: boolean };
  };
  managerScopes?: ManagerScope[];
  productAdminOf?: AdminProduct[];
};
export type AccessRow = {
  id: number; createdAt: string; product: string; action: string; workspaceId: number | null; workspaceName: string | null;
  fromRole: string | null; toRole: string | null; via: string | null; targetEmail: string | null;
  actor: { id: number; firstName: string; lastName: string; email: string; avatarUrl: string | null } | null;
  target: { id: number; firstName: string; lastName: string; email: string; avatarUrl: string | null } | null;
};
export type AccessCompanies = {
  accounts: (Ws & { boards: { id: number; name: string }[]; mayGrantAdmin: boolean })[];
  work: (Ws & { mayGrantAdmin: boolean })[];
  tracker: { boards: { id: number; name: string }[]; work: { id: number; name: string }[] };
  crm?: Ws[];
};
export type InviteBody = {
  emails: string[];
  accounts?: { workspaceId: number; role: string; boardIds?: number[] } | null;
  work?: { workspaceId: number; role: string } | null;
  tracker?: { source: "boards" | "work"; workspaceId: number; role: "member" | "admin" } | null;
  crm?: { workspaceId: number; role: string } | null;
  vault?: boolean;
};

const qs = (o: Record<string, unknown>) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== "" && v !== null).map(([k, v]) => [k, String(v)])).toString();
const A = "/access/admin";

export const accessApi = {
  me: async () => (await api.get<MyAccess>("/access/me")).data,
  users: async (f: { q?: string; product?: string; role?: string; status?: string; page?: number; pageSize?: number }) =>
    (await api.get<{ total: number; page: number; pageSize: number; view: "admin" | "manager"; users: AccessUser[] }>(`${A}/users?${qs(f)}`)).data,
  user: async (id: number) => (await api.get<AccessUser & { history: AccessRow[] }>(`${A}/users/${id}`)).data,
  companies: async () => (await api.get<AccessCompanies>(`${A}/companies`)).data,
  history: async (f: { user?: number; product?: string; action?: string; page?: number; pageSize?: number }) =>
    (await api.get<{ total: number; page: number; pageSize: number; rows: AccessRow[] }>(`${A}/history?${qs(f)}`)).data,
  invite: async (b: InviteBody) => (await api.post<{ results: { email: string; existing: boolean; given: string[]; problems: string[] }[] }>(`${A}/invite`, b)).data,
  setProduct: async (product: ProductKey, userIds: number[], enabled: boolean) => (await api.post(`${A}/products/${product}`, { userIds, enabled })).data,
  addAccounts: async (id: number, b: { workspaceId: number; role: string; boardIds?: number[] }) => (await api.post(`${A}/users/${id}/accounts`, b)).data,
  roleAccounts: async (id: number, ws: number, role: string) => (await api.patch(`${A}/users/${id}/accounts/${ws}`, { role })).data,
  removeAccounts: async (id: number, ws: number) => (await api.delete(`${A}/users/${id}/accounts/${ws}`)).data,
  addWork: async (id: number, b: { workspaceId: number; role: string }) => (await api.post(`${A}/users/${id}/work`, b)).data,
  roleWork: async (id: number, ws: number, role: string) => (await api.patch(`${A}/users/${id}/work/${ws}`, { role })).data,
  removeWork: async (id: number, ws: number) => (await api.delete(`${A}/users/${id}/work/${ws}`)).data,
  addTracker: async (id: number, b: { source: "boards" | "work"; workspaceId: number; role: "member" | "admin" }) => (await api.post(`${A}/users/${id}/tracker`, b)).data,
  addCrm: async (id: number, b: { workspaceId: number; role: string }) => (await api.post(`${A}/users/${id}/crm`, b)).data,
  roleCrm: async (id: number, ws: number, role: string) => (await api.patch(`${A}/users/${id}/crm/${ws}`, { role })).data,
  removeCrm: async (id: number, ws: number) => (await api.delete(`${A}/users/${id}/crm/${ws}`)).data,
  systemRole: async (id: number, role: "SUPER_ADMIN" | "USER") => (await api.post(`${A}/users/${id}/system-role`, { role })).data,
  setProductAdmin: async (id: number, product: AdminProduct, on: boolean) => (await api.post<AccessUser & { history: AccessRow[] }>(`${A}/users/${id}/product-admin`, { product, on })).data,
  setScopes: async (id: number, scopes: ManagerScope[]) => (await api.post(`${A}/users/${id}/manager-scopes`, { scopes })).data,
  disable: async (id: number) => (await api.post<{ disabled: boolean; leftSharedVaults: number; keptAsOnlyOwner: number }>(`${A}/users/${id}/disable`)).data,
  enable: async (id: number) => (await api.post(`${A}/users/${id}/enable`)).data,
};

export const PRODUCT_LABELS: Record<ProductKey, string> = {
  accounts: "Accounts & Invoices", work: "Company Work", tracker: "EZ Tracker", vault: "EZ Vault", crm: "EZ CRM", executive: "Executive Hub",
};
export const roleLabel = (r: string) => r.charAt(0) + r.slice(1).toLowerCase().replace(/_/g, " ");
