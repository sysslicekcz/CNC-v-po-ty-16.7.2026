import { ValidationError } from "@/domain/errors/validation-error";
import type { OperationCategory } from "../enums/operation-category";
import { CalculationIssue } from "../entities/types";

/** §5 "Podporuj vstupy: CSV, XLSX, JSON, obecný ERP adapter, obecný MES
 *  adapter, ruční mapování sloupců" - `sourceFormat` popisuje jen TVAR dat,
 *  ne KONKRÉTNÍ systém (žádné "helios"/"sap" jako hodnota, viz §5 "Nevytvářej
 *  pole heliosId, sapId ani jiná ERP-specifická pole"). "erp_adapter"/
 *  "mes_adapter" pokrývají vstup, který už dorazil jako strukturovaná data
 *  (Connector Framework, mimo tenhle modul), ne surový soubor. */
export type ActualTimeImportSourceFormat = "csv" | "xlsx" | "json" | "erp_adapter" | "mes_adapter";

export type ActualTimeImportBatchStatus = "pending" | "validating" | "validated" | "importing" | "completed" | "failed";

/**
 * `ActualTimeImportMapping` (AP-MCE-001 Fáze G §5) - JEDNO tenant-scoped
 * uložené mapování "název sloupce v souboru" -> "pole `ActualTimeRecord`".
 * Sloupce identifikující externí entity (`externalOrderColumn`/
 * `externalOperationColumn`/...) se PO namapování ukládají jako
 * `ExternalReferenceSummary` (Fáze B vzor), ne jako vlastní pole - `externalSystemId`
 * tady je INTERNÍ id existujícího `ExternalSystem` záznamu (Connector
 * Framework), ne jméno konkrétního ERP.
 */
export interface ActualTimeImportMappingProps {
  id: string;
  tenantId: string;
  siteId?: string;
  name: string;
  externalSystemId: string;
  sourceFormat: ActualTimeImportSourceFormat;
  columnMapping: {
    externalOrderColumn?: string;
    externalOperationColumn?: string;
    machineColumn?: string;
    workstationColumn?: string;
    employeeColumn?: string;
    quantityPlannedColumn?: string;
    quantityCompletedColumn?: string;
    quantityScrappedColumn?: string;
    startedAtColumn?: string;
    finishedAtColumn?: string;
    durationMinColumn?: string;
    setupTimeMinColumn?: string;
    machineTimeMinColumn?: string;
    operatorTimeMinColumn?: string;
    downtimeMinColumn?: string;
    downtimeReasonColumn?: string;
  };
  defaultOperationCategory?: OperationCategory;
  createdAt: string;
  updatedAt: string;
}

export class ActualTimeImportMapping {
  private readonly props: Readonly<ActualTimeImportMappingProps>;

  private constructor(props: ActualTimeImportMappingProps) {
    this.props = Object.freeze({ ...props, columnMapping: Object.freeze({ ...props.columnMapping }) });
  }

  static create(props: ActualTimeImportMappingProps): ActualTimeImportMapping {
    if (!props.id.trim()) throw new ValidationError("ActualTimeImportMapping: 'id' nesmí být prázdné.");
    if (!props.tenantId.trim()) throw new ValidationError("ActualTimeImportMapping: 'tenantId' nesmí být prázdné.");
    if (!props.name.trim()) throw new ValidationError("ActualTimeImportMapping: 'name' nesmí být prázdné.");
    if (!props.externalSystemId.trim()) throw new ValidationError("ActualTimeImportMapping: 'externalSystemId' nesmí být prázdné.");
    return new ActualTimeImportMapping(props);
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
  get name(): string {
    return this.props.name;
  }
  get externalSystemId(): string {
    return this.props.externalSystemId;
  }
  get sourceFormat(): ActualTimeImportSourceFormat {
    return this.props.sourceFormat;
  }
  get columnMapping(): Readonly<ActualTimeImportMappingProps["columnMapping"]> {
    return this.props.columnMapping;
  }
  get defaultOperationCategory(): OperationCategory | undefined {
    return this.props.defaultOperationCategory;
  }
  get createdAt(): string {
    return this.props.createdAt;
  }
  get updatedAt(): string {
    return this.props.updatedAt;
  }

  toPlainObject(): Record<string, unknown> {
    return { ...this.props, columnMapping: { ...this.props.columnMapping } };
  }
}

/** Jeden SUROVÝ řádek - klíče odpovídají hlavičce souboru/JSON polím, ne
 *  polím `ActualTimeRecord` (to řeší `ActualTimeImportMapping` níž). Parsování
 *  bytů CSV/XLSX/JSON souboru je Infrastructure starost (mimo Domain) -
 *  `ActualTimeImportRow` už pracuje s formátově NEZÁVISLÝM tvarem. */
export interface ActualTimeImportRow {
  rowNumber: number;
  rawData: Readonly<Record<string, string | number | undefined>>;
}

export type ActualTimeImportRowStatus = "valid" | "invalid" | "skipped";

/** Výsledek zpracování JEDNOHO řádku (§5/§28) - `mappedDraft` je vyplněný jen
 *  pro `status === "valid"`. */
export interface ActualTimeImportRowResult {
  rowNumber: number;
  status: ActualTimeImportRowStatus;
  issues: CalculationIssue[];
  mappedDraft?: Record<string, unknown>;
}

export interface ActualTimeImportResult {
  mappingId: string;
  totalRows: number;
  validRowCount: number;
  invalidRowCount: number;
  rows: ActualTimeImportRowResult[];
}

export interface ActualTimeImportBatchProps {
  id: string;
  tenantId: string;
  siteId?: string;
  mappingId: string;
  sourceFormat: ActualTimeImportSourceFormat;
  sourceFileName?: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  importedRows: number;
  status: ActualTimeImportBatchStatus;
  startedAt: string;
  finishedAt?: string;
  createdBy: string;
  createdAt: string;
}

/**
 * `ActualTimeImportBatch` (AP-MCE-001 Fáze G §5) - JEDEN import běh, tenant-
 * scoped, immutable po vytvoření (nová verze = nová instance přes `withX`
 * metody, stejná disciplína jako `ActualTimeRecord`).
 */
export class ActualTimeImportBatch {
  private readonly props: Readonly<ActualTimeImportBatchProps>;

  private constructor(props: ActualTimeImportBatchProps) {
    this.props = Object.freeze({ ...props });
  }

  static create(props: ActualTimeImportBatchProps): ActualTimeImportBatch {
    if (!props.id.trim()) throw new ValidationError("ActualTimeImportBatch: 'id' nesmí být prázdné.");
    if (!props.tenantId.trim()) throw new ValidationError("ActualTimeImportBatch: 'tenantId' nesmí být prázdné.");
    if (!props.mappingId.trim()) throw new ValidationError("ActualTimeImportBatch: 'mappingId' nesmí být prázdné.");
    for (const field of ["totalRows", "validRows", "invalidRows", "importedRows"] as const) {
      if (!Number.isInteger(props[field]) || props[field] < 0) {
        throw new ValidationError(`ActualTimeImportBatch: '${field}' musí být nezáporné celé číslo.`);
      }
    }
    return new ActualTimeImportBatch(props);
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
  get mappingId(): string {
    return this.props.mappingId;
  }
  get sourceFormat(): ActualTimeImportSourceFormat {
    return this.props.sourceFormat;
  }
  get sourceFileName(): string | undefined {
    return this.props.sourceFileName;
  }
  get totalRows(): number {
    return this.props.totalRows;
  }
  get validRows(): number {
    return this.props.validRows;
  }
  get invalidRows(): number {
    return this.props.invalidRows;
  }
  get importedRows(): number {
    return this.props.importedRows;
  }
  get status(): ActualTimeImportBatchStatus {
    return this.props.status;
  }
  get startedAt(): string {
    return this.props.startedAt;
  }
  get finishedAt(): string | undefined {
    return this.props.finishedAt;
  }
  get createdBy(): string {
    return this.props.createdBy;
  }
  get createdAt(): string {
    return this.props.createdAt;
  }

  withResult(result: ActualTimeImportResult, importedRows: number, finishedAt: string): ActualTimeImportBatch {
    return new ActualTimeImportBatch({
      ...this.props,
      totalRows: result.totalRows,
      validRows: result.validRowCount,
      invalidRows: result.invalidRowCount,
      importedRows,
      status: "completed",
      finishedAt,
    });
  }

  withStatus(status: ActualTimeImportBatchStatus): ActualTimeImportBatch {
    return new ActualTimeImportBatch({ ...this.props, status });
  }

  toPlainObject(): Record<string, unknown> {
    return { ...this.props };
  }
}
