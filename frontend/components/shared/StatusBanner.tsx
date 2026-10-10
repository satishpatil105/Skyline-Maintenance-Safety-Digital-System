export type StatusType = "success" | "error" | "info" | null;

export default function StatusBanner({
  type,
  message,
}: {
  type: StatusType;
  message: string;
}) {
  if (!type || !message) {
    return null;
  }

  const className =
    type === "success"
      ? "status-banner status-success"
      : type === "error"
      ? "status-banner status-error"
      : "status-banner status-info";

  return <div className={className}>{message}</div>;
}
