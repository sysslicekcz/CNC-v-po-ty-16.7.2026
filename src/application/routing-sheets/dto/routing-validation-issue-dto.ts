export type RoutingValidationSeverity = "info" | "warning" | "error";

/**
 * Strukturovaný validační nález (Krok 4, zadání bod 25) - `ValidateRoutingSheetUseCase`
 * ho produkuje jak pro průběžné zobrazení v draftu (jen `warning`/`info` blokují
 * nic), tak pro release validaci (`error` blokuje `ReleaseRoutingSheetUseCase`).
 * `operationId`/`positionId`/`activityId`/`field` dovolují UI navigovat přímo na
 * místo chyby (zadání bod 25: "Kliknutí na chybu má navigovat na příslušnou
 * operaci nebo pole").
 */
export interface RoutingValidationIssueDto {
  id: string;
  severity: RoutingValidationSeverity;

  code: string;
  message: string;

  routingSheetId?: string;
  operationId?: string;
  positionId?: string;
  activityId?: string;

  field?: string;
}
