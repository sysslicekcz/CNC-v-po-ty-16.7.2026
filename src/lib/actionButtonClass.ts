/** Sjednocené akční tlačítko (přidat/krok zpět/smazat vše/tisk/přidat polohu...)
 *  - stejný styl a zarovnání vlevo napříč appkou (operace, nástroje, stroje,
 *  polohy, výstupy). */
export function actionButtonClass(disabled = false): string {
  return (
    "rounded-md border px-3 py-1.5 text-sm transition " +
    (disabled
      ? "cursor-not-allowed border-border/50 text-muted/50"
      : "border-border text-foreground hover:border-accent hover:text-accent")
  );
}
