interface FormSettingsProps {
  board:any;
  

  onGroupChange: (
    groupId: number
  ) => void;
}

export function FormSettings({
  board,
  onGroupChange,
}: FormSettingsProps) {
  return (
    <section className="space-y-4 border-t pt-8">
      <div>
        <h2 className="font-semibold">
          Submission Settings
        </h2>

        <p className="text-sm text-muted-foreground">
          Choose where submitted requests should appear.
        </p>
      </div>

      <div className="max-w-md space-y-2">
        <label className="text-sm font-medium">
          Destination Group
        </label>

        <select
          value={groupId ?? ""}
          onChange={(event) =>
            onGroupChange(Number(event.target.value))
          }
          className="w-full rounded-md border px-3 py-2"
        >
          <option value="" disabled>
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