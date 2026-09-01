import { INestApplication } from '@nestjs/common';
import { Course, Group, User } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, resetDb } from './support/app';
import { as } from './support/auth';
import {
  createAdmin,
  createComponent,
  createCourse,
  createDefaultTerms,
  createGroup,
  createKit,
  createStudent,
  uniqueSuffix,
} from './support/fixtures';

/**
 * Resolución de las discrepancias que reporta el alumno al verificar el kit.
 * Cada acción se comprueba por su EFECTO en la base (cantidad del ítem, `verified`,
 * `totalStock` del componente), no solo por el status HTTP.
 */
describe('Resolución de discrepancias', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: User;
  let alumno: User;
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
    alumno = await createStudent(prisma);
    curso = await createCourse(prisma);
    grupo = await createGroup(prisma, curso, { members: [alumno] });
    // La pantalla del alumno resuelve las condiciones vigentes al cargar el kit.
    await createDefaultTerms(prisma, admin);
  });

  /**
   * Kit ya verificado por el alumno con UN ítem en discrepancia
   * (`verified: false` + nota), que es la precondición del flujo.
   */
  const kitConDiscrepancia = async (
    opciones: { totalStock?: number; quantity?: number; returned?: number } = {},
  ) => {
    const componente = await createComponent(prisma, {
      name: `Servo ${uniqueSuffix()}`,
      totalStock: opciones.totalStock ?? 20,
    });
    const kit = await createKit(prisma, curso, grupo, {
      verifiedBy: alumno,
      items: [
        {
          component: componente,
          quantity: opciones.quantity ?? 5,
          returned: opciones.returned ?? 0,
          verified: false,
          verificationNote: 'Faltaron 2 unidades',
        },
      ],
    });
    return { componente, kit, item: kit.items[0] };
  };

  const resolver = (kitId: string, itemId: string, body: object) =>
    as(app, admin)
      .post(`/api/courses/${curso.id}/groups/${grupo.id}/kits/${kitId}/items/${itemId}/resolve`)
      .send(body);

  describe('ACKNOWLEDGED: solo deja constancia', () => {
    it('no cambia la cantidad del kit, ni el conforme, ni el stock', async () => {
      const { componente, kit, item } = await kitConDiscrepancia();

      await resolver(kit.id, item.id, {
        action: 'ACKNOWLEDGED',
        quantity: 2,
        note: 'Se conversó con el grupo, sin cargo',
      }).expect(201);

      const enDb = await prisma.kitItem.findUniqueOrThrow({ where: { id: item.id } });
      expect(enDb).toMatchObject({ quantity: 5, verified: false });
      const stock = await prisma.component.findUniqueOrThrow({ where: { id: componente.id } });
      expect(stock.totalStock).toBe(20);
    });

    it('registra la resolución con su autor y su justificación', async () => {
      const { kit, item } = await kitConDiscrepancia();

      await resolver(kit.id, item.id, {
        action: 'ACKNOWLEDGED',
        quantity: 1,
        note: 'Queda registrado',
      }).expect(201);

      const resolucion = await prisma.discrepancyResolution.findFirstOrThrow({
        where: { kitItemId: item.id },
      });
      expect(resolucion).toMatchObject({
        action: 'ACKNOWLEDGED',
        quantity: 1,
        note: 'Queda registrado',
        resolvedById: admin.id,
      });
    });
  });

  describe('REPLACED: se repone el componente', () => {
    it('deja el ítem conforme y mantiene la cantidad exigida', async () => {
      const { componente, kit, item } = await kitConDiscrepancia();

      const res = await resolver(kit.id, item.id, {
        action: 'REPLACED',
        quantity: 2,
        note: 'Se entregaron 2 servos de repuesto',
      }).expect(201);

      expect(res.body.items[0]).toMatchObject({ verified: true, quantity: 5 });
      const enDb = await prisma.kitItem.findUniqueOrThrow({ where: { id: item.id } });
      expect(enDb.verified).toBe(true);
      expect(enDb.quantity).toBe(5);
      // Reponer no da de baja inventario.
      const stock = await prisma.component.findUniqueOrThrow({ where: { id: componente.id } });
      expect(stock.totalStock).toBe(20);
    });
  });

  describe('DEDUCTED: se reduce lo exigido al grupo', () => {
    it('baja la cantidad del ítem sin tocar el inventario', async () => {
      const { componente, kit, item } = await kitConDiscrepancia({ quantity: 5 });

      await resolver(kit.id, item.id, {
        action: 'DEDUCTED',
        quantity: 2,
        note: 'No se repone: se les exigirán 3',
      }).expect(201);

      const enDb = await prisma.kitItem.findUniqueOrThrow({ where: { id: item.id } });
      expect(enDb.quantity).toBe(3);
      const stock = await prisma.component.findUniqueOrThrow({ where: { id: componente.id } });
      expect(stock.totalStock).toBe(20);
    });

    it('libera el compromiso de stock, porque la disponibilidad es calculada', async () => {
      const { componente, kit, item } = await kitConDiscrepancia({ totalStock: 20, quantity: 5 });

      let res = await as(app, admin).get(`/api/components/${componente.id}`).expect(200);
      expect(res.body.available).toBe(15);

      await resolver(kit.id, item.id, {
        action: 'DEDUCTED',
        quantity: 2,
        note: 'Descontadas',
      }).expect(201);

      res = await as(app, admin).get(`/api/components/${componente.id}`).expect(200);
      expect(res.body.available).toBe(17);
    });

    it('nunca deja la cantidad por debajo de lo ya devuelto', async () => {
      // 5 exigidas, 4 ya devueltas: descontar 3 dejaría 2 < 4, lo que sería incoherente.
      const { kit, item } = await kitConDiscrepancia({ quantity: 5, returned: 4 });

      await resolver(kit.id, item.id, {
        action: 'DEDUCTED',
        quantity: 3,
        note: 'Descuento tardío',
      }).expect(201);

      const enDb = await prisma.kitItem.findUniqueOrThrow({ where: { id: item.id } });
      expect(enDb.quantity).toBe(4);
      expect(enDb.quantity).toBeGreaterThanOrEqual(enDb.returnedQuantity);
    });

    it('no se puede descontar más unidades de las que tiene el ítem', async () => {
      const { kit, item } = await kitConDiscrepancia({ quantity: 5 });

      const res = await resolver(kit.id, item.id, {
        action: 'DEDUCTED',
        quantity: 9,
        note: 'Exagerado',
      }).expect(400);

      expect(res.body.message).toContain('solo tiene 5');
      const enDb = await prisma.kitItem.findUniqueOrThrow({ where: { id: item.id } });
      expect(enDb.quantity).toBe(5);
      expect(await prisma.discrepancyResolution.count()).toBe(0);
    });
  });

  describe('WRITE_OFF: baja de inventario', () => {
    it('reduce el stock total del componente y la cantidad del kit', async () => {
      const { componente, kit, item } = await kitConDiscrepancia({ totalStock: 20, quantity: 5 });

      await resolver(kit.id, item.id, {
        action: 'WRITE_OFF',
        quantity: 2,
        note: 'Se perdieron: se dan de baja',
      }).expect(201);

      const enDb = await prisma.kitItem.findUniqueOrThrow({ where: { id: item.id } });
      expect(enDb.quantity).toBe(3);
      const stock = await prisma.component.findUniqueOrThrow({ where: { id: componente.id } });
      expect(stock.totalStock).toBe(18);
    });

    it('un ítem sin enlace al catálogo no se puede dar de baja del inventario', async () => {
      const kit = await createKit(prisma, curso, grupo, {
        verifiedBy: alumno,
        items: [
          {
            component: null,
            componentName: 'Cable improvisado',
            quantity: 2,
            verified: false,
            verificationNote: 'No llegó',
          },
        ],
      });

      const res = await resolver(kit.id, kit.items[0].id, {
        action: 'WRITE_OFF',
        quantity: 1,
        note: 'Intento de baja',
      }).expect(400);

      expect(res.body.message).toContain('no está enlazado al catálogo');
      expect(await prisma.discrepancyResolution.count()).toBe(0);
    });

    it('la baja se bloquea si dejaría el stock por debajo de lo comprometido', async () => {
      // 10 en total, 8 comprometidas (5 de este kit + 3 de otro): solo hay 2 de margen.
      const componente = await createComponent(prisma, { name: 'Motor', totalStock: 10 });
      const kit = await createKit(prisma, curso, grupo, {
        verifiedBy: alumno,
        items: [
          { component: componente, quantity: 5, verified: false, verificationNote: 'Faltan' },
        ],
      });
      const otroGrupo = await createGroup(prisma, curso);
      await createKit(prisma, curso, otroGrupo, {
        items: [{ component: componente, quantity: 3 }],
      });

      const res = await resolver(kit.id, kit.items[0].id, {
        action: 'WRITE_OFF',
        quantity: 4,
        note: 'Baja excesiva',
      }).expect(400);

      expect(res.body.writeOff).toMatchObject({ totalStock: 10, requested: 4, committed: 8 });
      const stock = await prisma.component.findUniqueOrThrow({ where: { id: componente.id } });
      expect(stock.totalStock).toBe(10);
      // La transacción se revierte entera: ni stock ni cantidad ni registro.
      expect(
        await prisma.kitItem.findUniqueOrThrow({ where: { id: kit.items[0].id } }),
      ).toMatchObject({ quantity: 5 });
      expect(await prisma.discrepancyResolution.count()).toBe(0);
    });

    it('la baja justa hasta el límite de lo comprometido sí se permite', async () => {
      const componente = await createComponent(prisma, { name: 'Sensor', totalStock: 10 });
      const kit = await createKit(prisma, curso, grupo, {
        verifiedBy: alumno,
        items: [
          { component: componente, quantity: 6, verified: false, verificationNote: 'Faltan' },
        ],
      });

      // Tras descontar 4 del kit, el compromiso baja a 2 y el stock a 6: coherente.
      await resolver(kit.id, kit.items[0].id, {
        action: 'WRITE_OFF',
        quantity: 4,
        note: 'Baja al límite',
      }).expect(201);

      const stock = await prisma.component.findUniqueOrThrow({ where: { id: componente.id } });
      expect(stock.totalStock).toBe(6);
      const item = await prisma.kitItem.findUniqueOrThrow({ where: { id: kit.items[0].id } });
      expect(item.quantity).toBe(2);
    });
  });

  describe('precondiciones del flujo', () => {
    it('no hay nada que resolver si el grupo aún no verificó el kit', async () => {
      const componente = await createComponent(prisma, { totalStock: 10 });
      const kit = await createKit(prisma, curso, grupo, {
        items: [{ component: componente, quantity: 2 }],
      });

      const res = await resolver(kit.id, kit.items[0].id, {
        action: 'ACKNOWLEDGED',
        quantity: 1,
        note: 'Adelantándose',
      }).expect(409);

      expect(res.body.message).toContain('aún no ha sido verificado');
    });

    it('un ítem recibido conforme no tiene discrepancia que resolver', async () => {
      const componente = await createComponent(prisma, { totalStock: 10 });
      const kit = await createKit(prisma, curso, grupo, {
        verifiedBy: alumno,
        items: [{ component: componente, quantity: 2, verified: true }],
      });

      await resolver(kit.id, kit.items[0].id, {
        action: 'ACKNOWLEDGED',
        quantity: 1,
        note: 'Sin motivo',
      }).expect(409);
    });

    it('un ítem conforme PERO con nota sí cuenta como discrepancia', async () => {
      const componente = await createComponent(prisma, { totalStock: 10 });
      const kit = await createKit(prisma, curso, grupo, {
        verifiedBy: alumno,
        items: [
          {
            component: componente,
            quantity: 2,
            verified: true,
            verificationNote: 'Uno viene rayado pero funciona',
          },
        ],
      });

      await resolver(kit.id, kit.items[0].id, {
        action: 'ACKNOWLEDGED',
        quantity: 1,
        note: 'Se acepta el desgaste',
      }).expect(201);
    });

    it('la justificación es obligatoria', async () => {
      const { kit, item } = await kitConDiscrepancia();
      await resolver(kit.id, item.id, { action: 'ACKNOWLEDGED', quantity: 1 }).expect(400);
      await resolver(kit.id, item.id, {
        action: 'ACKNOWLEDGED',
        quantity: 1,
        note: '   ',
      }).expect(400);
      expect(await prisma.discrepancyResolution.count()).toBe(0);
    });

    it('solo se admiten las cuatro acciones del catálogo', async () => {
      const { kit, item } = await kitConDiscrepancia();
      await resolver(kit.id, item.id, {
        action: 'PERDONADO',
        quantity: 1,
        note: 'Acción inventada',
      }).expect(400);
    });

    it('un ítem de otro kit no se puede resolver desde este', async () => {
      const { kit } = await kitConDiscrepancia();
      const otro = await kitConDiscrepancia();

      await resolver(kit.id, otro.item.id, {
        action: 'ACKNOWLEDGED',
        quantity: 1,
        note: 'Cruzado',
      }).expect(404);
    });

    it('un alumno no puede resolver discrepancias', async () => {
      const { kit, item } = await kitConDiscrepancia();
      await as(app, alumno)
        .post(`/api/courses/${curso.id}/groups/${grupo.id}/kits/${kit.id}/items/${item.id}/resolve`)
        .send({ action: 'ACKNOWLEDGED', quantity: 1, note: 'No me toca' })
        .expect(403);
    });
  });

  describe('cierre del ciclo', () => {
    it('se admiten varias resoluciones sobre el mismo ítem y el historial las conserva', async () => {
      const { kit, item } = await kitConDiscrepancia({ quantity: 5 });

      await resolver(kit.id, item.id, {
        action: 'REPLACED',
        quantity: 1,
        note: 'Se repone una',
      }).expect(201);
      await resolver(kit.id, item.id, {
        action: 'DEDUCTED',
        quantity: 1,
        note: 'La otra se descuenta',
      }).expect(201);

      const historial = await prisma.discrepancyResolution.findMany({
        where: { kitItemId: item.id },
        orderBy: { createdAt: 'asc' },
      });
      expect(historial.map((r) => r.action)).toEqual(['REPLACED', 'DEDUCTED']);
      const enDb = await prisma.kitItem.findUniqueOrThrow({ where: { id: item.id } });
      expect(enDb).toMatchObject({ verified: true, quantity: 4 });
    });

    it('el alumno ve qué se decidió sobre lo que reportó', async () => {
      const { kit, item } = await kitConDiscrepancia();
      await resolver(kit.id, item.id, {
        action: 'REPLACED',
        quantity: 2,
        note: 'Repuesto en bodega',
      }).expect(201);

      const res = await as(app, alumno).get(`/api/me/kits/${kit.id}`).expect(200);

      expect(res.body.items[0].resolutions).toHaveLength(1);
      expect(res.body.items[0].resolutions[0]).toMatchObject({
        action: 'REPLACED',
        note: 'Repuesto en bodega',
        resolvedBy: { id: admin.id },
      });
    });

    it('una discrepancia resuelta deja de estar pendiente en el listado del profesor', async () => {
      const { kit, item } = await kitConDiscrepancia();

      let lista = await as(app, admin)
        .get(`/api/courses/${curso.id}/groups/${grupo.id}/kits`)
        .expect(200);
      expect(lista.body[0].hasDiscrepancies).toBe(true);

      await resolver(kit.id, item.id, {
        action: 'ACKNOWLEDGED',
        quantity: 1,
        note: 'Atendida',
      }).expect(201);

      lista = await as(app, admin)
        .get(`/api/courses/${curso.id}/groups/${grupo.id}/kits`)
        .expect(200);
      expect(lista.body[0].hasDiscrepancies).toBe(false);
    });

    /*
     * Regresión de la Fase 13: el listado pide solo el `_count` de resoluciones y el
     * detalle las `resolutions` completas. Cuando los flags miraban un único shape, el
     * detalle contaba siempre 0 y seguía marcando en rojo un kit ya atendido.
     */
    it('el detalle del kit informa lo mismo que el listado sobre discrepancias pendientes', async () => {
      const { kit, item } = await kitConDiscrepancia();
      await resolver(kit.id, item.id, {
        action: 'ACKNOWLEDGED',
        quantity: 1,
        note: 'Atendida',
      }).expect(201);

      const lista = await as(app, admin)
        .get(`/api/courses/${curso.id}/groups/${grupo.id}/kits`)
        .expect(200);
      const detalle = await as(app, admin)
        .get(`/api/courses/${curso.id}/groups/${grupo.id}/kits/${kit.id}`)
        .expect(200);

      expect(detalle.body.items[0].isResolved).toBe(true);
      expect(detalle.body.hasDiscrepancies).toBe(lista.body[0].hasDiscrepancies);
    });
  });
});
