"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { saveColumnFormula } from "@/services/columns.api";
import { validateFormula, evaluateFormula } from "@/lib/formula-evaluator";
import { getErrorMessage } from "@/lib/error-message";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  column: {
    id: number;
    name: string;
    formula?: string | null;
  };
  /** Other columns on the board (for the reference chips) */
  boardColumns: Array<{ id: number; name: string; type: string }>;
}

const NUMERIC_TYPES = new Set([
  "NUMBER", "PRICE", "CHECKBOX", "FORMULA",
]);

export function FormulaEditorDialog({ open, onOpenChange, column, boardColumns }: Props) {
  const queryClient = useQueryClient();
  const params = useParams();
  const boardId = Number(params.boardId);

  const [formula, setFormula] = useState(column.formula ?? "");

  const validationError = formula.trim() ? validateFormula(formula) : null;

  const numericColumns = boardColumns.filter(
    (c) => c.id !== column.id && NUMERIC_TYPES.has(c.type),
  );

  const saveMutation = useMutation({
    mutationFn: () => saveColumnFormula(column.id, formula.trim()),
    onSuccess: () => {
      toast.success("Formula saved");
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to save formula"));
    },
  });

  function insertRef(colName: string) {
    setFormula((prev) => prev + `{${colName}}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit formula — {column.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Reference chips */}
          {numericColumns.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Click a column to insert it into the formula:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {numericColumns.map((c) => (
                  <Badge
                    key={c.id}
                    variant="outline"
                    className="cursor-pointer select-none hover:bg-muted"
                    onClick={() => insertRef(c.name)}
                  >
                    {`{${c.name}}`}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Formula input */}
          <div>
            <Textarea
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              placeholder="e.g. {Price} * {Qty} * 1.17"
              className="font-mono text-sm"
              rows={3}
              spellCheck={false}
            />
            {validationError && (
              <p className="mt-1 text-xs text-destructive">{validationError}</p>
            )}
          </div>

          {/* Syntax reference */}
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
            <p className="font-medium text-foreground mb-1">Supported syntax</p>
            <p><span className="font-mono">{`{Column Name}`}</span> — reference a numeric column</p>
            <p><span className="font-mono">+ - * /</span> — basic arithmetic</p>
            <p><span className="font-mono">IF(cond, ifTrue, ifFalse)</span> — e.g. <span className="font-mono">IF({Qty} {">"} 0, {"{Price}"} * {"{Qty}"}, 0)</span></p>
            <p><span className="font-mono">SUM({`{A}`}, {`{B}`})</span> · <span className="font-mono">ROUND({`{val}`}, 2)</span> · <span className="font-mono">ABS</span> · <span className="font-mono">MIN</span> · <span className="font-mono">MAX</span> · <span className="font-mono">AVERAGE</span></p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !!validationError}
          >
            {saveMutation.isPending ? "Saving…" : "Save formula"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
