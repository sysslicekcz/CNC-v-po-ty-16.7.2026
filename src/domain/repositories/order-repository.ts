import { Order } from "../entities/order";
import { Repository } from "./repository";

export interface OrderRepository extends Repository<Order> {
  findByCustomerId(customerId: string): Promise<Order[]>;
}
