
"use client";

interface FormSettingsProps {
  name: string;
  description: string;
  groupId: number | null;
  groups: any[];

  onNameChange: (
    value: string,
  ) => void;

  onDescriptionChange: (
    value: string,
  ) => void;

  onGroupChange: (
    value: number | null,
  ) => void;
}

export function FormSettings({
  name,
  description,
  groupId,
  groups,
  onNameChange,
  onDescriptionChange,
  onGroupChange,
}: FormSettingsProps) {
  return (
    <section className="space-y-4">
      <div>
        <label className="text-sm font-medium">
          Form title
        </label>

        <input
          value={name}
          onChange={(event) =>
            onNameChange(
              event.target.value,
            )
          }
          placeholder="Employee Request Form"
          className="mt-2 w-full rounded-md border px-3 py-2"
        />
      </div>

      <div>
        <label className="text-sm font-medium">
          Description
        </label>

        <textarea
          value={description}
          onChange={(event) =>
            onDescriptionChange(
              event.target.value,
            )
          }
          placeholder="Tell employees what this form is for..."
          className="mt-2 min-h-24 w-full rounded-md border px-3 py-2"
        />
      </div>

      <div>
        <label className="text-sm font-medium">
          Submission group
        </label>

        <p className="mt-1 text-xs text-muted-foreground">
          New tasks submitted through
          this form will be created in
          this group.
        </p>

        <select
          value={
            groupId
              ? String(groupId)
              : ""
          }
          onChange={(event) =>
            onGroupChange(
              event.target.value
                ? Number(
                    event.target.value,
                  )
                : null,
            )
          }
          className="mt-2 w-full rounded-md border bg-background px-3 py-2"
        >
          <option value="">
            Select a group
          </option>

          {groups.map((group) => (
            <option
              key={group.id}
              value={group.id}
            >
              {group.name}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}

