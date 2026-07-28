import type { ExcelTableData } from "./excel.types";

interface ExcelTableProps {
  data: ExcelTableData;
}

export default function ExcelTable({ data }: ExcelTableProps) {
  return (
    <table className="border-collapse">
      <colgroup>
        {data.columnWidths.map((width, index) => (
          <col
            key={index}
            style={{
              width: `${width}px`,
            }}
          />
        ))}
      </colgroup>

      <tbody>
        {data.rows.map((row, rowIndex) => (
          <tr
            key={rowIndex}
            style={{
              height: row.height ? `${row.height * 1.33}px` : undefined,
            }}
          >
            {row.cells.map((cell, cellIndex) => (
              <td
                key={cellIndex}
                colSpan={cell.colSpan}
                rowSpan={cell.rowSpan}
                style={{
                  ...cell.style,
                  border: "1px solid #d1d5db",
                  padding: "4px 8px",
                }}
              >
                {cell.value}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
