"use client";

import { evaluateFormula, type FormulaCell as FormulaCellData } from "@/lib/formula-evaluator";

interface FormulaCellProps {
  value: {
    formula: string;
    cells: FormulaCellData[];
  };
}

export function FormulaCell({ value }: FormulaCellProps) {
  const { formula, cells } = value;

  if (!formula?.trim()) {
    return (
      <span className="text-xs text-muted-foreground italic">no formula</span>
    );
  }

  const { result, error } = evaluateFormula(formula, cells);

  if (error) {
    return (
      <span
        className="font-mono text-xs font-semibold text-destructive"
        title={error}
      >
        #ERR
      </span>
    );
  }

  if (result === null) return null;

  const formatted = Number.isInteger(result)
    ? result.toLocaleString()
    : result.toLocaleString(undefined, { maximumFractionDigits: 6 });

  return (
    <span className="font-mono text-sm tabular-nums">{formatted}</span>
  );
}
