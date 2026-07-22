"use client";

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";

interface ExcelPreviewProps {
  url: string;
  fileName: string;
}

export default function ExcelPreview({
  url,
  fileName,
}: ExcelPreviewProps) {
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadExcel = async () => {
      try {
        setLoading(true);
        setError(false);

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(
            "Failed to fetch Excel file",
          );
        }

        const arrayBuffer =
          await response.arrayBuffer();

        const workbook = XLSX.read(
          arrayBuffer,
          {
            type: "array",
          },
        );

        const firstSheetName =
          workbook.SheetNames[0];

        if (!firstSheetName) {
          throw new Error(
            "Excel file has no sheets",
          );
        }

        const worksheet =
          workbook.Sheets[firstSheetName];

        const htmlTable =
          XLSX.utils.sheet_to_html(
            worksheet || [],
          );

        if (!cancelled) {
          setHtml(htmlTable);
        }
      } catch (error) {
        console.error(
          "Excel preview error:",
          error,
        );

        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

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

  if (error) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <p className="text-sm text-destructive">
          Unable to preview this Excel file.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[70vh] overflow-auto rounded-md border">
      <div
        className="excel-preview min-w-full"
        dangerouslySetInnerHTML={{
          __html: html,
        }}
      />
    </div>
  );
}