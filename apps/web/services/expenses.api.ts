import { api } from "@/lib/api";

/* Reimbursements / Expenses (inside Accounts & Invoices) — mirrors apps/api/src/expenses */

const get = async <T,>(url: string) => (await api.get<T>(url)).data;
const post = async <T,>(url: string, body?: unknown) => (await api.post<T>(url, body)).data;
const patch = async <T,>(url: string, body?: unknown) => (await api.patch<T>(url, body)).data;
const del = async <T,>(url: string) => (await api.delete<T>(url)).data;

export type ExpenseStatus = "draft" | "submitted" | "manager_approved" | "approved_paid" | "rejected";
export interface ExpensePerson { id: number; firstName: string; lastName: string; avatarUrl: string | null }
export interface ExpenseClaim {
  id: number;
  workspaceId: number;
  title: string;
  amount: number;
  currency: string;
  categoryId: number | null;
  category: { id: number; name: string } | null;
  description: string | null;
  incurredOn: string | null;
  paidOn: string | null;
  custom: Record<string, unknown> | null;
  status: ExpenseStatus;
  claimant: ExpensePerson | null;
  manager: ExpensePerson | null;
  managerAt: string | null;
  finance: ExpensePerson | null;
  financeAt: string | null;
  paidAt: string | null;
  rejectedBy: ExpensePerson | null;
  rejectedReason: string | null;
  receiptCount?: number;
  createdAt: string;
}
export interface ExpenseReceipt { id: number; fileUrl: string; fileName: string; mime: string; size: number }
export interface ExpenseEvent { id: number; action: string; note: string | null; at: string; actor: ExpensePerson | null }
export interface ExpenseClaimDetail extends ExpenseClaim {
  myRole: string;
  canReview: boolean;
  canPay: boolean;
  canEdit: boolean;
  canRecall: boolean;
  canReopen: boolean;
  locked: boolean;
  receipts: ExpenseReceipt[];
  events: ExpenseEvent[];
}

export type ExpenseFieldType = "text" | "textarea" | "number" | "email" | "date" | "select" | "multiselect" | "file";
export type ExpenseFieldMap = "title" | "amount" | "expenseDate" | "paymentDate" | "description";
export interface ExpenseFormField {
  id?: number;
  key: string;
  label: string;
  type: ExpenseFieldType;
  options: string[] | null;
  required: boolean;
  maps: ExpenseFieldMap | null;
}
export interface ExpenseForm {
  id: number;
  workspaceId: number;
  title: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  shareToken: string;
  active: boolean;
  company?: string;
  fields: ExpenseFormField[];
}
export interface ExpenseFormInput {
  title?: string;
  description?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  active?: boolean;
  fields?: { key?: string; label: string; type: string; required?: boolean; maps?: string | null; options?: string[] }[];
}
export interface ExpenseCategory { id: number; name: string; monthlyBudget: number | null; active: boolean; spentThisMonth: number; overBudget?: boolean }
export interface ExpenseSummary {
  myRole: string;
  isManager: boolean;
  canSubmit: boolean;
  paidThisMonth: number;
  pending: number;
  myOpen: number;
  toReview: number;
  toPay: number;
  categories: ExpenseCategory[];
}

export const expensesApi = {
  list: (ws: string | number, scope: "mine" | "review" | "pay" | "all") => get<ExpenseClaim[]>(`/expenses/workspaces/${ws}/claims?scope=${scope}`),
  summary: (ws: string | number) => get<ExpenseSummary>(`/expenses/workspaces/${ws}/summary`),
  categories: (ws: string | number) => get<ExpenseCategory[]>(`/expenses/workspaces/${ws}/categories`),
  detail: (id: number) => get<ExpenseClaimDetail>(`/expenses/claims/${id}`),
  create: (ws: string | number, body: { title: string; amount: number; currency?: string; categoryId?: number; description?: string; incurredOn?: string; paidOn?: string; custom?: Record<string, unknown>; submit?: boolean }) =>
    post<ExpenseClaimDetail>(`/expenses/workspaces/${ws}/claims`, body),
  edit: (id: number, body: Partial<{ title: string; amount: number; currency: string; categoryId: number | null; description: string; incurredOn: string; paidOn: string; custom: Record<string, unknown> }>) =>
    patch<ExpenseClaimDetail>(`/expenses/claims/${id}`, body),
  submit: (id: number) => post<ExpenseClaimDetail>(`/expenses/claims/${id}/submit`),
  approve: (id: number) => post<ExpenseClaimDetail>(`/expenses/claims/${id}/approve`),
  pay: (id: number) => post<ExpenseClaimDetail>(`/expenses/claims/${id}/pay`),
  reject: (id: number, reason?: string) => post<ExpenseClaimDetail>(`/expenses/claims/${id}/reject`, { reason }),
  recall: (id: number) => post<ExpenseClaimDetail>(`/expenses/claims/${id}/recall`),
  reopen: (id: number, reason: string) => post<ExpenseClaimDetail>(`/expenses/claims/${id}/reopen`, { reason }),
  remove: (id: number) => del<{ deleted: boolean }>(`/expenses/claims/${id}`),

  // reimbursement form builder + shareable link
  getForm: (ws: string | number) => get<ExpenseForm>(`/expenses/workspaces/${ws}/form`),
  updateForm: (ws: string | number, body: ExpenseFormInput) => patch<ExpenseForm>(`/expenses/workspaces/${ws}/form`, body),
  uploadBranding: async (ws: string | number, kind: "logo" | "banner", file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return (await api.post<{ url: string }>(`/expenses/workspaces/${ws}/form/branding?kind=${kind}`, fd, { headers: { "Content-Type": "multipart/form-data" } })).data;
  },
  formByToken: (token: string) => get<ExpenseForm>(`/expenses/form/${token}`),
  submitViaForm: async (token: string, values: Record<string, unknown>, files: File[]) => {
    const fd = new FormData();
    fd.append("values", JSON.stringify(values));
    for (const f of files) fd.append("files", f);
    return (await api.post<{ ok: boolean; claimId: number }>(`/expenses/form/${token}`, fd, { headers: { "Content-Type": "multipart/form-data" } })).data;
  },
  addReceipt: async (id: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return (await api.post<ExpenseReceipt>(`/expenses/claims/${id}/receipts`, fd, { headers: { "Content-Type": "multipart/form-data" } })).data;
  },
  removeReceipt: (id: number) => del<{ deleted: boolean }>(`/expenses/receipts/${id}`),
  createCategory: (ws: string | number, body: { name: string; monthlyBudget?: number | null; active?: boolean }) => post<{ id: number }>(`/expenses/workspaces/${ws}/categories`, body),
  updateCategory: (id: number, body: { name?: string; monthlyBudget?: number | null; active?: boolean }) => patch<{ updated: boolean }>(`/expenses/categories/${id}`, body),
  deleteCategory: (id: number) => del<{ deleted: boolean }>(`/expenses/categories/${id}`),
  consumption: (wsIds: number[], from?: string, to?: string) =>
    get<Record<number, { total: number; count: number }>>(`/expenses/consumption?ws=${wsIds.join(",")}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`),
};
