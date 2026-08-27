-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "termsDocumentId" TEXT;

-- CreateTable
CREATE TABLE "TermsDocument" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TermsDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermsVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "TermsVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TermsVersion_documentId_publishedAt_idx" ON "TermsVersion"("documentId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TermsVersion_documentId_version_key" ON "TermsVersion"("documentId", "version");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_termsDocumentId_fkey" FOREIGN KEY ("termsDocumentId") REFERENCES "TermsDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermsVersion" ADD CONSTRAINT "TermsVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "TermsDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermsVersion" ADD CONSTRAINT "TermsVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Siembra del documento POR DEFECTO a partir del texto que hasta ahora vivía
-- hardcodeado en src/terms/loan-terms.ts. Sin esto, tras la migración no habría
-- ninguna versión vigente y las aceptaciones fallarían.
--
-- Idempotente: no hace nada si ya existe un documento por defecto.
-- Si la base aún no tiene usuarios (instalación limpia), se omite: `createdById`
-- es obligatorio y el primer admin creará el documento desde /admin/documentos.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  doc_id TEXT := 'seed_terms_default';
  ver_id TEXT := 'seed_terms_default_v1';
  author TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM "TermsDocument" WHERE "isDefault") THEN
    RETURN;
  END IF;

  SELECT id INTO author FROM "User"
    WHERE 'ADMIN' = ANY(roles) AND "isActive" ORDER BY "createdAt" LIMIT 1;
  IF author IS NULL THEN
    SELECT id INTO author FROM "User" ORDER BY "createdAt" LIMIT 1;
  END IF;
  IF author IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO "TermsDocument" (id, name, "isDefault", "createdAt")
  VALUES (doc_id, 'Condiciones de préstamo (por defecto)', true, now());

  INSERT INTO "TermsVersion"
    (id, "documentId", version, title, body, "publishedAt", "createdAt", "createdById")
  VALUES (ver_id, doc_id, '1.0', 'Condiciones de préstamo del kit', '[TEXTO PROVISORIO — PENDIENTE DE REDACCIÓN OFICIAL]

Este texto es un marcador de posición para que el sistema funcione. Debe ser reemplazado por la redacción definitiva antes de usarse con estudiantes reales.

1. CUIDADO DE LOS COMPONENTES
El estudiante se compromete a usar los componentes del kit únicamente con fines académicos y a mantenerlos en buen estado durante todo el período de préstamo, siguiendo las indicaciones del profesor y del personal de bodega.

2. RESPONSABILIDAD POR PÉRDIDA O DAÑO
El grupo es responsable de los componentes recibidos desde el momento de la entrega. La pérdida, extravío o daño de un componente durante el período de préstamo es responsabilidad del grupo, salvo que la discrepancia haya sido registrada en la verificación de entrega.

3. OBLIGACIÓN DE REPONER
Ante la pérdida o el daño irreparable de un componente, el grupo deberá reponerlo por una unidad equivalente (misma referencia o superior), en el plazo que indique el docente a cargo.

4. DEVOLUCIÓN AL FINAL DEL SEMESTRE
El kit completo debe devolverse en bodega al término del semestre, en la fecha que se comunique oportunamente. La no devolución puede afectar el cierre administrativo del curso.

Al aceptar, declaro haber leído y comprendido estas condiciones.

[FIN DEL TEXTO PROVISORIO]', now(), now(), author);
END
$$;
