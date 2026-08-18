
interface FormActionsProps {
  isEditing: boolean;
  isSaving: boolean;
  disabled: boolean;
  onSave: () => void;
}

export function FormActions({
  isEditing,
  isSaving,
  disabled,
  onSave,
}: FormActionsProps) {
  return (
    <div className="flex justify-end border-t pt-6">
      <button
        type="button"
        onClick={onSave}
        disabled={disabled}
        className="cursor-pointer rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving
          ? "Saving..."
          : isEditing
            ? "Update Form"
            : "Create Form"}
      </button>
    </div>
  );
}

