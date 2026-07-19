import { Customer } from "@/domain/entities/customer";
import { ContactPerson } from "@/domain/entities/contact-person";
import { Ico } from "@/domain/value-objects/ico";
import { Dic } from "@/domain/value-objects/dic";
import { Email } from "@/domain/value-objects/email";
import { CustomerRecord, ContactPersonRecord } from "../records";
import { LegacyStamp, addressToRecord, addressFromRecord, parseEntityStav } from "./common";

function contactToRecord(contact: ContactPerson): ContactPersonRecord {
  return {
    id: contact.id,
    jmeno: contact.jmeno,
    pozice: contact.pozice,
    telefon: contact.telefon,
    email: contact.email?.toString(),
    poznamka: contact.poznamka,
  };
}

function contactFromRecord(record: ContactPersonRecord): ContactPerson {
  return ContactPerson.create({
    id: record.id,
    jmeno: record.jmeno,
    pozice: record.pozice,
    telefon: record.telefon,
    email: record.email ? Email.of(record.email) : undefined,
    poznamka: record.poznamka,
  });
}

export function customerToRecord(customer: Customer, legacy: LegacyStamp = {}): CustomerRecord {
  return {
    id: customer.id,
    nazev: customer.nazev,
    stav: customer.stav,
    ico: customer.ico?.toString(),
    dic: customer.dic?.toString(),
    fakturacniAdresa: addressToRecord(customer.fakturacniAdresa),
    dodaciAdresa: addressToRecord(customer.dodaciAdresa),
    telefon: customer.telefon,
    email: customer.email?.toString(),
    poznamka: customer.poznamka,
    contacts: customer.contacts.map(contactToRecord),
    ...legacy,
  };
}

export function customerFromRecord(record: CustomerRecord): Customer {
  return Customer.restore(
    {
      id: record.id,
      nazev: record.nazev,
      stav: parseEntityStav(record.stav, "Customer"),
      ico: record.ico ? Ico.of(record.ico) : undefined,
      dic: record.dic ? Dic.of(record.dic) : undefined,
      fakturacniAdresa: addressFromRecord(record.fakturacniAdresa),
      dodaciAdresa: addressFromRecord(record.dodaciAdresa),
      telefon: record.telefon,
      email: record.email ? Email.of(record.email) : undefined,
      poznamka: record.poznamka,
    },
    record.contacts.map(contactFromRecord)
  );
}
