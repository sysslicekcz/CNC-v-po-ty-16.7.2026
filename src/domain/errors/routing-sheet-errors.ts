import { DomainError } from "./domain-error";

/** Optimistic concurrency (zadání Krok 4, bod 41) - záznam byl mezitím změněný
 *  jinou relací (`updatedAt` v uloženém záznamu neodpovídá tomu, co editor
 *  naposledy načetl). V dnešní jednouživatelské/offline appce nastává jen
 *  výjimečně (např. dvě otevřené karty prohlížeče), příprava na budoucí
 *  souběžnou editaci - viz docs/step-4/known-limitations.md. */
export class ConcurrentModificationError extends DomainError {
  constructor(readonly routingSheetId: string) {
    super(`Technologický postup "${routingSheetId}" byl mezitím změněn jinou relací.`);
  }
}
