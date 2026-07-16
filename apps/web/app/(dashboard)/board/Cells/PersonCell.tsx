import { User2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface BoardMember {
  id: number;
  firstName: string;
  lastName: string;
  avatar?: string | null;
}

interface Props {
  cell?: BoardMember | BoardMember[] | null;
}

export function PersonCell({ cell }: Props) {
  const users = cell ? (Array.isArray(cell) ? cell : [cell]) : [];

  if (users.length === 0) {
    return (
      <Avatar className="h-7 w-7 border-2 border-background">
        <AvatarFallback className="bg-muted text-muted-foreground">
          <User2 className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
    );
  }

  return (
    <div className="flex -space-x-2">
      {users.slice(0, 3).map((user) => (
        <Avatar
          key={user.id}
          className="h-7 w-7 border-2 border-background"
        >
          <AvatarImage src={user.avatar ?? undefined} />
          <AvatarFallback>
            {user.firstName?.[0]}
            {user.lastName?.[0]}
          </AvatarFallback>
        </Avatar>
      ))}

      {users.length > 1 && (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs">
          +{users.length - 3}
        </div>
      )}
    </div>
  );
}