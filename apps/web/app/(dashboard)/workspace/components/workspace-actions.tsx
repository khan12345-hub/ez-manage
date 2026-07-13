"use client";

import { Button } from "@/components/ui/button";
import {
  MoreHorizontal,
  Settings,
  UserPlus,
  Users,
} from "lucide-react";

export function WorkspaceActions() {
  return (
    <div className="flex items-center gap-3">
      <Button>
        <UserPlus className="mr-2 h-4 w-4" />
        Invite
      </Button>

      <Button variant="outline">
        <Users className="mr-2 h-4 w-4" />
        Members
      </Button>

      <Button variant="outline" size="icon">
        <Settings className="h-4 w-4" />
      </Button>

    </div>
  );
}