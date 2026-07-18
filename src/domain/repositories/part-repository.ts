import { Part } from "../entities/part";
import { Repository } from "./repository";

export interface PartRepository extends Repository<Part> {
  findByOrderId(orderId: string): Promise<Part[]>;
}
