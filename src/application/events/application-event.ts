/**
 * Tvar budoucích aplikačních událostí (Krok 3.5, bod 30) - JEN typové
 * deklarace, žádný event bus/publisher/subscriber. Use casy dnes tyhle
 * události nikam nepublikují - připravuje se jen tvar dat, aby budoucí verze
 * (audit log, notifikace, Helios sync fronta) nemusela vymýšlet schéma od
 * nuly. Bez side-channelů kolem stavu, který si drží repozitáře/aggregate.
 */
export interface ApplicationEvent<TName extends string = string, TPayload = unknown> {
  name: TName;
  occurredAt: string; // ISO 8601
  tenantId: string;
  payload: TPayload;
}

export type MachineCodeChanged = ApplicationEvent<
  "machine.code_changed",
  { machineId: string; previousCode: string; newCode: string }
>;

export type MachineAssignedToCapacityGroup = ApplicationEvent<
  "machine.assigned_to_capacity_group",
  { machineId: string; capacityGroupId: string | undefined }
>;

export type LicenseFeatureDenied = ApplicationEvent<
  "license.feature_denied",
  { featureCode: string; requiredAccess: string }
>;

export type LicenseLimitExceeded = ApplicationEvent<
  "license.limit_exceeded",
  { limitCode: string; limit: number; requestedValue: number }
>;

export type TenantActivated = ApplicationEvent<"tenant.activated", { tenantId: string }>;

export type TenantSuspended = ApplicationEvent<"tenant.suspended", { tenantId: string }>;
