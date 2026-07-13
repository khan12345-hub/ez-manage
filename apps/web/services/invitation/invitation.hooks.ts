import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createInvitation, CreateInvitationDto } from "./invitation.api";

export function useCreateInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateInvitationDto) => createInvitation(data),
    onSuccess: (data) => {
      // Invalidate related queries if any (e.g. active invitations list)
      queryClient.invalidateQueries({
        queryKey: ["invitations"],
      });
    },
  });
}
