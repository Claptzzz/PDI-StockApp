import { INestApplication } from '@nestjs/common';
import { Course, Group, KitStatus, User } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, resetDb } from './support/app';
import { as } from './support/auth';
import {
  createAdmin,
  createComponent,
  createCourse,
  createGroup,
  createKit,
  createStudent,
  createTemplate,
} from './support/fixtures';

describe('Asignación de kits', () => {
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
    curso = await createCourse(prisma, { name: 'Electrónica', year: 2026, semester: 1 });
    grupo = await createGroup(prisma, curso, { members: [await createStudent(prisma)] });
  });

  const asignar = (grupoId: string, body: object, cursoId = curso.id) =>
    as(app, admin).post(`/api/courses/${cursoId}/groups/${grupoId}/kits`).send(body);

  describe('unicidad del código', () => {
    it('no se puede repetir el código de kit dentro del mismo curso', async () => {
      const componente = await createComponent(prisma, { totalStock: 100 });
      await asignar(grupo.id, {
        code: 'KIT-01',
        items: [{ componentId: componente.id, quantity: 1 }],
      }).expect(201);

      const otroGrupo = await createGroup(prisma, curso);
      await asignar(otroGrupo.id, {
        code: 'KIT-01',
        items: [{ componentId: componente.id, quantity: 1 }],
      }).expect(409);

      expect(await prisma.kit.count({ where: { code: 'KIT-01' } })).toBe(1);
    });

    it('el MISMO código sí se puede reutilizar en otro curso (otro semestre)', async () => {
      const componente = await createComponent(prisma, { totalStock: 100 });
      await asignar(grupo.id, {
        code: 'KIT-01',
        items: [{ componentId: componente.id, quantity: 1 }],
      }).expect(201);

      const curso2026s2 = await createCourse(prisma, {
        name: 'Electrónica',
        year: 2026,
        semester: 2,
      });
      const grupoNuevo = await createGroup(prisma, curso2026s2);

      await asignar(
        grupoNuevo.id,
        { code: 'KIT-01', items: [{ componentId: componente.id, quantity: 1 }] },
        curso2026s2.id,
      ).expect(201);

      const kits = await prisma.kit.findMany({ where: { code: 'KIT-01' } });
      expect(kits).toHaveLength(2);
      expect(new Set(kits.map((k) => k.courseId)).size).toBe(2);
    });

    it('el código se guarda sin espacios sobrantes', async () => {
      const componente = await createComponent(prisma, { totalStock: 10 });
      await asignar(grupo.id, {
        code: '  KIT-TRIM  ',
        items: [{ componentId: componente.id, quantity: 1 }],
      }).expect(201);

      expect(await prisma.kit.findFirst({ where: { code: 'KIT-TRIM' } })).not.toBeNull();
    });

    it('un código en blanco se rechaza', async () => {
      const componente = await createComponent(prisma, { totalStock: 10 });
      await asignar(grupo.id, {
        code: '   ',
        items: [{ componentId: componente.id, quantity: 1 }],
      }).expect(400);
    });
  });

  describe('origen del contenido: plantilla o ítems, nunca ambos', () => {
    it('se rechaza enviar plantilla e ítems a la vez', async () => {
      const componente = await createComponent(prisma, { totalStock: 10 });
      const plantilla = await createTemplate(prisma, [{ component: componente, quantity: 1 }]);

      const res = await asignar(grupo.id, {
        code: 'K-AMBOS',
        templateId: plantilla.id,
        items: [{ componentId: componente.id, quantity: 1 }],
      }).expect(400);

      expect(res.body.message).toContain('exactamente uno');
      expect(await prisma.kit.count()).toBe(0);
    });

    it('se rechaza no enviar ninguno de los dos', async () => {
      const res = await asignar(grupo.id, { code: 'K-NINGUNO' }).expect(400);
      expect(res.body.message).toContain('exactamente uno');
    });

    it('desde una plantilla se copian sus componentes y cantidades', async () => {
      const a = await createComponent(prisma, { name: 'Arduino UNO', totalStock: 10 });
      const b = await createComponent(prisma, { name: 'Protoboard', totalStock: 10 });
      const plantilla = await createTemplate(prisma, [
        { component: a, quantity: 1 },
        { component: b, quantity: 2 },
      ]);

      const res = await asignar(grupo.id, {
        code: 'K-DESDE-PLANTILLA',
        templateId: plantilla.id,
      }).expect(201);

      expect(res.body.templateId).toBe(plantilla.id);
      const items = await prisma.kitItem.findMany({
        where: { kitId: res.body.id },
        orderBy: { componentName: 'asc' },
      });
      expect(items.map((i) => [i.componentName, i.quantity])).toEqual([
        ['Arduino UNO', 1],
        ['Protoboard', 2],
      ]);
    });

    it('una plantilla vacía no sirve para asignar', async () => {
      const plantilla = await prisma.kitTemplate.create({ data: { name: 'Vacía' } });
      await asignar(grupo.id, { code: 'K-VACIA', templateId: plantilla.id }).expect(400);
    });

    it('una plantilla inexistente se rechaza', async () => {
      await asignar(grupo.id, { code: 'K-FANTASMA', templateId: 'no-existe' }).expect(400);
    });

    it('se rechazan componentes repetidos en el mismo kit', async () => {
      const componente = await createComponent(prisma, { totalStock: 10 });
      const res = await asignar(grupo.id, {
        code: 'K-DUP',
        items: [
          { componentId: componente.id, quantity: 1 },
          { componentId: componente.id, quantity: 2 },
        ],
      }).expect(400);

      expect(res.body.message).toContain('duplicados');
    });

    it('se rechaza un componente que no está en el catálogo', async () => {
      await asignar(grupo.id, {
        code: 'K-INEXISTENTE',
        items: [{ componentId: 'no-existe', quantity: 1 }],
      }).expect(400);
    });
  });

  describe('el contenido del kit es una foto inmutable', () => {
    it('guarda el nombre del componente tal como estaba al asignar', async () => {
      const componente = await createComponent(prisma, { name: 'Sensor DHT11', totalStock: 10 });
      const res = await asignar(grupo.id, {
        code: 'K-SNAP',
        items: [{ componentId: componente.id, quantity: 2 }],
      }).expect(201);

      // El catálogo cambia DESPUÉS de la entrega.
      await as(app, admin)
        .patch(`/api/components/${componente.id}`)
        .send({ name: 'Sensor DHT11 (v2)' })
        .expect(200);

      const item = await prisma.kitItem.findFirstOrThrow({ where: { kitId: res.body.id } });
      expect(item.componentName).toBe('Sensor DHT11');
      // El enlace al catálogo se conserva para poder calcular stock.
      expect(item.componentId).toBe(componente.id);
    });

    it('PATCH del kit solo cambia el código: los ítems quedan intactos', async () => {
      const componente = await createComponent(prisma, { name: 'LED', totalStock: 10 });
      const kit = await createKit(prisma, curso, grupo, {
        code: 'K-ORIGINAL',
        items: [{ component: componente, quantity: 3 }],
      });

      await as(app, admin)
        .patch(`/api/courses/${curso.id}/groups/${grupo.id}/kits/${kit.id}`)
        .send({ code: 'K-RENOMBRADO' })
        .expect(200);

      const enDb = await prisma.kit.findUniqueOrThrow({
        where: { id: kit.id },
        include: { items: true },
      });
      expect(enDb.code).toBe('K-RENOMBRADO');
      expect(enDb.items).toHaveLength(1);
      expect(enDb.items[0]).toMatchObject({ componentName: 'LED', quantity: 3 });
    });

    it('el PATCH ignora cualquier campo que no sea el código', async () => {
      const componente = await createComponent(prisma, { totalStock: 10 });
      const kit = await createKit(prisma, curso, grupo, {
        code: 'K-ESTRICTO',
        items: [{ component: componente, quantity: 3 }],
      });

      // `forbidNonWhitelisted` en el ValidationPipe: enviar de más es un error, no un
      // cambio silencioso.
      await as(app, admin)
        .patch(`/api/courses/${curso.id}/groups/${grupo.id}/kits/${kit.id}`)
        .send({ code: 'K-ESTRICTO-2', status: KitStatus.RETURNED, items: [] })
        .expect(400);

      const enDb = await prisma.kit.findUniqueOrThrow({ where: { id: kit.id } });
      expect(enDb).toMatchObject({ code: 'K-ESTRICTO', status: KitStatus.ASSIGNED });
    });

    it('renombrar el kit a un código ya usado en el curso choca', async () => {
      const componente = await createComponent(prisma, { totalStock: 10 });
      await createKit(prisma, curso, grupo, {
        code: 'K-A',
        items: [{ component: componente, quantity: 1 }],
      });
      const kitB = await createKit(prisma, curso, grupo, {
        code: 'K-B',
        items: [{ component: componente, quantity: 1 }],
      });

      await as(app, admin)
        .patch(`/api/courses/${curso.id}/groups/${grupo.id}/kits/${kitB.id}`)
        .send({ code: 'K-A' })
        .expect(409);
    });
  });

  describe('estado inicial', () => {
    it('un kit recién asignado queda ASSIGNED, sin devoluciones ni verificación', async () => {
      const componente = await createComponent(prisma, { totalStock: 10 });
      const res = await asignar(grupo.id, {
        code: 'K-NUEVO',
        items: [{ componentId: componente.id, quantity: 2 }],
      }).expect(201);

      expect(res.body).toMatchObject({
        status: KitStatus.ASSIGNED,
        isVerified: false,
        hasDiscrepancies: false,
      });
      const enDb = await prisma.kit.findUniqueOrThrow({
        where: { id: res.body.id },
        include: { items: true },
      });
      expect(enDb.verifiedAt).toBeNull();
      expect(enDb.returnedAt).toBeNull();
      expect(enDb.items[0]).toMatchObject({ returnedQuantity: 0, verified: false });
    });
  });
});
