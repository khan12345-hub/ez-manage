interface BasicLoaderProps {
  className?: string;
}

export const BasicLoader = ({ className = "" }: BasicLoaderProps) => {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 ${className}`}
    >
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary" />
    </div>
  );
};

export const FullScreenLoader = () => {
  return (
    <div className="flex h-screen items-center justify-center">
      <BasicLoader />
    </div>
  );
};