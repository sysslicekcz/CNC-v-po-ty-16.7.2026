import { ValidationError } from "../errors/validation-error";
import { NotFoundError } from "../errors/not-found-error";
import { SortKey } from "../value-objects/sort-key";
import { Activity, NewActivityInput } from "./activity";

export interface PositionProps {
  id: string;
  operationId: string;
  nazev: string;
}

export interface NewPositionInput {
  id: string;
  nazev: string;
}

/** Jedno fyzické upnutí dílu v rámci Operation - sdružuje technologické činnosti
 *  (Activity) provedené v tomto upnutí. Vnitřní entita agregátu RoutingSheet. */
export class Position {
  private activities: Activity[] = [];

  private constructor(private props: PositionProps) {}

  static create(props: PositionProps): Position {
    if (!props.nazev.trim()) throw new ValidationError("Position: 'nazev' nesmí být prázdný.");
    return new Position({ ...props });
  }

  static restore(props: PositionProps, activities: Activity[]): Position {
    const position = new Position({ ...props });
    position.activities = [...activities];
    return position;
  }

  get id(): string {
    return this.props.id;
  }
  get operationId(): string {
    return this.props.operationId;
  }
  get nazev(): string {
    return this.props.nazev;
  }

  /** Seřazené podle sortKey. */
  get activityList(): readonly Activity[] {
    return [...this.activities].sort((a, b) => a.sortKey.compareTo(b.sortKey));
  }

  getActivity(activityId: string): Activity {
    const activity = this.activities.find((a) => a.id === activityId);
    if (!activity) throw new NotFoundError("Activity", activityId);
    return activity;
  }

  addActivity(input: NewActivityInput): Activity {
    const sorted = this.activityList;
    const lastKey = sorted.length ? sorted[sorted.length - 1].sortKey : null;
    const activity = Activity.create({
      id: input.id,
      positionId: this.props.id,
      operationTypeId: input.operationTypeId,
      calculationType: input.calculationType,
      sortKey: SortKey.between(lastKey, null),
      toolId: input.toolId,
      technologickaPoznamka: input.technologickaPoznamka,
      stav: "aktivni",
    });
    this.activities.push(activity);
    return activity;
  }

  /** Přesune existující Activity za `afterActivityId` (null = na začátek) - mění
   *  sortKey jen přesouvané položky, ostatní zůstávají beze změny. */
  moveActivity(activityId: string, afterActivityId: string | null): void {
    const sorted = this.activityList;
    const moving = sorted.find((a) => a.id === activityId);
    if (!moving) throw new NotFoundError("Activity", activityId);
    const rest = sorted.filter((a) => a.id !== activityId);
    const afterIndex = afterActivityId ? rest.findIndex((a) => a.id === afterActivityId) : -1;
    if (afterActivityId && afterIndex === -1) throw new NotFoundError("Activity", afterActivityId);
    const prev = afterIndex >= 0 ? rest[afterIndex] : null;
    const next = afterIndex >= 0 ? (rest[afterIndex + 1] ?? null) : (rest[0] ?? null);
    moving.setSortKey(SortKey.between(prev?.sortKey ?? null, next?.sortKey ?? null));
  }

  removeActivity(activityId: string): void {
    if (!this.activities.some((a) => a.id === activityId)) {
      throw new NotFoundError("Activity", activityId);
    }
    this.activities = this.activities.filter((a) => a.id !== activityId);
  }
}
