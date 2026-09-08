"use client";

import { Search, Plus, Loader2 } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { DeleteDialog } from "./DeleteDialog";
import { RowActions } from "./RowActions";
import { UserFormDialog } from "./UserFormDialog";
import { User } from "./types";
import {
  AdminUser,
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
} from "@/services/users.api";

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
    mutationFn: (id: number) => deleteUser(id),
    onSuccess: () => {
      toast.success("User deleted successfully");
      setDeletingUser(null);
      invalidate();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Failed to delete user");
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
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-muted-foreground">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-muted-foreground">
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

                      <td className="px-5 py-4 text-right">
                        <RowActions
                          onEdit={() => handleEdit(user)}
                          onDelete={() => setDeletingUser(user)}
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

      <DeleteDialog
        open={!!deletingUser}
        onOpenChange={(open) => !open && setDeletingUser(null)}
        title="Delete user?"
        description={`This will permanently delete ${deletingUser?.name}. This action cannot be undone.`}
        onConfirm={() => deletingUser && deleteMutation.mutate(deletingUser.id)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
