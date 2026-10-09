export interface SecretStore {
  put(input: { value: string; namespace: string }): Promise<{ reference: string }>;
  get(reference: string): Promise<string>;
  revoke(reference: string): Promise<void>;
}

/** Sólo para desarrollo: nunca persiste secretos ni los expone al navegador. */
export class InMemorySecretStore implements SecretStore {
  private readonly values = new Map<string, string>();
  async put(input: { value: string; namespace: string }) {
    const reference = `dev://${input.namespace}/${crypto.randomUUID()}`;
    this.values.set(reference, input.value);
    return { reference };
  }
  async get(reference: string) {
    const value = this.values.get(reference);
    if (!value) throw new Error("Secreto inexistente o revocado.");
    return value;
  }
  async revoke(reference: string) { this.values.delete(reference); }
}
