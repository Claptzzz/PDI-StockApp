/**
 * Mock de Supabase Storage (el otro servicio externo). Guarda los objetos en memoria
 * para poder afirmar sobre ellos: qué se subió, qué se borró.
 */
interface StoredObject {
  path: string;
  contentType: string;
  size: number;
}

class FakeStorage {
  readonly objects = new Map<string, StoredObject>();
  /** Paths borrados, en orden (para verificar el rollback de fotos huérfanas). */
  readonly removed: string[] = [];
  /** Si se activa, el upload falla como lo haría el bucket real. */
  failNextUpload = false;

  reset(): void {
    this.objects.clear();
    this.removed.length = 0;
    this.failNextUpload = false;
  }
}

export const supabaseStorage = new FakeStorage();

function bucketApi() {
  return {
    upload(path: string, body: Buffer, opts?: { contentType?: string }) {
      if (supabaseStorage.failNextUpload) {
        supabaseStorage.failNextUpload = false;
        return Promise.resolve({ data: null, error: { message: 'bucket caído (mock)' } });
      }
      supabaseStorage.objects.set(path, {
        path,
        contentType: opts?.contentType ?? 'application/octet-stream',
        size: body.length,
      });
      return Promise.resolve({ data: { path }, error: null });
    },
    createSignedUrl(path: string, expiresIn: number) {
      if (!supabaseStorage.objects.has(path)) {
        return Promise.resolve({ data: null, error: { message: 'objeto no encontrado (mock)' } });
      }
      return Promise.resolve({
        data: { signedUrl: `http://supabase.test/signed/${path}?exp=${expiresIn}` },
        error: null,
      });
    },
    remove(paths: string[]) {
      for (const path of paths) {
        supabaseStorage.objects.delete(path);
        supabaseStorage.removed.push(path);
      }
      return Promise.resolve({ data: paths.map((path) => ({ path })), error: null });
    },
  };
}

/** Objeto que sustituye al módulo completo en `jest.mock`. */
export const supabaseJsMock = {
  createClient: () => ({ storage: { from: () => bucketApi() } }),
};
