export interface UnrecognizedEventsNoticeProps {
  runLabel: string;
  unrecognizedEventCount: number;
}

/**
 * Surfaces LogFile.unrecognizedEventCount per contracts/input-log-schema.md's
 * "Forward/backward schema compatibility" rule: unrecognized events must be
 * visibly reported, never silently dropped.
 */
export function UnrecognizedEventsNotice({ runLabel, unrecognizedEventCount }: UnrecognizedEventsNoticeProps) {
  if (unrecognizedEventCount === 0) return null;

  return (
    <p role="status" className="unrecognized-events-notice">
      {runLabel}: {unrecognizedEventCount} unrecognized, not included in metrics.
    </p>
  );
}
