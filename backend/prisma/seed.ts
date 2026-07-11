import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

/** Deriva un nombre legible desde la parte local del correo. */
function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

/** Catálogo base de componentes de un kit Arduino típico. */
const COMPONENTS: { name: string; description?: string; totalStock: number }[] = [
  { name: 'Arduino UNO', description: 'Placa microcontroladora ATmega328P', totalStock: 30 },
  { name: 'Protoboard 830 puntos', description: 'Breadboard sin soldadura', totalStock: 30 },
  { name: 'Cables jumper macho-macho', description: 'Set de cables de conexión Dupont', totalStock: 200 },
  { name: 'LED 5mm rojo', totalStock: 300 },
  { name: 'Resistencia 220Ω', totalStock: 500 },
  { name: 'Resistencia 10kΩ', totalStock: 500 },
  {
    name: 'Sensor ultrasónico HC-SR04',
    description: 'Medición de distancia por ultrasonido',
    totalStock: 40,
  },
  { name: 'Servo SG90', description: 'Micro servomotor 9g', totalStock: 40 },
  { name: 'Potenciómetro 10kΩ', totalStock: 60 },
  { name: 'Buzzer', description: 'Zumbador piezoeléctrico', totalStock: 50 },
  { name: 'Pulsador', description: 'Push button 4 pines', totalStock: 100 },
  { name: 'Display LCD 16x2', description: 'Pantalla LCD alfanumérica', totalStock: 25 },
];

/** Composición del template "Kit Base Arduino": nombre de componente -> cantidad. */
const KIT_BASE_ITEMS: { component: string; quantity: number }[] = [
  { component: 'Arduino UNO', quantity: 1 },
  { component: 'Protoboard 830 puntos', quantity: 1 },
  { component: 'Cables jumper macho-macho', quantity: 20 },
  { component: 'LED 5mm rojo', quantity: 5 },
  { component: 'Resistencia 220Ω', quantity: 10 },
  { component: 'Resistencia 10kΩ', quantity: 10 },
  { component: 'Pulsador', quantity: 2 },
  { component: 'Potenciómetro 10kΩ', quantity: 1 },
  { component: 'Buzzer', quantity: 1 },
];

const DEV_COURSE = {
  name: 'Proyecto de Diseño e Innovación',
  year: 2026,
  semester: 1,
};

/** Upsert de un admin por cada correo en ADMIN_EMAILS. */
async function seedAdmins(): Promise<string[]> {
  const raw = process.env.ADMIN_EMAILS ?? '';
  const emails = raw
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  for (const email of emails) {
    await prisma.user.upsert({
      where: { email },
      update: { role: Role.ADMIN, isActive: true },
      create: {
        email,
        name: nameFromEmail(email),
        role: Role.ADMIN,
        isActive: true,
        // googleId queda null hasta el primer login con Google.
      },
    });
  }

  return emails;
}

/** Upsert del catálogo base de componentes (clave: name). */
async function seedComponents(): Promise<void> {
  for (const component of COMPONENTS) {
    await prisma.component.upsert({
      where: { name: component.name },
      update: { description: component.description ?? null, totalStock: component.totalStock },
      create: {
        name: component.name,
        description: component.description ?? null,
        totalStock: component.totalStock,
      },
    });
  }
}

/** Upsert del template "Kit Base Arduino" y sus items. */
async function seedKitTemplate(): Promise<number> {
  const template = await prisma.kitTemplate.upsert({
    where: { name: 'Kit Base Arduino' },
    update: {},
    create: { name: 'Kit Base Arduino' },
  });

  let linked = 0;
  for (const item of KIT_BASE_ITEMS) {
    const component = await prisma.component.findUnique({ where: { name: item.component } });
    if (!component) continue;

    await prisma.kitTemplateItem.upsert({
      where: {
        templateId_componentId: { templateId: template.id, componentId: component.id },
      },
      update: { quantity: item.quantity },
      create: { templateId: template.id, componentId: component.id, quantity: item.quantity },
    });
    linked += 1;
  }

  return linked;
}

/** Course de ejemplo, solo en entornos que no sean producción. */
async function seedDevCourse(): Promise<boolean> {
  if (process.env.NODE_ENV === 'production') return false;

  await prisma.course.upsert({
    where: {
      name_year_semester: {
        name: DEV_COURSE.name,
        year: DEV_COURSE.year,
        semester: DEV_COURSE.semester,
      },
    },
    update: {},
    create: DEV_COURSE,
  });

  return true;
}

async function main(): Promise<void> {
  const admins = await seedAdmins();
  await seedComponents();
  const kitItems = await seedKitTemplate();
  const devCourse = await seedDevCourse();

  console.log('✔ Seed completado (idempotente):');
  console.log(`  - Admins (upsert): ${admins.length}${admins.length ? ` -> ${admins.join(', ')}` : ''}`);
  console.log(`  - Componentes (upsert): ${COMPONENTS.length}`);
  console.log(`  - KitTemplate "Kit Base Arduino": ${kitItems} items`);
  console.log(
    `  - Course de ejemplo (solo dev): ${devCourse ? `${DEV_COURSE.name} ${DEV_COURSE.year}-${DEV_COURSE.semester}` : 'omitido (producción)'}`,
  );

  if (admins.length === 0) {
    console.warn('⚠ ADMIN_EMAILS está vacío: no se creó ningún administrador.');
  }
}

main()
  .catch((error) => {
    console.error('✖ Seed falló:', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
