import { ExternalReferenceEntityType } from "./external-reference";

export interface ResolveExternalEntityRequest {
  tenantId: string;
  externalSystemId: string;

  localEntityType: ExternalReferenceEntityType;
  externalEntityType: string;

  externalId?: string;
  externalCode?: string;
  businessCode?: string;
}

export type ExternalEntityResolution =
  | {
      status: "matched";
      localEntityId: string;
      matchedBy: "external_reference" | "external_id" | "external_code" | "business_code" | "manual";
    }
  | { status: "not_found" }
  | { status: "ambiguous"; candidateIds: string[] }
  | { status: "conflict"; reason: string };

/**
 * ERP-neutrální kontrakt "najdi lokální entitu odpovídající tomuhle záznamu
 * externího systému" (Krok 3.5 dodatek - "ERP-nezávislá architektura").
 * Implementace (`DefaultExternalEntityResolver`) NIKDY sama nezaloží novou
 * lokální entitu, jen jednu ze čtyř variant výsledku vrátí - založení/spárování
 * je vždy explicitní rozhodnutí importní politiky nad tímhle výsledkem, ne
 * vedlejší efekt resolveru (viz docs/adr/erp-agnostic-integration-layer.md).
 */
export interface ExternalEntityResolver {
  resolve(request: ResolveExternalEntityRequest): Promise<ExternalEntityResolution>;
}
