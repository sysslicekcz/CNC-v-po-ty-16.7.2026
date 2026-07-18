/**
 * Připraveno pro budoucí párování, POKUD Helios (nebo jiný systém) poskytuje
 * jiné technické ID než uživatelsky zadávaný kód (Krok 3.5, bod 16). Dokud
 * takové ID neexistuje, nic ho nepoužívá - párování jede jen přes
 * `Machine.code`/`ToolCode`. Žádný store, žádná repository - jen typ pro
 * budoucí použití, aby se nezaváděl zbytečný integrační framework předem.
 */
export interface ExternalSystemReference {
  system: string;
  entityType: string;
  externalId: string;
  externalCode?: string;
}
