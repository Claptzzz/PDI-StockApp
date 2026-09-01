import { INestApplication } from '@nestjs/common';
import { Course, Group, User } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, resetDb } from './support/app';
import { as } from './support/auth';
import {
  availableInDb,
  createAdmin,
  createComponent,
  createCourse,
  createGroup,
  createKit,
  createStudent,
  createTemplate,
  uniqueSuffix,
} from './support/fixtures';

/**
 * El stock disponible NO se guarda: se calcula como
 *   available = totalStock − comprometido en kits ASSIGNED − comprometido en préstamos.
 * Cada test comprueba el número que devuelve la API y, además, lo recalcula leyendo
 * la base, para detectar contadores desincronizados si alguien los introdujera.
 */
describe('Disponibilidad de componentes', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: User;
  let curso: Course;
  let grupo: Group;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
    admin = await createAdmin(prisma);
    curso = await createCourse(prisma);
    grupo = await createGroup(prisma, curso, { members: [await createStudent(prisma)] });
  });

  const disponible = async (componentId: string): Promise<number> => {
    const res = await as(app, admin).get(`/api/components/${componentId}`).expect(200);
    // La API y el recálculo directo sobre la base deben coincidir siempre.
    expect(res.body.available).toBe(await availableInDb(prisma, componentId));
    return res.body.available;
  };

  describe('compromiso por kits', () => {
    it('asignar un kit descuenta las unidades de la disponibilidad', async () => {
      const componente = await createComponent(prisma, { totalStock: 10 });
      expect(await disponible(componente.id)).toBe(10);

      await as(app, admin)
        .post(`/api/courses/${curso.id}/groups/${grupo.id}/kits`)
        .send({ code: 'K1', items: [{ componentId: componente.id, quantity: 4 }] })
        .expect(201);

      expect(await disponible(componente.id)).toBe(6);
      // El totalStock NO se toca: el compromiso es derivado.
      const enDb = await prisma.component.findUniqueOrThrow({ where: { id: componente.id } });
      expect(enDb.totalStock).toBe(10);
    });

    it('borrar el kit devuelve las unidades a la disponibilidad', async () => {
      const componente = await createComponent(prisma, { totalStock: 10 });
      const kit = await createKit(prisma, curso, grupo, {
        items: [{ component: componente, quantity: 4 }],
      });
      expect(await disponible(componente.id)).toBe(6);

      await as(app, admin)
        .delete(`/api/courses/${curso.id}/groups/${grupo.id}/kits/${kit.id}`)
        .expect(200);

      expect(await disponible(componente.id)).toBe(10);
      expect(await prisma.kitItem.count({ where: { kitId: kit.id } })).toBe(0);
    });

    it('un kit ya devuelto deja de comprometer stock', async () => {
      const componente = await createComponent(prisma, { totalStock: 10 });
      const kit = await createKit(prisma, curso, grupo, {
        items: [{ component: componente, quantity: 4 }],
      });

      await as(app, admin)
        .patch(
          `/api/courses/${curso.id}/groups/${grupo.id}/kits/${kit.id}/items/${kit.items[0].id}/return`,
        )
        .send({ quantity: 4 })
        .expect(200);

      expect(await disponible(componente.id)).toBe(10);
    });

    it('una devolución parcial libera solo lo devuelto', async () => {
      const componente = await createComponent(prisma, { totalStock: 10 });
      const kit = await createKit(prisma, curso, grupo, {
        items: [{ component: componente, quantity: 4 }],
      });

      await as(app, admin)
        .patch(
          `/api/courses/${curso.id}/groups/${grupo.id}/kits/${kit.id}/items/${kit.items[0].id}/return`,
        )
        .send({ quantity: 1 })
        .expect(200);

      expect(await disponible(componente.id)).toBe(7);
    });
  });

  describe('barrera de stock al asignar', () => {
    it('no se puede asignar un kit que pide más de lo disponible', async () => {
      const componente = await createComponent(prisma, { name: 'Servo', totalStock: 3 });

      const res = await as(app, admin)
        .post(`/api/courses/${curso.id}/groups/${grupo.id}/kits`)
        .send({ code: 'K-EXCESO', items: [{ componentId: componente.id, quantity: 5 }] })
        .expect(400);

      expect(res.body.shortages).toEqual([
        { componentId: componente.id, name: 'Servo', requested: 5, available: 3 },
      ]);
      // Nada a medias: ni kit ni ítems.
      expect(await prisma.kit.count()).toBe(0);
      expect(await prisma.kitItem.count()).toBe(0);
    });

    it('el faltante se calcula contra lo DISPONIBLE, no contra el stock total', async () => {
      const componente = await createComponent(prisma, { name: 'LED', totalStock: 10 });
      await createKit(prisma, curso, grupo, { items: [{ component: componente, quantity: 8 }] });

      const res = await as(app, admin)
        .post(`/api/courses/${curso.id}/groups/${grupo.id}/kits`)
        .send({ code: 'K-SEGUNDO', items: [{ componentId: componente.id, quantity: 5 }] })
        .expect(400);

      expect(res.body.shortages[0]).toMatchObject({ requested: 5, available: 2 });
    });

    it('el reporte de faltantes lista todos los componentes que no alcanzan', async () => {
      const a = await createComponent(prisma, { name: 'Resistencia', totalStock: 1 });
      const b = await createComponent(prisma, { name: 'Protoboard', totalStock: 1 });
      const c = await createComponent(prisma, { name: 'Jumper', totalStock: 100 });

      const res = await as(app, admin)
        .post(`/api/courses/${curso.id}/groups/${grupo.id}/kits`)
        .send({
          code: 'K-MULTI',
          items: [
            { componentId: a.id, quantity: 2 },
            { componentId: b.id, quantity: 2 },
            { componentId: c.id, quantity: 2 },
          ],
        })
        .expect(400);

      expect(res.body.shortages.map((s: { name: string }) => s.name).sort()).toEqual([
        'Protoboard',
        'Resistencia',
      ]);
    });

    it('la barrera también aplica al asignar desde una plantilla', async () => {
      const componente = await createComponent(prisma, { totalStock: 2 });
      const plantilla = await createTemplate(prisma, [{ component: componente, quantity: 3 }]);

      await as(app, admin)
        .post(`/api/courses/${curso.id}/groups/${grupo.id}/kits`)
        .send({ code: 'K-PLANTILLA', templateId: plantilla.id })
        .expect(400);

      expect(await prisma.kit.count()).toBe(0);
    });
  });

  describe('edición del stock total', () => {
    it('no se puede bajar el totalStock por debajo de lo ya comprometido', async () => {
      const componente = await createComponent(prisma, { totalStock: 10 });
      await createKit(prisma, curso, grupo, { items: [{ component: componente, quantity: 7 }] });

      const res = await as(app, admin)
        .patch(`/api/components/${componente.id}`)
        .send({ totalStock: 5 })
        .expect(400);

      expect(res.body.message).toContain('7 unidades comprometidas');
      const enDb = await prisma.component.findUniqueOrThrow({ where: { id: componente.id } });
      expect(enDb.totalStock).toBe(10);
    });

    it('bajarlo exactamente hasta lo comprometido sí se permite (disponible queda en 0)', async () => {
      const componente = await createComponent(prisma, { totalStock: 10 });
      await createKit(prisma, curso, grupo, { items: [{ component: componente, quantity: 7 }] });

      await as(app, admin)
        .patch(`/api/components/${componente.id}`)
        .send({ totalStock: 7 })
        .expect(200);

      expect(await disponible(componente.id)).toBe(0);
    });

    it('los préstamos vigentes también cuentan como compromiso', async () => {
      const componente = await createComponent(prisma, { totalStock: 10 });
      await as(app, admin)
        .post(`/api/courses/${curso.id}/groups/${grupo.id}/loans`)
        .send({ componentId: componente.id, quantity: 6 })
        .expect(201);

      await as(app, admin)
        .patch(`/api/components/${componente.id}`)
        .send({ totalStock: 4 })
        .expect(400);
      expect(await disponible(componente.id)).toBe(4);
    });
  });

  describe('préstamos sueltos', () => {
    it('un préstamo con componente del catálogo descuenta disponibilidad', async () => {
      const componente = await createComponent(prisma, { totalStock: 10 });

      await as(app, admin)
        .post(`/api/courses/${curso.id}/groups/${grupo.id}/loans`)
        .send({ componentId: componente.id, quantity: 3 })
        .expect(201);

      expect(await disponible(componente.id)).toBe(7);
      const prestamo = await prisma.loan.findFirstOrThrow();
      // El nombre se deriva del catálogo si no se envía.
      expect(prestamo.componentName).toBe(componente.name);
      expect(prestamo.componentId).toBe(componente.id);
    });

    it('un préstamo con componente del catálogo no puede exceder lo disponible', async () => {
      const componente = await createComponent(prisma, { name: 'Motor', totalStock: 2 });

      const res = await as(app, admin)
        .post(`/api/courses/${curso.id}/groups/${grupo.id}/loans`)
        .send({ componentId: componente.id, quantity: 5 })
        .expect(400);

      expect(res.body.shortage).toMatchObject({ name: 'Motor', requested: 5, available: 2 });
      expect(await prisma.loan.count()).toBe(0);
    });

    it('un préstamo de texto libre no valida stock porque no sale de bodega', async () => {
      const nombre = `Cable improvisado ${uniqueSuffix()}`;

      await as(app, admin)
        .post(`/api/courses/${curso.id}/groups/${grupo.id}/loans`)
        .send({ componentName: nombre, quantity: 999 })
        .expect(201);

      const prestamo = await prisma.loan.findFirstOrThrow({ where: { componentName: nombre } });
      expect(prestamo.componentId).toBeNull();
      expect(prestamo.quantity).toBe(999);
    });

    it('un préstamo apuntando a un componente inexistente se rechaza', async () => {
      await as(app, admin)
        .post(`/api/courses/${curso.id}/groups/${grupo.id}/loans`)
        .send({ componentId: 'no-existe', componentName: 'X', quantity: 1 })
        .expect(400);
    });

    it('devolver el préstamo libera la disponibilidad', async () => {
      const componente = await createComponent(prisma, { totalStock: 10 });
      const res = await as(app, admin)
        .post(`/api/courses/${curso.id}/groups/${grupo.id}/loans`)
        .send({ componentId: componente.id, quantity: 3 })
        .expect(201);

      await as(app, admin)
        .patch(`/api/courses/${curso.id}/groups/${grupo.id}/loans/${res.body.id}/return`)
        .send({ quantity: 3 })
        .expect(200);

      expect(await disponible(componente.id)).toBe(10);
    });
  });

  describe('listado del catálogo', () => {
    it('el listado expone la disponibilidad ya descontada', async () => {
      const componente = await createComponent(prisma, { totalStock: 12 });
      await createKit(prisma, curso, grupo, { items: [{ component: componente, quantity: 5 }] });

      const res = await as(app, admin).get('/api/components').expect(200);
      const fila = res.body.find((c: { id: string }) => c.id === componente.id);

      expect(fila).toMatchObject({ totalStock: 12, available: 7 });
    });
  });
});
