import { ValidationError } from "@/domain/errors/validation-error";
import type { OperationCategory } from "../enums/operation-category";

/**
 * Typický seřizovací čas stroje pro danou kategorii operace (AP-MCE-001
 * Fáze B §3 `typicalSetupTimes`) - výchozí hodnota pro `CalculationBreakdown.
 * setupTime` (Fáze A §03), pokud konkrétní `CalculationRequest` seřizovací
 * čas nezadává explicitně.
 */
export interface MachineSetupTimeProfileProps {
  operationCategory: OperationCategory;
  typicalSetupTimeMinutes: number;
  note?: string;
}

export class MachineSetupTimeProfile {
  private readonly props: Readonly<MachineSetupTimeProfileProps>;

  private constructor(props: MachineSetupTimeProfileProps) {
    this.props = Object.freeze({ ...props });
  }

  static create(props: MachineSetupTimeProfileProps): MachineSetupTimeProfile {
    if (!Number.isFinite(props.typicalSetupTimeMinutes) || props.typicalSetupTimeMinutes < 0) {
      throw new ValidationError(
        `MachineSetupTimeProfile: 'typicalSetupTimeMinutes' nesmí být záporné, dostal jsem "${props.typicalSetupTimeMinutes}".`
      );
    }
    return new MachineSetupTimeProfile(props);
  }

  get operationCategory(): OperationCategory {
    return this.props.operationCategory;
  }
  get typicalSetupTimeMinutes(): number {
    return this.props.typicalSetupTimeMinutes;
  }
  get note(): string | undefined {
    return this.props.note;
  }

  toJSON(): MachineSetupTimeProfileProps {
    return { ...this.props };
  }

  static fromJSON(json: MachineSetupTimeProfileProps): MachineSetupTimeProfile {
    return MachineSetupTimeProfile.create(json);
  }
}
