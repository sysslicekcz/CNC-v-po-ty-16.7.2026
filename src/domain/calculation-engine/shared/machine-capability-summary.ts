/**
 * Plochá projekce existující dvojice `CapabilityType`+`MachineCapabilityValue`
 * (Krok 5, `domain/entities/capability-type.ts`/`machine-capability-value.ts`)
 * pro vložení do `MachineProfile.availableFunctions` (AP-MCE-001 Fáze B §3).
 *
 * ZÁMĚRNĚ pojmenováno `MachineCapabilitySummary`, ne `MachineCapability` -
 * ten název už nese jiná, existující entita (`domain/entities/machine-
 * capability.ts`: "stroj UMÍ typ operace X"), zatímco tohle je "stroj MÁ
 * vlastnost Y s hodnotou Z" (technická vlastnost, `CapabilityType` + jeho
 * hodnota). Stejná třída se stejným jménem na dvou různých místech by byla
 * matoucí duplicita jmen pro odlišné věci - viz Fáze A zdůvodnění u
 * `ValidationError`/`OperationCategory` reuse.
 */
export interface MachineCapabilitySummary {
  capabilityTypeId: string;
  capabilityTypeCode: string;
  value: string | number | boolean;
  unit?: string;
}
