/**
 * Úroveň závažnosti jednoho `ValidationIssue`/warningu ve výsledku výpočtu
 * (AP-MCE-001 §18). `error` blokuje vznik výsledku, `warning` výsledek
 * propustí, ale sníží `confidenceScore` a označí ho, `information` je čistě
 * vysvětlující, `recommendation` je volitelná a nikdy nic neblokuje.
 */
export type CalculationSeverity = "error" | "warning" | "information" | "recommendation";
