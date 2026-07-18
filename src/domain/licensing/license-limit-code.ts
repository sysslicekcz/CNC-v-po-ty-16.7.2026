/** Katalog číselných limitů licence (Krok 3.5, bod 22) - stejný princip jako
 *  FeatureCode: centralizovaný, stabilní seznam. */
export type LicenseLimitCode =
  | "users.max"
  | "machines.max"
  | "routingSheets.active.max"
  | "calculations.monthly.max"
  | "storage.mb.max"
  | "integrations.systems.max";
