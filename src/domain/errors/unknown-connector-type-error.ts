import { DomainError } from "./domain-error";

/** `ErpConnectorRegistry.get()` byl zavolán pro `connectorType`, který nikdy
 *  nebyl zaregistrovaný (typicky konektor pro daný ERP ještě není nasazený
 *  nebo appka běží bez příslušného integračního modulu). */
export class UnknownConnectorTypeError extends DomainError {
  constructor(readonly connectorType: string) {
    super(`Konektor typu "${connectorType}" není zaregistrovaný.`);
  }
}
