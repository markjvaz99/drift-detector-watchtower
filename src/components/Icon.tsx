export type IconName =
  | "upload"
  | "download"
  | "warning"
  | "star-filled"
  | "star-outline"
  | "chevron-down"
  | "plus"
  | "external"
  | "history"
  | "check-circle"
  | "sparkle"
  | "key"
  | "close";

const PATHS: Record<IconName, string> = {
  upload: "M12 16V4M12 4l-5 5M12 4l5 5M5 20h14",
  download: "M12 4v12m0 0l-5-5m5 5l5-5M5 20h14",
  warning: "M12 3l10 18H2L12 3zm0 7v4m0 3h.01",
  "star-filled": "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  "star-outline": "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  "chevron-down": "M6 9l6 6 6-6",
  plus: "M12 5v14M5 12h14",
  external: "M14 4h6v6M20 4l-9 9M8 5H5a1 1 0 00-1 1v13a1 1 0 001 1h13a1 1 0 001-1v-3",
  history: "M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8M3 3v5h5M12 7v5l4 2",
  "check-circle": "M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z",
  sparkle: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z",
  key: "M15 7a4 4 0 10-3.9 5H15l2 2 2-2 2 2 2-2-2-2h-2.1A4 4 0 0015 7zM3 21l6-6",
  close: "M6 6l12 12M18 6L6 18",
};

export interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 14, className }: IconProps) {
  const filled = name === "star-filled";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon ${className ?? ""}`}
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
