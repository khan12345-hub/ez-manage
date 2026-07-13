import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMe, login, logout } from "./auth.api";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
export function useLogin() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: login,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["me"],
      });
      router.push("/dashboard");
    },
    onError: (error: any) => {
      const errorMsg =
        error?.response?.data?.message ||
        "Failed to send invitation. Please try again.";
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
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear();
      router.push("/login");
    },
  });
}
