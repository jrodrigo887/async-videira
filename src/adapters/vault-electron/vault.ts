import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Vault } from "../../application/ports/index.ts";
import type { Credentials } from "../../domain/types.ts";
import { coded } from "../../domain/shared/errors.ts";

/**
 * Cofre de tokens sobre o `safeStorage` do Electron (DPAPI/Keychain), injetado para manter este módulo
 * livre de `electron`. Guarda `{ holyrics?, videira? }` cifrado em arquivo; nunca devolve nada por IPC.
 */
/** Recorte do `safeStorage` do Electron que o cofre usa. */
export interface SafeStorageLike {
  isAsyncEncryptionAvailable(): Promise<boolean>;
  decryptStringAsync(data: Buffer): Promise<{ result: string; shouldReEncrypt: boolean }>;
  encryptStringAsync(text: string): Promise<Buffer>;
}

export function createVault({ path, safeStorage }: { path: string; safeStorage: SafeStorageLike }): Vault {
  async function read(): Promise<Credentials> {
    try {
      if (!await safeStorage.isAsyncEncryptionAvailable()) return {};
      const decrypted = await safeStorage.decryptStringAsync(await readFile(path));
      const credentials = JSON.parse(decrypted.result) as Credentials;
      if (decrypted.shouldReEncrypt) await write(credentials);
      return credentials;
    } catch { return {}; }
  }

  async function write(credentials: Credentials): Promise<void> {
    if (!await safeStorage.isAsyncEncryptionAvailable()) throw coded("VAULT_UNAVAILABLE", "O cofre seguro do sistema não está disponível.");
    try {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, await safeStorage.encryptStringAsync(JSON.stringify(credentials)));
    } catch { throw coded("VAULT_UNAVAILABLE", "Não foi possível gravar o cofre seguro."); }
  }

  return { read, write };
}
