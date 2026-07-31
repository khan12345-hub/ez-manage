"use client";
import { FileSpreadsheet, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
interface ExcelBoardImportProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  onPreview: () => void;
  disabled?: boolean;
}
export function ExcelBoardImport({
  file,
  onFileChange,
  onPreview,
  disabled,
}: ExcelBoardImportProps) {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      return;
    }
    const isExcel =
      selectedFile.type ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      selectedFile.type === "application/vnd.ms-excel" ||
      selectedFile.name.toLowerCase().endsWith(".xlsx") ||
      selectedFile.name.toLowerCase().endsWith(".xls");
    if (!isExcel) {
      event.target.value = "";
      return;
    }
    onFileChange(selectedFile);
  };
  return (
    <div className="space-y-2">
      
      <div className="text-sm font-medium"> Import from Excel </div>
      {!file ? (
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-6 transition-colors hover:bg-muted/50">
          
          <FileSpreadsheet className="mb-2 h-8 w-8 text-muted-foreground" />
          <span className="text-sm font-medium"> Upload Excel file </span>
          <span className="mt-1 text-xs text-muted-foreground">
            
            .xlsx or .xls files only
          </span>
          <input
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="hidden"
            disabled={disabled}
            onChange={handleFileChange}
          />
        </label>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border p-3">
          
          <FileSpreadsheet className="h-8 w-8 shrink-0 text-green-600" />
          <button
            type="button"
            onClick={onPreview}
            className="min-w-0 flex-1 text-left"
          >
            
            <p className="truncate text-sm font-medium hover:underline">
              
              {file.name}
            </p>
            <p className="text-xs text-muted-foreground">
              
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            onClick={() => onFileChange(null)}
          >
            
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
