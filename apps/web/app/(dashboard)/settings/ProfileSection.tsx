"use client";

import {
  ChangeEvent,
  RefObject,
  Dispatch,
  SetStateAction,
} from "react";

import { Camera, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/form/FormInput";

import { User } from "./ProfileSettings";

interface ProfileSectionProps {
  user: User;
  previewUrl: string | null;
  setPreviewUrl: Dispatch<
    SetStateAction<string | null>
  >;
  setAvatar: Dispatch<
    SetStateAction<File | null>
  >;
  fileInputRef: RefObject<
    HTMLInputElement | null
  >;
}

export function ProfileSection({
  user,
  previewUrl,
  setPreviewUrl,
  setAvatar,
  fileInputRef,
}: ProfileSectionProps) {
  const firstName = user.firstName;
  const lastName = user.lastName;

  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`;

  function handleAvatarChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    if (
      !file.type.startsWith("image/")
    ) {
      return;
    }

    if (
      file.size >
      5 * 1024 * 1024
    ) {
      return;
    }

    if (
      previewUrl?.startsWith("blob:")
    ) {
      URL.revokeObjectURL(
        previewUrl,
      );
    }

    const newPreviewUrl =
      URL.createObjectURL(file);

    setAvatar(file);
    setPreviewUrl(newPreviewUrl);
  }

  const imageSrc = previewUrl
    ? previewUrl.startsWith("blob:")
      ? previewUrl
      : `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}${previewUrl}`
    : undefined;

  return (
    <section className="rounded-xl border bg-card">
      <div className="border-b p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <UserRound className="h-5 w-5" />
          </div>

          <div>
            <h2 className="font-semibold">
              Profile
            </h2>

            <p className="text-sm text-muted-foreground">
              Update your personal
              information.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 p-6">
        {/* Avatar */}
        <div>
          <label className="mb-3 block text-sm font-medium">
            Profile picture
          </label>

          <div className="flex items-center gap-4">
            <div className="h-20 w-20 overflow-hidden rounded-full border">
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt="Profile picture"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted text-lg font-semibold uppercase">
                  {initials || "U"}
                </div>
              )}
            </div>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={
                  handleAvatarChange
                }
              />

              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  fileInputRef.current?.click()
                }
              >
                <Camera className="mr-2 h-4 w-4" />
                Change photo
              </Button>

              <p className="mt-2 text-xs text-muted-foreground">
                PNG, JPG or WEBP.
                Maximum 5MB.
              </p>
            </div>
          </div>
        </div>

        {/* Names */}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput
            name="firstName"
            label="First name"
          />

          <FormInput
            name="lastName"
            label="Last name"
          />
        </div>

        {/* Email */}
        <div>
          <label className="mb-2 block text-sm font-medium">
            Email
          </label>

          <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            {user.email}
          </div>

          <p className="mt-1 text-xs text-muted-foreground">
            Your email address cannot be
            changed here.
          </p>
        </div>
      </div>
    </section>
  );
}