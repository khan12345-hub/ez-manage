
interface FormBuilderHeaderProps {
  isEditing: boolean;
}

export function FormBuilderHeader({
  isEditing,
}: FormBuilderHeaderProps) {
  return (
    <div>
      <h1 className="text-2xl font-semibold">
        {isEditing
          ? "Edit Form"
          : "Create Form"}
      </h1>

      <p className="mt-1 text-sm text-muted-foreground">
        Create a form that employees
        can use to submit requests to
        this board.
      </p>
    </div>
  );
}

