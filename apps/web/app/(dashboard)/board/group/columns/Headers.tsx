export const Headers = ({column}:any) => {
  return (
    <th key={column.id} className="border-b px-4 py-3 text-left font-semibold">
      {column.name}
    </th>
  );
};
