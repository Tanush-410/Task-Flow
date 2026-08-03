export function FieldError({
  children,
  id,
}: {
  children?: string;
  id?: string;
}) {
  if (!children) {
    return null;
  }

  return (
    <p className="mt-1.5 text-sm text-destructive" id={id}>
      {children}
    </p>
  );
}
