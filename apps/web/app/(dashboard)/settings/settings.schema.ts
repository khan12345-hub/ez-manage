import { z } from "zod";

export const updateUserSettingsSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1, "First name is required")
      .max(
        50,
        "First name must be less than 50 characters",
      ),

    lastName: z
      .string()
      .trim()
      .min(1, "Last name is required")
      .max(
        50,
        "Last name must be less than 50 characters",
      ),

    currentPassword: z
      .string()
      .optional(),

    newPassword: z
      .string()
      .optional()
      .refine(
        (value) => {
          // Password is optional
          if (!value) {
            return true;
          }

          return (
            value.length >= 8 &&
            /[A-Z]/.test(value) &&
            /[0-9]/.test(value) &&
            /[^A-Za-z0-9]/.test(value)
          );
        },
        {
          message:
            "Password must be at least 8 characters and contain one uppercase letter, one number, and one special character",
        },
      ),

    confirmPassword: z
      .string()
      .optional(),
  })
  .refine(
    (data) => {
      // User is not changing password
      if (!data.newPassword) {
        return true;
      }

      // New password requires current password
      return !!data.currentPassword;
    },
    {
      message:
        "Current password is required to change your password",
      path: ["currentPassword"],
    },
  )
  .refine(
    (data) => {
      // User is not changing password
      if (!data.newPassword) {
        return true;
      }

      // New password and confirmation must match
      return (
        data.newPassword ===
        data.confirmPassword
      );
    },
    {
      message:
        "Passwords do not match",
      path: ["confirmPassword"],
    },
  );

export type UpdateUserSettingsDto =
  z.infer<
    typeof updateUserSettingsSchema
  >;