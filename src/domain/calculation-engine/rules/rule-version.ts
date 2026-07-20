import { ValidationError } from "@/domain/errors/validation-error";

/**
 * Minimální nosič jedné verze výpočtových pravidel (AP-MCE-001 §09/§15) -
 * NENÍ to plnohodnotný `CalculationRule`/`RuleVersion` entitní model z
 * AP-MCE-001 §09 (číselník jednotlivých pojmenovaných pravidel s vlastní
 * historií editací) - tahle fáze potřebuje jen TOLIK, aby `CalculationContext`
 * měl na co odkazovat (`ruleVersionId`) a aby `RuleRepository` měl smysluplný
 * návratový typ. Plný model (jednotlivá `CalculationRule` s vlastní historií,
 * UI pro "Rule management" z AP-MCE-001 §20/§21 Fáze G) přijde v pozdější
 * fázi jako ADITIVNÍ rozšíření - `constants` bag níže je dost obecný, aby ho
 * tahle budoucí fáze mohla dál číst beze změny tvaru.
 *
 * Immutable po vytvoření - jednou publikovaná verze pravidel se nikdy needituje
 * (AP-MCE-001 §15: "Starý výsledek se po změně pravidel nesmí automaticky
 * změnit"), jen se vytvoří nová `RuleVersion` se `status: "active"` a stará
 * přejde na `"retired"`.
 */
export type RuleVersionStatus = "draft" | "active" | "retired";

export interface RuleVersionProps {
  id: string;
  tenantId: string;
  /** Lidsky čitelný popisek verze, např. "2025-06-01" - `id` zůstává interní. */
  version: string;
  status: RuleVersionStatus;
  publishedAt: string; // ISO 8601
  /** Pojmenované konstanty, které smí strategie/engine číst podle klíče -
   *  např. "default.percentageAllowance", "default.operatorSkillCoefficient".
   *  TODO(pozdější fáze): nahradit typovaným katalogem jednotlivých
   *  `CalculationRule` záznamů, až vznikne UI pro jejich správu. */
  constants: Readonly<Record<string, number>>;
}

export class RuleVersion {
  private readonly props: Readonly<RuleVersionProps>;

  private constructor(props: RuleVersionProps) {
    this.props = Object.freeze({
      ...props,
      constants: Object.freeze({ ...props.constants }),
    });
  }

  static create(props: RuleVersionProps): RuleVersion {
    if (!props.id.trim()) throw new ValidationError("RuleVersion: 'id' nesmí být prázdné.");
    if (!props.tenantId.trim()) throw new ValidationError("RuleVersion: 'tenantId' nesmí být prázdné.");
    if (!props.version.trim()) throw new ValidationError("RuleVersion: 'version' nesmí být prázdný.");
    return new RuleVersion(props);
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get version(): string {
    return this.props.version;
  }
  get status(): RuleVersionStatus {
    return this.props.status;
  }
  get publishedAt(): string {
    return this.props.publishedAt;
  }
  get constants(): Readonly<Record<string, number>> {
    return this.props.constants;
  }

  /** Bezpečné čtení jedné konstanty s výchozí hodnotou, pokud `RuleVersion`
   *  daný klíč nenese (např. starší verze pravidel bez nově přidané konstanty). */
  getConstant(key: string, fallback: number): number {
    const value = this.props.constants[key];
    return value === undefined ? fallback : value;
  }
}
