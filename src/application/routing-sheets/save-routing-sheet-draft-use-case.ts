import { RoutingSheet } from "@/domain/aggregates/routing-sheet/routing-sheet";
import { RoutingSheetRepository } from "@/domain/repositories/routing-sheet-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { NotFoundError } from "@/domain/errors/not-found-error";
import { InvalidStateError } from "@/domain/errors/invalid-state-error";
import { ConcurrentModificationError } from "@/domain/errors/routing-sheet-errors";

export interface SaveRoutingSheetDraftCommand {
  routingSheet: RoutingSheet;
  updatedBy?: string;
  /** ISO 8601 `updatedAt`, který editor naposledy načetl - `undefined` = kontrola
   *  se přeskočí (např. hned po CreateRoutingSheetUseCase). Optimistic
   *  concurrency základ (zadání bod 41) - v dnešní jednouživatelské appce
   *  konflikt reálně nenastává, jen výjimečně (dvě otevřené karty). */
  expectedUpdatedAt?: string;
}

/**
 * Jediné místo, které ukládá celý aggregate draftu (zadání bod 43 - "nevytvářej
 * zbytečně síť velmi malých persistence use cases"). Lokální mutace (přidání
 * operace, přeuspořádání, ...) dělá editor state přímo přes metody `RoutingSheet`
 * (in-memory, synchronní) - tenhle use case je jediný, který mluví s repository.
 */
export class SaveRoutingSheetDraftUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly routingSheetRepository: RoutingSheetRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(command: SaveRoutingSheetDraftCommand): Promise<RoutingSheet> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.RoutingEdit, "write");

    const { routingSheet } = command;
    if (routingSheet.tenantId !== tenantId) {
      throw new NotFoundError("RoutingSheet", routingSheet.id);
    }
    if (routingSheet.stav !== "draft") {
      throw new InvalidStateError(`Nelze uložit postup ve stavu "${routingSheet.stav}" - autosave/uložení funguje jen pro draft.`);
    }

    if (command.expectedUpdatedAt !== undefined) {
      const existing = await this.routingSheetRepository.findById(routingSheet.id, tenantId);
      const existingUpdatedAt = existing?.updatedAt ? new Date(existing.updatedAt).toISOString() : undefined;
      if (existing && existingUpdatedAt !== command.expectedUpdatedAt) {
        throw new ConcurrentModificationError(routingSheet.id);
      }
    }

    routingSheet.touch(new Date(), command.updatedBy);
    await this.routingSheetRepository.save(routingSheet);
    return routingSheet;
  }
}
