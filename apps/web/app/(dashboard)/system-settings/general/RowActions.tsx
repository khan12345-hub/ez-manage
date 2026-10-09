
import { Mail, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface RowActionsProps {
  onEdit: () => void;
  onDelete: () => void;
  onSendResetLink?: () => void;
  showEdit?: boolean;
}

export function RowActions({
  onEdit,
  onDelete,
  onSendResetLink,
  showEdit = true,
}: RowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
        >
          <span className="text-lg leading-none">⋮</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {showEdit && (
          <>
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
          </>
        )}

        {onSendResetLink && (
          <DropdownMenuItem onClick={onSendResetLink}>
            <Mail className="mr-2 h-4 w-4" />
            Send Reset Link
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={onDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

