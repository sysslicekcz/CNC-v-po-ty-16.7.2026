/** AP-MCE-001 Fáze G §2 "sourceType" - odkud skutečný čas pochází. */
export type ActualTimeSourceType = "manual" | "imported" | "erp" | "mes" | "machine_signal" | "employee_terminal" | "calculated_from_events" | "corrected";

/** AP-MCE-001 Fáze G §2 "measurementMethod" - JAK byl čas naměřen/odvozen. */
export type ActualTimeMeasurementMethod = "explicit_duration" | "start_stop" | "event_aggregation" | "machine_runtime" | "operator_declaration" | "imported_summary" | "derived";

/** AP-MCE-001 Fáze G §2 "status" - životní cyklus záznamu (§21 workflow). */
export type ActualTimeStatus = "draft" | "validated" | "approved" | "rejected" | "superseded" | "archived";

/** AP-MCE-001 Fáze G §3 "segmentType" - jeden časový úsek v rámci operace. */
export type ActualTimeSegmentType =
  | "setup"
  | "production"
  | "machine_cycle"
  | "operator_attendance"
  | "handling"
  | "inspection"
  | "waiting"
  | "downtime"
  | "interruption"
  | "tool_change"
  | "fixture_change"
  | "cleaning"
  | "rework"
  | "break"
  | "unknown";
