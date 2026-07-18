import { getAll } from "@/lib/db";
import {
  Customer as LegacyCustomer,
  Inquiry as LegacyInquiry,
  Part as LegacyPart,
  Position as LegacyPosition,
  Machine as LegacyMachine,
} from "@/lib/entities";
import { Row } from "@/lib/results";

/**
 * Skutečný tvar `partOperationRows` (viz audit Krok 3, src/components/
 * PartWorkspace.tsx:72-74 a src/lib/entities.ts::ensureDefaultPosition): pole
 * `partId` na tomhle záznamu ve skutečnosti nese id POLOHY, ne dílu. Přejmenováno
 * tady jako `LegacyPartOperationRowsRecord.partId` beze změny (zůstává stejné
 * jméno pole kvůli přímému čtení ze store), ale s komentářem, aby se migrační
 * kód nedal zmást - všude jinde v migraci se na tuhle hodnotu odkazuje jako
 * "legacyPositionId".
 */
export interface LegacyPartOperationRowsRecord {
  id: string;
  partId: string; // = legacyPositionId, viz komentář výše
  opId: string;
  rows: Row[];
}

/** Skutečný tvar `toolRows` (src/lib/useAllTools.ts) - JEDEN záznam na dvojici
 *  (stroj, typ operace), s POLEM řádků uvnitř - ne jeden záznam = jeden fyzický
 *  nástroj. Jednotlivé řádky uvnitř `rows` nemají vlastní id. */
export interface LegacyToolRowsRecord {
  id: string; // `${strojId}:${opId}`
  strojId: string;
  opId: string;
  rows: Row[];
}

export interface LegacySourceData {
  customers: LegacyCustomer[];
  inquiries: LegacyInquiry[];
  parts: LegacyPart[];
  positions: LegacyPosition[];
  partOperationRows: LegacyPartOperationRowsRecord[];
  toolRows: LegacyToolRowsRecord[];
  machines: LegacyMachine[];
}

/** Čte VŠECHNA stará data přes existující src/lib/db.ts - jen ke čtení, nikdy
 *  nezapisuje do starých stores (strangler pattern, zadání bod 3). */
export async function readLegacySourceData(): Promise<LegacySourceData> {
  const [customers, inquiries, parts, positions, partOperationRows, toolRows, machines] = await Promise.all([
    getAll<LegacyCustomer>("customers"),
    getAll<LegacyInquiry>("inquiries"),
    getAll<LegacyPart>("parts"),
    getAll<LegacyPosition>("positions"),
    getAll<LegacyPartOperationRowsRecord>("partOperationRows"),
    getAll<LegacyToolRowsRecord>("toolRows"),
    getAll<LegacyMachine>("machines"),
  ]);
  return { customers, inquiries, parts, positions, partOperationRows, toolRows, machines };
}
