# 0008 – Repository Pattern s Dependency Inversion

## Status
Přijato

## Context
Appka dnes přistupuje k IndexedDB přímo z React hooků (`src/lib/entities.ts`). Cíl je doménu/aplikační logiku připravit na budoucí přechod na jinou databázi (PostgreSQL, REST API, ...) bez přepisu byznys logiky.

## Decision
Repository rozhraní jsou definovaná v doméně (`src/domain/repositories/*.ts`), implementace budou v `src/infrastructure/persistence/*`. V tomto kroku existuje jen `InMemoryRoutingSheetRepository` (pro testy) – žádná produkční IndexedDB implementace se zatím nepřipojuje (viz zadání, bod 13 a 21 – strangler pattern, stará appka zůstává nedotčená vedle nové domény).

## Consequences
- Doména/Application vrstva nikdy neimportuje z `src/lib/db.ts` ani z IndexedDB API přímo.
- Budoucí IndexedDB adaptér bude muset řešit mapování Domain Entity ↔ Persistence Record (viz zadání, bod 12) – v tomto kroku ještě neřešeno, protože žádná perzistence nové domény neexistuje.
