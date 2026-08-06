switch (column.type) {
  case "STATUS":
    return (
      <StatusCellEditor
        value={value}
        column={column}
        onChange={onChange}
      />
    );

  case "DATE":
    return (
      <DateCellEditor
        value={value}
        column={column}
        onChange={onChange}
      />
    );

  case "TIMELINE":
    return (
      <TimelineCellEditor
        value={value}
        column={column}
        onChange={onChange}
      />
    );

  case "CHECKBOX":
    return (
      <CheckboxCellEditor
        value={value}
        column={column}
        onChange={onChange}
      />
    );
}