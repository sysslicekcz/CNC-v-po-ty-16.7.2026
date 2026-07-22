import { CalculationRepository } from "@/domain/calculation-engine/repositories/calculation-repository";
import { CalculationRequest } from "@/domain/calculation-engine/entities/calculation-request";
import { CalculationResult } from "@/domain/calculation-engine/entities/calculation-result";
import { CalculationRequestRecord, CalculationResultRecord } from "@/infrastructure/persistence/indexeddb/records";
import { tpvGet, tpvGetAllByIndex, tpvPut } from "@/infrastructure/persistence/indexeddb/tpv-db";
import {
  calculationRequestToRecord,
  calculationRequestFromRecord,
  calculationResultToRecord,
  calculationResultFromRecord,
} from "./mappers";

/**
 * IndexedDB implementace `CalculationRepository` (AP-MCE-001, Fáze A) - stejný
 * `tpvGet`/`tpvGetAllByIndex`/`tpvPut` základ jako zbytek appky
 * (`persistence/indexeddb/tpv-db.ts`), žádná druhá databáze jen pro tenhle
 * modul (byla by to čistá ceremonie navíc, appka už jednu bezpečně
 * verzovanou IndexedDB databázi má). `findRequestByIdempotencyKey` filtruje v
 * JS nad `tenantId` indexem - stejný vzor jako `findByCode` u ostatních
 * kmenových repozitářů (`tpvMachines`/`tpvMaterials`/...) - unikátní
 * `tenantId_idempotencyKey` index na store existuje jen jako pojistka na
 * úrovni `put()`, ne jako dotazovací cesta.
 */
export class IndexedDbCalculationRepository implements CalculationRepository {
  async saveRequest(request: CalculationRequest): Promise<void> {
    await tpvPut("tpvCalculationRequests", calculationRequestToRecord(request));
  }

  async findRequestById(id: string, tenantId: string): Promise<CalculationRequest | null> {
    const record = await tpvGet<CalculationRequestRecord>("tpvCalculationRequests", id);
    if (!record || record.tenantId !== tenantId) return null;
    return calculationRequestFromRecord(record);
  }

  async findRequestByIdempotencyKey(idempotencyKey: string, tenantId: string): Promise<CalculationRequest | null> {
    const records = await tpvGetAllByIndex<CalculationRequestRecord>("tpvCalculationRequests", "tenantId", tenantId);
    const match = records.find((r) => r.idempotencyKey === idempotencyKey);
    return match ? calculationRequestFromRecord(match) : null;
  }

  async saveResult(result: CalculationResult): Promise<void> {
    await tpvPut("tpvCalculationResults", calculationResultToRecord(result));
  }

  async findResultById(id: string, tenantId: string): Promise<CalculationResult | null> {
    const record = await tpvGet<CalculationResultRecord>("tpvCalculationResults", id);
    if (!record || record.tenantId !== tenantId) return null;
    return calculationResultFromRecord(record);
  }

  async findResultsByRequestId(calculationRequestId: string, tenantId: string): Promise<CalculationResult[]> {
    const records = await tpvGetAllByIndex<CalculationResultRecord>(
      "tpvCalculationResults",
      "calculationRequestId",
      calculationRequestId
    );
    return records
      .filter((r) => r.tenantId === tenantId)
      .map(calculationResultFromRecord)
      .sort((a, b) => b.calculatedAt.localeCompare(a.calculatedAt)); // nejnovější první
  }

  async listResultsByTenant(tenantId: string): Promise<CalculationResult[]> {
    const records = await tpvGetAllByIndex<CalculationResultRecord>("tpvCalculationResults", "tenantId", tenantId);
    return records.map(calculationResultFromRecord);
  }
}
