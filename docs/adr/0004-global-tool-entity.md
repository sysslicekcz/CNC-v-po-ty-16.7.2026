# 0004 – Tool jako globální entita, ne vlastněná strojem

## Status
Přijato

## Context
Stejný fyzický nástroj (typ VBD inzertu, vrták) se v praxi používá na víc strojích. Bylo potřeba zvolit mezi (a) nástroj jako globální entita s řeznými podmínkami uloženými zvlášť per stroj, nebo (b) nástroj přímo vlastněný strojem.

## Decision
`Tool` je globální entita s vlastním `ToolRepository`. Řezné podmínky pro konkrétní stroj drží samostatná entita `ToolMachineCondition` (toolId + machineId + ...).

## Consequences
- Nástroj se nemusí duplikovat pro každý stroj, který ho může použít.
- Připraveno na budoucí sklad/cenu/evidenci nástrojů (jedna fyzická položka = jeden záznam).
- O trochu složitější dotazování (join přes `ToolMachineCondition`) než varianta (b) – akceptovatelný kompromis.
