"use client";

export interface FeatureUnavailableNoticeProps {
  message?: string;
}

/** Výchozí obsah pro `FeatureGate`'s `fallback` prop - jen srozumitelné
 *  oznámení, žádná logika. Volající si může dát vlastní `fallback`, tohle je
 *  pohodlný výchozí text. */
export function FeatureUnavailableNotice({ message }: FeatureUnavailableNoticeProps) {
  return <p role="status">{message ?? "Tato funkce není součástí vaší licence."}</p>;
}
