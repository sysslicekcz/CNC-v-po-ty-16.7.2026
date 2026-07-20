import { CalculationIssue } from "../entities/types";

/**
 * Typovaná reprezentace nálezu `ToolMaterialCompatibilityService.check`
 * (AP-MCE-001 Fáze B §4/§14) - VAROVÁNÍ, ne blokující chyba (proto nededí
 * `DomainError`/`Error` - nikdy se nevyhazuje jako výjimka, jen se převádí na
 * `CalculationIssue` a přikládá k výsledku, přesně jako dnes dělá
 * `ToolMaterialCompatibilityService`). Pojmenování `*Warning` (ne `*Error`)
 * je záměrné - AP-MCE-001 §14 výslovně žádá rozlišovat "blokující chybu" od
 * "varování", a tenhle typ dokládá, že rozdíl je i v pojmenování tříd, ne jen
 * v `severity` poli.
 */
export class ToolMaterialMismatchWarning {
  private constructor(readonly toolProfileId: string, readonly materialGroupId: string) {}

  static forMismatch(toolProfileId: string, materialGroupId: string): ToolMaterialMismatchWarning {
    return new ToolMaterialMismatchWarning(toolProfileId, materialGroupId);
  }

  toCalculationIssue(): CalculationIssue {
    return {
      code: "TOOL_MATERIAL_MISMATCH",
      severity: "warning",
      message: `Nástroj "${this.toolProfileId}" není doporučený pro materiálovou skupinu "${this.materialGroupId}".`,
      field: "materialId",
    };
  }
}
