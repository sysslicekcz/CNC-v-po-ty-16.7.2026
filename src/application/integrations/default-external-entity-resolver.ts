import {
  ExternalEntityResolver,
  ResolveExternalEntityRequest,
  ExternalEntityResolution,
} from "@/domain/integrations/external-entity-resolver";
import { ExternalReferenceEntityType } from "@/domain/integrations/external-reference";
import { ExternalReferenceRepository } from "@/domain/repositories/external-reference-repository";

/** Najde interní `localEntityId` pro daný podnikový kód dané lokální entity
 *  (`code` je appce-interní business kód, NE odkaz na konkrétní ERP) - vrátí
 *  `null`, pokud kód neexistuje. Např. pro `"machine"` typicky obaluje
 *  `MachineRepository.findByCode`. */
export type BusinessCodeLookup = (tenantId: string, code: string) => Promise<string | null>;

/**
 * Jediná implementace `ExternalEntityResolver` (Krok 3.5 dodatek). Postup:
 *
 * 1. Pokud je zadané `externalId`, hledá existující `ExternalReference` -
 *    nalezení (přesně jedna) je `"matched"/"external_reference"`, víc shod
 *    `"ambiguous"`.
 * 2. Jinak, pokud je zadaný `businessCode` a pro `localEntityType` je
 *    zaregistrovaná `BusinessCodeLookup` strategie, zkusí dohledat podle
 *    podnikového kódu (`"matched"/"business_code"`).
 * 3. Jinak `"not_found"`.
 *
 * Resolver sám NIKDY nezakládá novou lokální entitu - jen hlásí výsledek,
 * založení/spárování rozhoduje volající importní politika (mimo rozsah tohoto
 * kroku). Žádná ERP-specifická logika - `businessCodeLookups` se skládá
 * zvenku podle toho, které lokální entity appka umí párovat podle kódu.
 */
export class DefaultExternalEntityResolver implements ExternalEntityResolver {
  constructor(
    private readonly externalReferenceRepository: ExternalReferenceRepository,
    private readonly businessCodeLookups: Partial<Record<ExternalReferenceEntityType, BusinessCodeLookup>> = {}
  ) {}

  async resolve(request: ResolveExternalEntityRequest): Promise<ExternalEntityResolution> {
    if (request.externalId) {
      const matches = await this.externalReferenceRepository.findByExternalId(
        request.tenantId,
        request.externalSystemId,
        request.externalEntityType,
        request.externalId
      );
      if (matches.length === 1) {
        return { status: "matched", localEntityId: matches[0].localEntityId, matchedBy: "external_reference" };
      }
      if (matches.length > 1) {
        return { status: "ambiguous", candidateIds: matches.map((m) => m.localEntityId) };
      }
    }

    if (request.businessCode) {
      const lookup = this.businessCodeLookups[request.localEntityType];
      if (lookup) {
        const localEntityId = await lookup(request.tenantId, request.businessCode);
        if (localEntityId) {
          return { status: "matched", localEntityId, matchedBy: "business_code" };
        }
      }
    }

    return { status: "not_found" };
  }
}
