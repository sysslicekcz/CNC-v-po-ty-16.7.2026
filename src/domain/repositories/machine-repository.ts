import { Machine } from "../entities/machine";
import { MachineCode } from "../value-objects/machine-code";

/** Tenant-scoped - `findById` musí interně ověřit, že vrácený stroj patří
 *  aktuálnímu tenantovi (viz docs/adr/0019: nestačí spoléhat na to, že UUID
 *  nikdo neuhodne). `delete` bere `tenantId` explicitně jako obranu proti
 *  smazání cizích dat i při chybě volajícího kódu. */
export interface MachineRepository {
  findById(id: string, tenantId: string): Promise<Machine | null>;
  findByCode(tenantId: string, code: MachineCode): Promise<Machine | null>;
  list(tenantId: string): Promise<Machine[]>;
  count(tenantId: string): Promise<number>;
  save(machine: Machine): Promise<void>;
  delete(id: string, tenantId: string): Promise<void>;
}
