interface Props {
  cell?: any;
}

export function PersonCell({ cell }: Props) {
  if (!cell) return <>—</>;

  const value = cell.value;

  if (value?.user) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
          {value.user.firstName?.[0]}
        </div>

        <span>
          {value.user.firstName} {value.user.lastName}
        </span>
      </div>
    );
  }

  if (value?.name) {
    return value.name;
  }

  return <>—</>;
}