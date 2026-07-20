import { DomainError } from "@/domain/errors/domain-error";

/**
 * Chyby týkající se nástroje jako vstupu výpočtu (AP-MCE-001 §18: "neznámý
 * nástroj", "nevhodný nástroj"). `notFound` je blokující (`error`),
 * `unsuitableForMaterial` odpovídá varovnému stavu ("nevhodná kombinace
 * nástroje a materiálu") - use case/strategie si podle potřeby zvolí, jestli
 * ji vyhodí jako chybu, nebo jen přiloží jako warning k výsledku.
 */
export class ToolError extends DomainError {
  constructor(message: string) {
    super(message);
  }

  static notFound(toolId: string): ToolError {
    return new ToolError(`Nástroj "${toolId}" nebyl nalezen.`);
  }

  static unsuitableForMaterial(toolId: string, materialId: string): ToolError {
    return new ToolError(`Nástroj "${toolId}" není doporučený pro materiál "${materialId}".`);
  }
}
