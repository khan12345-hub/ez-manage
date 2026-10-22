"use client";

import { Search, Plus, Loader2, Clock, UserCheck, AlertTriangle, ShieldOff, UserX, X } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { createPortal } from "react-dom";
import { RowActions } from "./RowActions";
import { UserFormDialog } from "./UserFormDialog";
import { User } from "./types";
import {
  AdminUser,
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  sendPasswordResetLink,
} from "@/services/users.api";

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function toUser(u: AdminUser): User {
  return {
    id: u.id,
    name: `${u.firstName} ${u.lastName}`.trim(),
    email: u.email,
    role: u.systemRole,
    status:
      u.status === "ACTIVE"
        ? "Active"
        : u.status === "INACTIVE"
          ? "Inactive"
          : "Suspended",
    createdAt: u.createdAt,
    createdBy: u.createdBy ?? null,
  };
}

export function UsersTab() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  const { data: adminUsers = [], isLoading } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => getAllUsers(search || undefined),
    staleTime: 30_000,
  });

  const users = adminUsers.map(toUser);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      toast.success("User created successfully");
      setFormOpen(false);
      invalidate();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Failed to create user");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) =>
      updateUser(id, payload),
    onSuccess: () => {
      toast.success("User updated successfully");
      setFormOpen(false);
      setEditingUser(null);
      invalidate();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Failed to update user");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, force }: { id: number; force: boolean }) => deleteUser(id, force),
    onSuccess: (_, { force }) => {
      toast.success(force ? "User permanently deleted." : "User disabled. Their assignments show as Deleted User.");
      setDeletingUser(null);
      invalidate();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Failed to delete user");
    },
  });

  const resetLinkMutation = useMutation({
    mutationFn: (email: string) => sendPasswordResetLink(email),
    onSuccess: (_data, email) => {
      toast.success(`Password reset link sent to ${email}`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Failed to send reset link");
    },
  });

  const handleFormSubmit = (data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    systemRole: "USER" | "SUPER_ADMIN";
  }) => {
    if (editingUser) {
      updateMutation.mutate({
        id: editingUser.id,
        payload: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          systemRole: data.systemRole,
          ...(data.password ? { newPassword: data.password } : {}),
        },
      });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormOpen(true);
  };

  const handleAddUser = () => {
    setEditingUser(null);
    setFormOpen(true);
  };

  const isFormLoading =
    createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">Users</h2>
          <p className="text-sm text-muted-foreground">
            Manage users and system access.
          </p>
        </div>

        <Button onClick={handleAddUser}>
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="border-b p-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users..."
                className="pl-9"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left">
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3">Added By</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b last:border-0 hover:bg-muted/20"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 font-medium text-primary">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <Badge variant="outline">{user.role}</Badge>
                      </td>

                      <td className="px-5 py-4">
                        <Badge
                          variant={user.status === "Active" ? "secondary" : "destructive"}
                        >
                          {user.status}
                        </Badge>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 shrink-0" />
                          {formatDate(user.createdAt)}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        {user.createdBy ? (
                          <div className="flex items-center gap-1.5 text-xs">
                            <UserCheck className="h-3 w-3 shrink-0 text-green-500" />
                            <span className="font-medium text-foreground">
                              {user.createdBy.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <RowActions
                          onEdit={() => handleEdit(user)}
                          onDelete={() => setDeletingUser(user)}
                          onSendResetLink={() => resetLinkMutation.mutate(user.email)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <UserFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingUser(null);
        }}
        user={editingUser}
        onSubmit={handleFormSubmit}
        loading={isFormLoading}
      />

      {/* Two-option delete modal */}
      {deletingUser && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => !deleteMutation.isPending && setDeletingUser(null)}
        >
          <div
            className="w-[440px] rounded-xl border border-border bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-border px-5 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950/40">
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Delete user</p>
                <p className="text-xs text-muted-foreground truncate">
                  {deletingUser.name} · {deletingUser.email}
                </p>
              </div>
              <button
                onClick={() => setDeletingUser(null)}
                disabled={deleteMutation.isPending}
                className="ml-auto rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Options */}
            <div className="flex flex-col gap-3 p-5">
              {/* Soft delete */}
              <button
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate({ id: deletingUser.id, force: false })}
                className="flex items-start gap-3.5 rounded-xl border border-border bg-muted/40 p-4 text-left transition-all hover:border-amber-300 hover:bg-amber-50/50 disabled:opacity-50 dark:hover:border-amber-700 dark:hover:bg-amber-950/20"
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/50">
                  <ShieldOff className="h-4 w-4 text-amber-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">Disable Account</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    Revokes login access across all workspaces. Their existing task assignments remain intact and display as <span className="font-medium text-foreground">Deleted User</span> — all data is preserved.
                  </p>
                </div>
              </button>

              {/* Force delete */}
              <button
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate({ id: deletingUser.id, force: true })}
                className="flex items-start gap-3.5 rounded-xl border border-border bg-muted/40 p-4 text-left transition-all hover:border-red-300 hover:bg-red-50/50 disabled:opacity-50 dark:hover:border-red-800 dark:hover:bg-red-950/20"
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-950/50">
                  <UserX className="h-4 w-4 text-red-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-red-600">Force Delete</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    Permanently removes the user and all their data — task assignments, time entries, and board access across <span className="font-medium text-foreground">all workspaces</span>. <span className="font-medium text-red-500">Cannot be undone.</span>
                  </p>
                </div>
              </button>
            </div>

            {/* Cancel */}
            <div className="flex justify-end border-t border-border px-5 py-3">
              <button
                onClick={() => setDeletingUser(null)}
                disabled={deleteMutation.isPending}
                className="rounded-lg px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
