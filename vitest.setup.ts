// Node nemá nativní IndexedDB - fake-indexeddb/auto zaregistruje polyfill do
// globálního scope, aby šly repository testy nad IndexedDB spouštět bez prohlížeče.
// Dev-only závislost, žádný dopad na produkční build.
import "fake-indexeddb/auto";
