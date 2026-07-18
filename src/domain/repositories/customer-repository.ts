import { Customer } from "../entities/customer";
import { Ico } from "../value-objects/ico";
import { Repository } from "./repository";

export interface CustomerRepository extends Repository<Customer> {
  findByIco(ico: Ico): Promise<Customer | null>;
  search(query: string): Promise<Customer[]>;
}
