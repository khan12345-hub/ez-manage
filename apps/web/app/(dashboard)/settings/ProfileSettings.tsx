"use client";

import { useEffect, useRef, useState } from "react";

import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { updateUserSettings } from "@/services/users.api";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";

import { ProfileSection } from "./ProfileSection";
import { PasswordSection } from "./PasswordSection";

import {
  UpdateUserSettingsDto,
  updateUserSettingsSchema,
} from "./settings.schema";

export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string | null;
}

export function ProfileSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [avatar, setAvatar] =
    useState<File | null>(null);

  const [previewUrl, setPreviewUrl] =
    useState<string | null>(
      user.avatarUrl ?? null,
    );

  const updateSettingsMutation = useMutation({
    mutationFn: updateUserSettings,

    onSuccess: (updatedUser) => {
      queryClient.setQueryData(
        ["auth", "me"],
        updatedUser,
      );

      // Update form's default values so
      // isDirty becomes false after saving.
      form.reset({
        firstName: updatedUser.firstName ?? "",
        lastName: updatedUser.lastName ?? "",
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      setAvatar(null);

      setPreviewUrl(
        updatedUser.avatarUrl ?? null,
      );

      toast.success(
        "Settings updated successfully!",
      );
    },

    onError: () => {
      toast.error(
        "Failed to update settings.",
      );
    },
  });

  const form = useForm<UpdateUserSettingsDto>({
    resolver: zodResolver(
      updateUserSettingsSchema,
    ),

    defaultValues: {
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function onSubmit(
    values: UpdateUserSettingsDto,
  ) {
    updateSettingsMutation.mutate({
      firstName: values.firstName,
      lastName: values.lastName,
      currentPassword:
        values.currentPassword || undefined,
      newPassword:
        values.newPassword || undefined,
      avatar,
    });
  }

  const hasChanges =
    form.formState.isDirty || avatar !== null;

  return (
    <div className="relative w-full max-w-3xl">
      <FormProvider {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex w-full flex-col gap-8 pb-28"
        >
          <ProfileSection
            user={user}
            previewUrl={previewUrl}
            setPreviewUrl={setPreviewUrl}
            setAvatar={setAvatar}
            fileInputRef={fileInputRef}
          />

          <PasswordSection />

          {form.formState.errors.root && (
            <p className="text-sm text-destructive">
              {
                form.formState.errors.root
                  .message
              }
            </p>
          )}

          <div className="fixed inset-x-0 bottom-0 left-64 z-50 border-t border-white/10 bg-background/20 p-4 backdrop-blur-md">
            <div className="flex w-full justify-end">
              <Button
                loading={
                  updateSettingsMutation.isPending
                }
                disabled={
                  !hasChanges ||
                  updateSettingsMutation.isPending
                }
                type="submit"
                className="h-11 w-max shadow-lg"
              >
                Save changes
              </Button>
            </div>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}