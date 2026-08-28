"use client";

import { Search, Plus } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

// import { RowActions } from "./RowActions";
import { DeleteDialog } from "./DeleteDialog";
import { User } from "./types";
import { RowActions } from "./RowActions";

const mockUsers: User[] = [
  {
    id: 1,
    name: "Muhammad Ali",
    email: "ali@example.com",
    role: "SUPER_ADMIN",
    status: "Active",
  },
  {
    id: 2,
    name: "John Doe",
    email: "john@example.com",
    role: "USER",
    status: "Active",
  },
  {
    id: 3,
    name: "Sarah Khan",
    email: "sarah@example.com",
    role: "USER",
    status: "Active",
  },
];

export function UsersTab() {
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] =
    useState<User | null>(null);

  const filteredUsers = mockUsers.filter(
    (user) =>
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <Header />

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
                  <th className="px-5 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b last:border-0 hover:bg-muted/20"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 font-medium text-primary">
                          {user.name.charAt(0)}
                        </div>

                        <div>
                          <p className="font-medium">
                            {user.name}
                          </p>

                          <p className="text-xs text-muted-foreground">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <Badge variant="outline">
                        {user.role}
                      </Badge>
                    </td>

                    <td className="px-5 py-4">
                      <Badge variant="secondary">
                        {user.status}
                      </Badge>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <RowActions
                        onEdit={() => {}}
                        onDelete={() => setSelectedUser(user)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <DeleteDialog
        open={!!selectedUser}
        onOpenChange={(open) =>
          !open && setSelectedUser(null)
        }
        title="Delete user?"
        description={`This will permanently delete ${selectedUser?.name}.`}
      />
    </div>
  );
}

function Header() {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h2 className="text-xl font-semibold">Users</h2>

        <p className="text-sm text-muted-foreground">
          Manage users and system access.
        </p>
      </div>

      <Button>
        <Plus className="mr-2 h-4 w-4" />
        Add User
      </Button>
    </div>
  );
}

