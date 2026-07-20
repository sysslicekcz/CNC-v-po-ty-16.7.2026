/**
 * Odlehčená, jen-datová projekce existující `ExternalReference`
 * (`domain/integrations/external-reference.ts`) pro vložení do profilu
 * (AP-MCE-001 Fáze B §9/§2). ZÁMĚRNĚ ne celá doménová entita `ExternalReference`
 * - profily tohoto modulu nesmí držet živou referenci na cizí modul, jen
 * plochý souhrn toho, co potřebují zobrazit/exportovat. Mapování na tenhle
 * tvar dělá `ExternalReferenceRepository` (existující, znovupoužitý beze
 * změny) přes `application/calculation-engine/resolvers`.
 *
 * ŽÁDNÉ pole typu `heliosId`/`sapId`/`abraId` - jen obecný
 * `externalSystemId` (interní id `ExternalSystem` záznamu, ne jméno
 * konkrétního ERP, viz AP-MCE-001 Fáze B §9).
 */
export interface ExternalReferenceSummary {
  externalSystemId: string;
  externalEntityType: string;
  externalId?: string;
  externalCode?: string;
}
