/**
 * Fuente única de verdad del texto de las condiciones de préstamo.
 *
 * ⚠️ IMPORTANTE — VERSIONADO
 * `version` se guarda en cada KitAcceptance (columna `termsVersion`) para dejar
 * registro de QUÉ texto aceptó cada estudiante. Por eso:
 *
 *   Cualquier cambio de contenido en `title` o `body` OBLIGA a subir `version`.
 *
 * Si cambias el texto sin subir la versión, las aceptaciones anteriores quedarían
 * apuntando a un texto que ya no es el que se leyó. El backend además rechaza
 * (409) las aceptaciones que lleguen con una versión distinta a la vigente.
 */
export interface LoanTerms {
  version: string;
  updatedAt: string;
  title: string;
  body: string;
}

export const LOAN_TERMS: LoanTerms = {
  version: '1.0',
  updatedAt: '2026-08-26',
  title: 'Condiciones de préstamo del kit',

  // ==========================================================================
  // 🚧 TEXTO PLACEHOLDER — PENDIENTE DE REDACCIÓN 🚧
  //
  // Este NO es el texto definitivo. Es un borrador de trabajo que cubre los
  // cuatro puntos acordados para que el flujo sea funcional de punta a punta.
  // Debe reemplazarlo la persona responsable del curso/bodega y, al hacerlo,
  // SUBIR `version` (p. ej. a '1.1' o '2.0') y actualizar `updatedAt`.
  // ==========================================================================
  // NOTA DE FORMATO: la UI renderiza este texto con `whitespace-pre-wrap`, así que
  // los saltos de línea se respetan tal cual. NO cortes los párrafos a mano: deja
  // cada párrafo en una sola línea larga y separa con línea en blanco, o en móvil
  // el texto se ve con cortes arbitrarios.
  body: `[TEXTO PROVISORIO — PENDIENTE DE REDACCIÓN OFICIAL]

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

[FIN DEL TEXTO PROVISORIO]`,
};
