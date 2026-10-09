import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMe, login, logout } from "./auth.api";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useChatStore } from "@/store/chat-store";
import { useTaskDetailsStore } from "@/store/task-details-store";
import { useInviteModalStore } from "@/store/invite-modal";

export function useLogin() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  return useMutation({
    mutationFn: login,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["me"],
      });
      const redirect = searchParams.get("redirect");
      const isSafe = redirect && redirect.startsWith("/") && !redirect.startsWith("//");
      router.push(isSafe ? redirect : "/workspace/1");
    },
    onError: (error: any) => {
      const errorMsg =
        error?.response?.data?.message ||
        "Login Failed. Please try again.";
      toast.error(errorMsg);
    },
    retry: false,
  });
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    retry: false,
    retryOnMount: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 5 * 60_000,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // Clear server-state cache
      queryClient.clear();

      // Reset all Zustand stores so stale data doesn't leak to the next user
      useChatStore.setState({
        activeChannelId: null,
        channels: [],
        dms: [],
        messages: {},
        unreadCounts: {},
        onlineUserIds: new Set(),
        userStatuses: {},
        isChatOpen: false,
        incomingCall: null,
        activeCall: null,
        callDeclinedMsg: null,
        channelWorkspaceMap: {},
        workspaceUnreads: [],
        isSocketConnected: false,
      });
      useTaskDetailsStore.setState({ isOpen: false, context: {} });
      useInviteModalStore.setState({
        isOpen: false,
        workspaceId: undefined,
        boardId: undefined,
        boardRole: undefined,
        workspaceRole: undefined,
      });

      router.push("/login");
    },
  });
}
