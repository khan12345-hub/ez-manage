"use client";

interface ExcelImportSettingsProps {
  boardName: string;
  visibility: "PUBLIC" | "PRIVATE";

  isImporting?: boolean;

  onBoardNameChange: (value: string) => void;
  onVisibilityChange: (
    value: "PUBLIC" | "PRIVATE",
  ) => void;
}

export function ExcelImportSettings({
  boardName,
  visibility,
  isImporting = false,
  onBoardNameChange,
  onVisibilityChange,
}: ExcelImportSettingsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Board Name
        </label>

        <input
          value={boardName}
          onChange={(event) =>
            onBoardNameChange(event.target.value)
          }
          disabled={isImporting}
          className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 dark:border-zinc-800 dark:bg-zinc-950"
          placeholder="Board name"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">
          Visibility
        </label>

        <select
          value={visibility}
          onChange={(event) =>
            onVisibilityChange(
              event.target.value as
                | "PUBLIC"
                | "PRIVATE",
            )
          }
          disabled={isImporting}
          className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <option value="PRIVATE">Private</option>
          <option value="PUBLIC">Public</option>
        </select>
      </div>
    </div>
  );
}