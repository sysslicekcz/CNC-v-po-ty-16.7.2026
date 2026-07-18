import { ValidationError } from "../errors/validation-error";
import { FeatureCode } from "./feature-code";
import { FeatureAccess } from "./feature-access";
import { LicenseLimitCode } from "./license-limit-code";

export type LicenseStatus = "trial" | "active" | "expired" | "suspended" | "cancelled";

export interface LicensedFeature {
  code: FeatureCode;
  access: FeatureAccess;
}

export interface LicenseLimit {
  code: LicenseLimitCode;
  value: number;
}

/** Připraveno pro budoucí vzdálené ověřování (Krok 3.5, bod 28) - v lokální
 *  verzi se nepoužívá aktivně, jen rezervuje tvar dat. Délka grace period se
 *  nikde v doméně nezapisuje natvrdo - je to jen datum uložené na licenci. */
export interface LicenseValidationState {
  status: "valid" | "grace_period" | "expired" | "unverified" | "suspended";
  lastValidatedAt?: string;
  nextValidationAt?: string;
  gracePeriodUntil?: string;
}

export interface LicenseProps {
  id: string;
  tenantId: string;
  planCode: string;
  status: LicenseStatus;
  validFrom: string;
  validUntil?: string;
  features: LicensedFeature[];
  limits: LicenseLimit[];
  issuedAt: string;
  updatedAt?: string;
  validation?: LicenseValidationState;
}

/**
 * Licence organizace (Krok 3.5, bod 22) - určuje CO organizace smí používat.
 * Zdroj pravdy je vždy `status` + platnost + `features` + `limits`, nikdy
 * `planCode` sám o sobě (viz docs/adr/0020 - "if (planCode === 'enterprise')"
 * je záměrně zakázaný vzor).
 */
export class License {
  private constructor(private readonly props: LicenseProps) {}

  static create(props: LicenseProps): License {
    if (!props.tenantId.trim()) throw new ValidationError("License: 'tenantId' nesmí být prázdné.");
    if (!props.planCode.trim()) throw new ValidationError("License: 'planCode' nesmí být prázdný.");
    return new License({ ...props, features: [...props.features], limits: [...props.limits] });
  }

  static restore(props: LicenseProps): License {
    return License.create(props);
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get planCode(): string {
    return this.props.planCode;
  }
  get status(): LicenseStatus {
    return this.props.status;
  }
  get validFrom(): string {
    return this.props.validFrom;
  }
  get validUntil(): string | undefined {
    return this.props.validUntil;
  }
  get features(): readonly LicensedFeature[] {
    return this.props.features;
  }
  get limits(): readonly LicenseLimit[] {
    return this.props.limits;
  }
  get issuedAt(): string {
    return this.props.issuedAt;
  }
  get updatedAt(): string | undefined {
    return this.props.updatedAt;
  }
  get validation(): LicenseValidationState | undefined {
    return this.props.validation;
  }

  /** `undefined` = funkce v licenci vůbec není uvedená ("none" by naopak
   *  znamenalo, že o ní licence explicitně ví, ale nepovoluje ji). */
  getFeatureAccess(feature: FeatureCode): FeatureAccess | undefined {
    return this.props.features.find((f) => f.code === feature)?.access;
  }

  getLimit(limitCode: LicenseLimitCode): number | undefined {
    return this.props.limits.find((l) => l.code === limitCode)?.value;
  }

  /** Platnost k danému okamžiku podle `validFrom`/`validUntil` - nezohledňuje
   *  `status` (to řeší FeatureAccessService samostatně, aby šly rozlišit různé
   *  důvody odepření - expirace vs. suspend vs. mimo platnost). */
  isWithinValidityPeriod(now: Date): boolean {
    const nowMs = now.getTime();
    if (new Date(this.props.validFrom).getTime() > nowMs) return false;
    if (this.props.validUntil && new Date(this.props.validUntil).getTime() < nowMs) return false;
    return true;
  }
}
