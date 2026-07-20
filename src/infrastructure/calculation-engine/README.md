# Manufacturing Calculation Engine — infrastructure (Fáze A)

Repository implementace a mapování pro tenhle modul žijí TADY, ne ve sdílené
`src/infrastructure/persistence/indexeddb/repositories/` (kde bydlí všechny
ostatní `IndexedDb*Repository` v appce). To je vědomá odchylka od zavedené
konvence, ne přehlédnutí:

AP-MCE-001 explicitně požaduje, aby Manufacturing Calculation Engine byl
**samostatné, znovupoužitelné výpočetní jádro**, extrahovatelné mimo tenhle
konkrétní produkt beze změny architektury. Kdyby repository třídy žily
rozptýlené ve sdílené `persistence/indexeddb/repositories/` složce spolu s
desítkami dalších (Machine, Tool, Material, RoutingSheet, ...), extrakce by
znamenala hledat a přesouvat soubory podle jména, ne podle adresáře.

Nízkoúrovňové IndexedDB připojení (`openTpvDb`/`tpvGet`/`tpvPut`/...) se ale
NEDUPLIKUJE - druhá kompletní databázová vrstva jen pro tenhle modul by byla
čistá ceremonie bez skutečného přínosu při dnešním rozsahu (jedna appka, jedna
databáze `cnc-tpv`). Tenhle modul proto:

- **sdílí** `persistence/indexeddb/tpv-db.ts` (samotné otevření DB, verzování,
  `tpvGet`/`tpvGetAllByIndex`/`tpvPut`) a `persistence/indexeddb/records/
  calculation-engine-records.ts` (ploché serializovatelné tvary, stejná
  konvence jako zbytek `records/`),
- ale **nesdílí** umístění samotných repository tříd/mapperů - ty jsou tady,
  pohromadě s doménou a use casy tohohle modulu.

Až bude modul skutečně potřeba extrahovat (AP-CPP-006, "budoucí rozšiřitelnost" -
marketplace modulů, OEM distribuce), tahle hranice usnadní přesun: `domain/
calculation-engine/` + `application/calculation-engine/` + `infrastructure/
calculation-engine/` je jeden souvislý strom, jen `records/calculation-engine-
records.ts` v sdílené `persistence/indexeddb/` by šlo zkopírovat/rozdělit.
