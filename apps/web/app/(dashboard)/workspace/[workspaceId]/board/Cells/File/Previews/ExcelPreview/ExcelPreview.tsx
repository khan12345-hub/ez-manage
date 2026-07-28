"use client";

import { useEffect, useState } from "react";
import ExcelTable from "./ExcelPreviewTable";
import {
  parseExcel,
} from "./excel-utils";
import type {
  ExcelTableData,
} from "./excel.types";

interface ExcelPreviewProps {
  url: string;
  fileName: string;
}

export default function ExcelPreview({
  url,
  fileName,
}: ExcelPreviewProps) {
  const [data, setData] =
    useState<ExcelTableData | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadExcel() {
      try {
        setLoading(true);
        setError(false);

        const response = await fetch(
          url,
          {
            credentials: "include",
          }
        );

        if (!response.ok) {
          throw new Error(
            "Failed to fetch Excel file"
          );
        }

        const arrayBuffer =
          await response.arrayBuffer();

        const parsed =
          await parseExcel(
            arrayBuffer
          );

        if (!cancelled) {
          setData(parsed);
        }
      } catch (error) {
        console.error(
          "Excel preview error:",
          error
        );

        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadExcel();

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Loading Excel preview...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <p className="text-sm text-destructive">
          Unable to preview this Excel file.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[70vh] overflow-auto rounded-md border bg-white">
      <ExcelTable data={data} />
    </div>
  );
}