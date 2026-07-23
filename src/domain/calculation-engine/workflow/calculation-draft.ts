import { ValidationError } from "@/domain/errors/validation-error";
import type { OperationCategory } from "../enums/operation-category";

/** AP-MCE-001 Fáze H §4 "Zdroj výpočtu" - odkud `NewCalculationWizard` vzniká. */
export type CalculationDraftSourceType = "new" | "technology_operation" | "production_order" | "quote_item" | "copy" | "import";

export interface CalculationDraftProps {
  id: string;
  tenantId: string;
  siteId?: string;
  sourceType: CalculationDraftSourceType;
  /** Id zdrojové entity podle `sourceType` (technologická operace/výrobní
   *  příkaz/položka nabídky/kopírovaný `CalculationResult.id`) -
   *  `undefined` pro `sourceType === "new"`. */
  sourceReferenceId?: string;
  operationCategory?: OperationCategory;
  currentStep: number;
  /** Syrový, ještě nevalidovaný stav formuláře průvodce (Fáze H §4/§27) -
   *  ukládá se přesně tak, jak ho uživatel zadal, žádná doménová validace
   *  koncept neblokuje (na rozdíl od `CalculationResult`, který bez validních
   *  vstupů vůbec nevznikne). */
  formState: Readonly<Record<string, unknown>>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * `CalculationDraft` (AP-MCE-001 Fáze H §4/§27) - rozpracovaný stav
 * `NewCalculationWizard` PŘED vznikem `CalculationRequest`/`CalculationResult`.
 * Pokrývá spec §14 stavy "draft"/"validating", které do `CalculationStatus`
 * (Fáze A-G, `CalculationResult` životní cyklus) nepatří - koncept, na rozdíl
 * od `CalculationResult`, NENÍ immutable historický záznam, smí se přepisovat
 * na místě (autosave), dokud existuje. Zahození konceptu ho smaže úplně -
 * žádná auditní stopa se nevyžaduje (§27 "explicitní zahození konceptu"),
 * protože dokud nevznikl `CalculationResult`, není co auditovat.
 */
export class CalculationDraft {
  private readonly props: Readonly<CalculationDraftProps>;

  private constructor(props: CalculationDraftProps) {
    this.props = Object.freeze({ ...props, formState: Object.freeze({ ...props.formState }) });
  }

  static create(props: CalculationDraftProps): CalculationDraft {
    if (!props.id.trim()) throw new ValidationError("CalculationDraft: 'id' nesmí být prázdné.");
    if (!props.tenantId.trim()) throw new ValidationError("CalculationDraft: 'tenantId' nesmí být prázdné.");
    if (!Number.isInteger(props.currentStep) || props.currentStep < 1) {
      throw new ValidationError("CalculationDraft: 'currentStep' musí být kladné celé číslo.");
    }
    if (props.sourceType !== "new" && !props.sourceReferenceId?.trim()) {
      throw new ValidationError(`CalculationDraft: 'sourceReferenceId' je povinné pro sourceType "${props.sourceType}".`);
    }
    return new CalculationDraft(props);
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get siteId(): string | undefined {
    return this.props.siteId;
  }
  get sourceType(): CalculationDraftSourceType {
    return this.props.sourceType;
  }
  get sourceReferenceId(): string | undefined {
    return this.props.sourceReferenceId;
  }
  get operationCategory(): OperationCategory | undefined {
    return this.props.operationCategory;
  }
  get currentStep(): number {
    return this.props.currentStep;
  }
  get formState(): Readonly<Record<string, unknown>> {
    return this.props.formState;
  }
  get createdBy(): string {
    return this.props.createdBy;
  }
  get createdAt(): string {
    return this.props.createdAt;
  }
  get updatedAt(): string {
    return this.props.updatedAt;
  }

  /** Autosave (§4/§27) - vrací NOVOU instanci s aktualizovaným krokem/stavem
   *  formuláře, nikdy nemutuje `this` (stejná disciplína jako zbytek modulu,
   *  i když koncept sám auditní historii nedrží). */
  withProgress(currentStep: number, formState: Record<string, unknown>, operationCategory: OperationCategory | undefined, updatedAt: string): CalculationDraft {
    return new CalculationDraft({ ...this.props, currentStep, formState, operationCategory, updatedAt });
  }

  toPlainObject(): Record<string, unknown> {
    return { ...this.props, formState: { ...this.props.formState } };
  }
}
