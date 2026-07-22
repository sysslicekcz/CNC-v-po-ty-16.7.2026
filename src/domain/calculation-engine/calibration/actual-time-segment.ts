import { ValidationError } from "@/domain/errors/validation-error";
import type { ActualTimeSegmentType, ActualTimeSourceType } from "./actual-time-enums";

export interface ActualTimeSegmentProps {
  id: string;
  actualTimeRecordId: string;
  segmentType: ActualTimeSegmentType;
  startedAt: string;
  finishedAt: string;
  durationMin: number;
  machineId?: string;
  employeeId?: string;
  reasonCode?: string;
  source: ActualTimeSourceType;
  sourceEventIds: readonly string[];
  /** §3 "Musí být možné evidovat překryv" - `true` znamená "tenhle segment
   *  SMÍ se s jiným časově překrývat" (typicky `machine_cycle`/
   *  `operator_attendance` páry) - `TimeOverlapResolver` (§4) tohle pole čte
   *  PŘED tím, než překryv označí za problém. */
  overlapsAllowed: boolean;
  notes?: string;
}

/**
 * `ActualTimeSegment` (AP-MCE-001 Fáze G §3) - JEDEN časový úsek uvnitř
 * `ActualTimeRecord`. Jedna operace může mít VÍC segmentů (§3 "jedna operace
 * může obsahovat více časových úseků") - `TimeOverlapResolver` (§4) je
 * skládá dohromady PODLE ČASOVÉ OSY, nikdy prostým součtem `durationMin`
 * (§3 "Nepočítej automaticky všechny segmenty prostým součtem").
 */
export class ActualTimeSegment {
  private readonly props: Readonly<ActualTimeSegmentProps>;

  private constructor(props: ActualTimeSegmentProps) {
    this.props = Object.freeze({ ...props, sourceEventIds: Object.freeze([...props.sourceEventIds]) });
  }

  static create(props: ActualTimeSegmentProps): ActualTimeSegment {
    if (!props.id.trim()) throw new ValidationError("ActualTimeSegment: 'id' nesmí být prázdné.");
    if (!props.actualTimeRecordId.trim()) throw new ValidationError("ActualTimeSegment: 'actualTimeRecordId' nesmí být prázdné.");
    if (props.startedAt > props.finishedAt) {
      throw new ValidationError(`ActualTimeSegment "${props.id}": 'startedAt' nesmí být po 'finishedAt'.`);
    }
    if (!Number.isFinite(props.durationMin) || props.durationMin < 0) {
      throw new ValidationError(`ActualTimeSegment "${props.id}": 'durationMin' nesmí být záporné, dostal jsem "${props.durationMin}".`);
    }
    return new ActualTimeSegment(props);
  }

  get id(): string {
    return this.props.id;
  }
  get actualTimeRecordId(): string {
    return this.props.actualTimeRecordId;
  }
  get segmentType(): ActualTimeSegmentType {
    return this.props.segmentType;
  }
  get startedAt(): string {
    return this.props.startedAt;
  }
  get finishedAt(): string {
    return this.props.finishedAt;
  }
  get durationMin(): number {
    return this.props.durationMin;
  }
  get machineId(): string | undefined {
    return this.props.machineId;
  }
  get employeeId(): string | undefined {
    return this.props.employeeId;
  }
  get reasonCode(): string | undefined {
    return this.props.reasonCode;
  }
  get source(): ActualTimeSourceType {
    return this.props.source;
  }
  get sourceEventIds(): readonly string[] {
    return this.props.sourceEventIds;
  }
  get overlapsAllowed(): boolean {
    return this.props.overlapsAllowed;
  }
  get notes(): string | undefined {
    return this.props.notes;
  }

  toPlainObject(): Record<string, unknown> {
    return { ...this.props, sourceEventIds: [...this.props.sourceEventIds] };
  }
}
