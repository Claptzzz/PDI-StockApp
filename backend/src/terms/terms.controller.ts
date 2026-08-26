import { Controller, Get } from '@nestjs/common';
import { LOAN_TERMS } from './loan-terms';

/**
 * Condiciones de préstamo. Autenticado (JwtAuthGuard global) pero sin @Roles:
 * cualquier rol puede leerlas.
 */
@Controller('terms')
export class TermsController {
  @Get()
  get() {
    const { version, title, body } = LOAN_TERMS;
    return { version, title, body };
  }
}
