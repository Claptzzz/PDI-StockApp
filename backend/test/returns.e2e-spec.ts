import { INestApplication } from '@nestjs/common';
import { Course, Group, KitStatus, User } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { supabaseStorage } from './mocks/supabase.mock';
import { createTestApp, resetDb } from './support/app';
import { as } from './support/auth';
import {
  createAdmin,
  createComponent,
  createCourse,
  createGroup,
  createKit,
  createLoan,
  createStudent,
} from './support/fixtures';

describe('Devoluciones', () => {
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

  describe('préstamos sueltos', () => {
    const devolver = (loanId: string, body: object) =>
      as(app, admin)
        .patch(`/api/courses/${curso.id}/groups/${grupo.id}/loans/${loanId}/return`)
        .send(body);

    it('devolver una parte deja el préstamo PARCIAL y sin fecha de cierre', async () => {
      const prestamo = await createLoan(prisma, grupo, admin, { quantity: 5 });

      const res = await devolver(prestamo.id, { quantity: 2 }).expect(200);

      expect(res.body).toMatchObject({ status: 'PARCIAL', returnedQuantity: 2, pending: 3 });
      const enDb = await prisma.loan.findUniqueOrThrow({ where: { id: prestamo.id } });
      expect(enDb.returnedQuantity).toBe(2);
      expect(enDb.returnedAt).toBeNull();
    });

    it('completar el total lo deja DEVUELTO y sella la fecha de devolución', async () => {
      const prestamo = await createLoan(prisma, grupo, admin, { quantity: 5 });

      await devolver(prestamo.id, { quantity: 2 }).expect(200);
      const res = await devolver(prestamo.id, { quantity: 3 }).expect(200);

      expect(res.body).toMatchObject({ status: 'DEVUELTO', pending: 0 });
      const enDb = await prisma.loan.findUniqueOrThrow({ where: { id: prestamo.id } });
      expect(enDb.returnedQuantity).toBe(5);
      expect(enDb.returnedAt).not.toBeNull();
    });

    it('no se puede devolver más de lo que queda pendiente', async () => {
      const prestamo = await createLoan(prisma, grupo, admin, { quantity: 5, returned: 4 });

      const res = await devolver(prestamo.id, { quantity: 2 }).expect(400);

      expect(res.body.message).toContain('solo hay 1');
      const enDb = await prisma.loan.findUniqueOrThrow({ where: { id: prestamo.id } });
      // Nada cambia y tampoco se registra el evento.
      expect(enDb.returnedQuantity).toBe(4);
      expect(await prisma.returnEvent.count()).toBe(0);
    });

    it('un préstamo ya devuelto no admite más devoluciones', async () => {
      const prestamo = await createLoan(prisma, grupo, admin, { quantity: 2, returned: 2 });
      await devolver(prestamo.id, { quantity: 1 }).expect(400);
    });

    it('cada devolución deja un evento con cantidad, nota y quién recibió', async () => {
      const prestamo = await createLoan(prisma, grupo, admin, { quantity: 5 });
      const ayudante = await createAdmin(prisma);

      await devolver(prestamo.id, { quantity: 2, note: 'Llega con la carcasa rota' }).expect(200);
      await as(app, ayudante)
        .patch(`/api/courses/${curso.id}/groups/${grupo.id}/loans/${prestamo.id}/return`)
        .send({ quantity: 3 })
        .expect(200);

      const eventos = await prisma.returnEvent.findMany({
        where: { loanId: prestamo.id },
        orderBy: { createdAt: 'asc' },
      });
      expect(eventos).toHaveLength(2);
      expect(eventos[0]).toMatchObject({
        quantity: 2,
        note: 'Llega con la carcasa rota',
        receivedById: admin.id,
      });
      expect(eventos[1]).toMatchObject({ quantity: 3, note: null, receivedById: ayudante.id });
      // Cada evento apunta al préstamo y a nada más (XOR con kitItemId).
      expect(eventos.every((e) => e.kitItemId === null)).toBe(true);
    });

    it('una nota en blanco no ensucia el historial', async () => {
      const prestamo = await createLoan(prisma, grupo, admin, { quantity: 1 });
      await devolver(prestamo.id, { quantity: 1, note: '   ' }).expect(200);

      const evento = await prisma.returnEvent.findFirstOrThrow();
      expect(evento.note).toBeNull();
    });

    it('el historial viaja junto al préstamo en la respuesta', async () => {
      const prestamo = await createLoan(prisma, grupo, admin, { quantity: 2 });
      await devolver(prestamo.id, { quantity: 1, note: 'Falta el cable' }).expect(200);

      const res = await as(app, admin)
        .get(`/api/courses/${curso.id}/groups/${grupo.id}/loans/${prestamo.id}`)
        .expect(200);

      expect(res.body.hasReturnNotes).toBe(true);
      expect(res.body.returnEvents).toHaveLength(1);
      expect(res.body.returnEvents[0]).toMatchObject({
        quantity: 1,
        note: 'Falta el cable',
        receivedBy: { id: admin.id },
      });
    });
  });

  describe('ítems del kit', () => {
    const devolverItem = (kitId: string, itemId: string, body: object) =>
      as(app, admin)
        .patch(`/api/courses/${curso.id}/groups/${grupo.id}/kits/${kitId}/items/${itemId}/return`)
        .send(body);

    it('devolver todos los ítems cierra el kit automáticamente', async () => {
      const a = await createComponent(prisma, { name: 'Arduino', totalStock: 10 });
      const b = await createComponent(prisma, { name: 'Bateria', totalStock: 10 });
      const kit = await createKit(prisma, curso, grupo, {
        items: [
          { component: a, quantity: 1 },
          { component: b, quantity: 2 },
        ],
      });
      const [itemA, itemB] = kit.items;

      await devolverItem(kit.id, itemA.id, { quantity: 1 }).expect(200);
      // Con un ítem pendiente el kit sigue abierto.
      let enDb = await prisma.kit.findUniqueOrThrow({ where: { id: kit.id } });
      expect(enDb.status).toBe(KitStatus.ASSIGNED);
      expect(enDb.returnedAt).toBeNull();

      await devolverItem(kit.id, itemB.id, { quantity: 2 }).expect(200);

      enDb = await prisma.kit.findUniqueOrThrow({ where: { id: kit.id } });
      expect(enDb.status).toBe(KitStatus.RETURNED);
      expect(enDb.returnedAt).not.toBeNull();
    });

    it('una devolución parcial de un ítem no cierra el kit', async () => {
      const componente = await createComponent(prisma, { totalStock: 10 });
      const kit = await createKit(prisma, curso, grupo, {
        items: [{ component: componente, quantity: 4 }],
      });

      const res = await devolverItem(kit.id, kit.items[0].id, { quantity: 1 }).expect(200);

      expect(res.body.status).toBe(KitStatus.ASSIGNED);
      expect(res.body.items[0]).toMatchObject({ returnedQuantity: 1, pending: 3 });
    });

    it('no se puede devolver más unidades de las pendientes de un ítem', async () => {
      const componente = await createComponent(prisma, { totalStock: 10 });
      const kit = await createKit(prisma, curso, grupo, {
        items: [{ component: componente, quantity: 2, returned: 1 }],
      });

      const res = await devolverItem(kit.id, kit.items[0].id, { quantity: 2 }).expect(400);

      expect(res.body.message).toContain('solo hay 1');
      const item = await prisma.kitItem.findUniqueOrThrow({ where: { id: kit.items[0].id } });
      expect(item.returnedQuantity).toBe(1);
      expect(await prisma.returnEvent.count()).toBe(0);
    });

    it('cada devolución de ítem deja su evento con nota y receptor', async () => {
      const componente = await createComponent(prisma, { totalStock: 10 });
      const kit = await createKit(prisma, curso, grupo, {
        items: [{ component: componente, quantity: 3 }],
      });

      await devolverItem(kit.id, kit.items[0].id, {
        quantity: 2,
        note: 'Un LED quemado',
      }).expect(200);

      const evento = await prisma.returnEvent.findFirstOrThrow({
        where: { kitItemId: kit.items[0].id },
      });
      expect(evento).toMatchObject({
        quantity: 2,
        note: 'Un LED quemado',
        receivedById: admin.id,
        loanId: null,
      });
    });

    it('un ítem que no pertenece al kit no se puede devolver', async () => {
      const componente = await createComponent(prisma, { totalStock: 10 });
      const kit = await createKit(prisma, curso, grupo, {
        items: [{ component: componente, quantity: 1 }],
      });
      const otroKit = await createKit(prisma, curso, grupo, {
        items: [{ component: componente, quantity: 1 }],
      });

      await devolverItem(kit.id, otroKit.items[0].id, { quantity: 1 }).expect(404);
    });

    it('la cantidad devuelta debe ser al menos 1', async () => {
      const componente = await createComponent(prisma, { totalStock: 10 });
      const kit = await createKit(prisma, curso, grupo, {
        items: [{ component: componente, quantity: 2 }],
      });

      await devolverItem(kit.id, kit.items[0].id, { quantity: 0 }).expect(400);
      await devolverItem(kit.id, kit.items[0].id, { quantity: -1 }).expect(400);
      expect(await prisma.returnEvent.count()).toBe(0);
    });
  });

  /**
   * Las fotos van a Supabase Storage, el otro servicio externo mockeado. Se comprueba
   * el ciclo completo contra el bucket falso: subida, firma, borrado y limpieza de
   * huérfanas cuando la creación del préstamo falla después de subir.
   */
  describe('fotos del préstamo', () => {
    const pngFalso = Buffer.from('89504e470d0a1a0a', 'hex');

    beforeEach(() => supabaseStorage.reset());

    it('adjuntar una foto la guarda en el bucket y la expone firmada', async () => {
      const res = await as(app, admin)
        .post(`/api/courses/${curso.id}/groups/${grupo.id}/loans`)
        .field('componentName', 'Osciloscopio')
        .field('quantity', '1')
        .attach('file', pngFalso, { filename: 'entrega.png', contentType: 'image/png' })
        .expect(201);

      expect(res.body.hasPhoto).toBe(true);
      expect(res.body.signedUrl).toContain('http://supabase.test/signed/loans/');
      expect(supabaseStorage.objects.size).toBe(1);

      const prestamo = await prisma.loan.findFirstOrThrow();
      // En la base se guarda el PATH del objeto privado, nunca una URL pública.
      expect(prestamo.photoUrl).toMatch(/^loans\/.+\.png$/);
      expect(supabaseStorage.objects.has(prestamo.photoUrl!)).toBe(true);
    });

    it('borrar el préstamo también borra su foto del bucket', async () => {
      const res = await as(app, admin)
        .post(`/api/courses/${curso.id}/groups/${grupo.id}/loans`)
        .field('componentName', 'Osciloscopio')
        .attach('file', pngFalso, { filename: 'entrega.png', contentType: 'image/png' })
        .expect(201);
      const prestamo = await prisma.loan.findFirstOrThrow();

      await as(app, admin)
        .delete(`/api/courses/${curso.id}/groups/${grupo.id}/loans/${res.body.id}`)
        .expect(200);

      expect(supabaseStorage.removed).toContain(prestamo.photoUrl);
      expect(supabaseStorage.objects.size).toBe(0);
    });

    it('un tipo de imagen no permitido se rechaza y no deja nada subido', async () => {
      await as(app, admin)
        .post(`/api/courses/${curso.id}/groups/${grupo.id}/loans`)
        .field('componentName', 'Osciloscopio')
        .attach('file', Buffer.from('GIF89a'), { filename: 'x.gif', contentType: 'image/gif' })
        .expect(400);

      expect(supabaseStorage.objects.size).toBe(0);
      expect(await prisma.loan.count()).toBe(0);
    });

    it('si el préstamo falla después de subir la foto, la foto no queda huérfana', async () => {
      const componente = await createComponent(prisma, { totalStock: 1 });

      // La subida ocurre ANTES de validar el stock: el rollback debe limpiarla.
      await as(app, admin)
        .post(`/api/courses/${curso.id}/groups/${grupo.id}/loans`)
        .field('componentId', componente.id)
        .field('quantity', '5')
        .attach('file', pngFalso, { filename: 'entrega.png', contentType: 'image/png' })
        .expect(400);

      expect(await prisma.loan.count()).toBe(0);
      expect(supabaseStorage.removed).toHaveLength(1);
      expect(supabaseStorage.objects.size).toBe(0);
    });
  });

  describe('resumen de devoluciones del grupo', () => {
    it('marca el grupo como cerrado solo cuando kits y préstamos están al día', async () => {
      const componente = await createComponent(prisma, { totalStock: 10 });
      const kit = await createKit(prisma, curso, grupo, {
        items: [{ component: componente, quantity: 2 }],
      });
      const prestamo = await createLoan(prisma, grupo, admin, { quantity: 1 });

      const url = `/api/courses/${curso.id}/groups/${grupo.id}/returns-summary`;
      let res = await as(app, admin).get(url).expect(200);
      expect(res.body.allReturned).toBe(false);

      await as(app, admin)
        .patch(
          `/api/courses/${curso.id}/groups/${grupo.id}/kits/${kit.id}/items/${kit.items[0].id}/return`,
        )
        .send({ quantity: 2, note: 'Completo' })
        .expect(200);

      // Falta el préstamo: todavía no está cerrado.
      res = await as(app, admin).get(url).expect(200);
      expect(res.body.allReturned).toBe(false);

      await as(app, admin)
        .patch(`/api/courses/${curso.id}/groups/${grupo.id}/loans/${prestamo.id}/return`)
        .send({ quantity: 1 })
        .expect(200);

      res = await as(app, admin).get(url).expect(200);
      expect(res.body.allReturned).toBe(true);
      // La nota se destaca para revisarla al cierre de semestre.
      expect(res.body.kits[0].hasReturnNotes).toBe(true);
    });
  });
});
