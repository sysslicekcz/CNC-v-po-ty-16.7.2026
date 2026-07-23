import { ValidationError } from "@/domain/errors/validation-error";

export interface QuoteCalculationLinkProps {
  id: string;
  tenantId: string;
  /** Id položky nabídky - PROSTÝ řetězec, ne odkaz na doménovou entitu:
   *  v tomhle projektu zatím žádný Quote/Nabídka modul neexistuje (ověřeno
   *  auditem Fáze H §1). Tahle vazba je proto dopředu-kompatibilní kontrakt -
   *  až Quote modul vznikne, bude jen číst/zapisovat stejná pole, beze změny
   *  tvaru. */
  quoteItemId: string;
  calculationId: string;
  calculationRevision: number;
  quantity: number;
  machineVariantLabel?: string;
  toolVariantLabel?: string;
  isSelectedVariant: boolean;
  confidenceScore?: number;
  linkedBy: string;
  linkedAt: string;
  recordVersion: number;
}

/**
 * `QuoteCalculationLink` (AP-MCE-001 Fáze H §19) - vazba časového ZÁKLADU
 * (konkrétní `CalculationResult` revize) na položku nabídky, PRO DANÉ
 * množství a varianta stroje/nástroje. §19 explicitně: "vytvoř časovou
 * integraci, nevytvářej kompletní finanční kalkulační systém, pokud v
 * projektu ještě neexistuje" - projekt žádný finanční/Quote modul nemá
 * (ověřeno auditem), tahle entita proto nese jen ČAS + confidence, žádnou
 * cenu/náklad.
 */
export class QuoteCalculationLink {
  private readonly props: Readonly<QuoteCalculationLinkProps>;

  private constructor(props: QuoteCalculationLinkProps) {
    this.props = Object.freeze({ ...props });
  }

  static create(props: QuoteCalculationLinkProps): QuoteCalculationLink {
    if (!props.id.trim()) throw new ValidationError("QuoteCalculationLink: 'id' nesmí být prázdné.");
    if (!props.tenantId.trim()) throw new ValidationError("QuoteCalculationLink: 'tenantId' nesmí být prázdné.");
    if (!props.quoteItemId.trim()) throw new ValidationError("QuoteCalculationLink: 'quoteItemId' nesmí být prázdné.");
    if (!props.calculationId.trim()) throw new ValidationError("QuoteCalculationLink: 'calculationId' nesmí být prázdné.");
    if (!Number.isInteger(props.quantity) || props.quantity <= 0) {
      throw new ValidationError("QuoteCalculationLink: 'quantity' musí být kladné celé číslo.");
    }
    if (!Number.isInteger(props.recordVersion) || props.recordVersion < 1) {
      throw new ValidationError("QuoteCalculationLink: 'recordVersion' musí být kladné celé číslo.");
    }
    return new QuoteCalculationLink(props);
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get quoteItemId(): string {
    return this.props.quoteItemId;
  }
  get calculationId(): string {
    return this.props.calculationId;
  }
  get calculationRevision(): number {
    return this.props.calculationRevision;
  }
  get quantity(): number {
    return this.props.quantity;
  }
  get machineVariantLabel(): string | undefined {
    return this.props.machineVariantLabel;
  }
  get toolVariantLabel(): string | undefined {
    return this.props.toolVariantLabel;
  }
  get isSelectedVariant(): boolean {
    return this.props.isSelectedVariant;
  }
  get confidenceScore(): number | undefined {
    return this.props.confidenceScore;
  }
  get linkedBy(): string {
    return this.props.linkedBy;
  }
  get linkedAt(): string {
    return this.props.linkedAt;
  }
  get recordVersion(): number {
    return this.props.recordVersion;
  }

  selectAsVariant(): QuoteCalculationLink {
    return new QuoteCalculationLink({ ...this.props, isSelectedVariant: true, recordVersion: this.props.recordVersion + 1 });
  }

  toPlainObject(): Record<string, unknown> {
    return { ...this.props };
  }
}
