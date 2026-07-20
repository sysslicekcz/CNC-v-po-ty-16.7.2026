import { DomainError } from "@/domain/errors/domain-error";

/**
 * "Profil nenalezen" chyby (AP-MCE-001 Fáze B §14) - odlišné od Fáze A
 * `MaterialError.notFound`/`ToolError.notFound` (ty řeší chybějící
 * `Material`/`Tool` master-data záznam jako VSTUP výpočtu), tyhle tři řeší
 * chybějící kalkulační PROFIL (`MaterialProfile`/`MachineProfile`/
 * `ToolProfile`) při resolvování - typicky proto, že profil pro daný
 * materiál/stroj/nástroj ještě nebyl vytvořen (`MaterialProfileFactory`
 * apod. běžel, ale výsledek se neuložil), ne proto, že by chyběl podkladový
 * záznam.
 */
export class MaterialProfileNotFoundError extends DomainError {
  constructor(readonly materialProfileId: string, readonly tenantId: string) {
    super(`MaterialProfile "${materialProfileId}" nebyl pro tenanta "${tenantId}" nalezen.`);
  }
}

export class MachineProfileNotFoundError extends DomainError {
  constructor(readonly machineProfileId: string, readonly tenantId: string) {
    super(`MachineProfile "${machineProfileId}" nebyl pro tenanta "${tenantId}" nalezen.`);
  }
}

export class ToolProfileNotFoundError extends DomainError {
  constructor(readonly toolProfileId: string, readonly tenantId: string) {
    super(`ToolProfile "${toolProfileId}" nebyl pro tenanta "${tenantId}" nalezen.`);
  }
}

export class CuttingConditionNotFoundError extends DomainError {
  constructor(readonly cuttingConditionId: string, readonly tenantId: string) {
    super(`CuttingCondition "${cuttingConditionId}" nebyla pro tenanta "${tenantId}" nalezena.`);
  }
}
