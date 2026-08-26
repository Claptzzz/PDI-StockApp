import { Injectable } from '@nestjs/common';
import { KitStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../components/stock.service';
import { MetricsQueryDto } from './dto/metrics-query.dto';

const LOW_STOCK_THRESHOLD = 5;
const USAGE_TOP_N = 15;

@Injectable()
export class MetricsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
  ) {}

  private courseWhere(q: MetricsQueryDto): Prisma.CourseWhereInput {
    const where: Prisma.CourseWhereInput = {};
    if (q.year !== undefined) where.year = q.year;
    if (q.semester !== undefined) where.semester = q.semester;
    return where;
  }

  async overview(q: MetricsQueryDto) {
    const where = this.courseWhere(q);

    const [courses, groups, students, kitsAssigned, kitsReturned, loansTotal, loansPending] =
      await Promise.all([
        this.prisma.course.count({ where }),
        this.prisma.group.count({ where: { course: where } }),
        this.prisma.user.count({
          where: {
            // `roles has` y no `role`: un alumno que además es admin tiene rol
            // principal ADMIN pero sigue contando como estudiante del curso.
            roles: { has: Role.STUDENT },
            isActive: true,
            groupMemberships: { some: { group: { course: where } } },
          },
        }),
        this.prisma.kit.count({ where: { status: KitStatus.ASSIGNED, course: where } }),
        this.prisma.kit.count({ where: { status: KitStatus.RETURNED, course: where } }),
        this.prisma.loan.count({ where: { group: { course: where } } }),
        // Un préstamo con pendiente > 0 tiene returnedAt = null (se setea solo al devolver todo).
        this.prisma.loan.count({ where: { group: { course: where }, returnedAt: null } }),
      ]);

    return { courses, groups, students, kitsAssigned, kitsReturned, loansPending, loansTotal };
  }

  async stock() {
    const components = await this.prisma.component.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        totalStock: true,
        tags: { select: { id: true, name: true, color: true }, orderBy: { name: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });

    const commitments = await this.stockService.getCommitments(components.map((c) => c.id));

    return components
      .map((c) => {
        const cm = commitments.get(c.id) ?? { inKits: 0, inLoans: 0 };
        const available = this.stockService.available(c.totalStock, cm);
        return {
          id: c.id,
          name: c.name,
          code: c.code,
          tags: c.tags,
          totalStock: c.totalStock,
          committedInKits: cm.inKits,
          committedInLoans: cm.inLoans,
          available,
          lowStock: available <= LOW_STOCK_THRESHOLD,
        };
      })
      .sort((a, b) => a.available - b.available);
  }

  async usage(q: MetricsQueryDto) {
    const where = this.courseWhere(q);

    const [kitAgg, loanAgg] = await Promise.all([
      this.prisma.kitItem.groupBy({
        by: ['componentName'],
        where: { kit: { course: where } },
        _sum: { quantity: true },
      }),
      this.prisma.loan.groupBy({
        by: ['componentName'],
        where: { group: { course: where } },
        _sum: { quantity: true },
      }),
    ]);

    const map = new Map<string, { inKits: number; inLoans: number }>();
    const entry = (name: string) => {
      let e = map.get(name);
      if (!e) {
        e = { inKits: 0, inLoans: 0 };
        map.set(name, e);
      }
      return e;
    };
    for (const r of kitAgg) entry(r.componentName).inKits += r._sum.quantity ?? 0;
    for (const r of loanAgg) entry(r.componentName).inLoans += r._sum.quantity ?? 0;

    return [...map.entries()]
      .map(([name, v]) => ({
        name,
        inKits: v.inKits,
        inLoans: v.inLoans,
        totalUsed: v.inKits + v.inLoans,
      }))
      .sort((a, b) => b.totalUsed - a.totalUsed)
      .slice(0, USAGE_TOP_N);
  }

  async pendingReturns(q: MetricsQueryDto) {
    const where = this.courseWhere(q);

    // Cursos + sus grupos (estructura).
    const courses = await this.prisma.course.findMany({
      where,
      select: {
        id: true,
        name: true,
        year: true,
        semester: true,
        groups: { select: { id: true, name: true } },
      },
      orderBy: [{ year: 'desc' }, { semester: 'desc' }],
    });

    // Préstamos pendientes por grupo (returnedAt = null → pendiente > 0).
    const loanAgg = await this.prisma.loan.groupBy({
      by: ['groupId'],
      where: { group: { course: where }, returnedAt: null },
      _count: true,
      _sum: { quantity: true, returnedQuantity: true },
    });
    const loanMap = new Map<string, { count: number; units: number }>();
    for (const r of loanAgg) {
      loanMap.set(r.groupId, {
        count: r._count,
        units: (r._sum.quantity ?? 0) - (r._sum.returnedQuantity ?? 0),
      });
    }

    // Ítems de kit pendientes por grupo (comparación de columnas → SQL con FILTER).
    const conds: Prisma.Sql[] = [];
    if (q.year !== undefined) conds.push(Prisma.sql`c."year" = ${q.year}`);
    if (q.semester !== undefined) conds.push(Prisma.sql`c."semester" = ${q.semester}`);
    const whereSql = conds.length ? Prisma.sql`WHERE ${Prisma.join(conds, ' AND ')}` : Prisma.empty;

    const kitRows = await this.prisma.$queryRaw<
      { groupId: string; pendingItems: bigint; pendingUnits: bigint }[]
    >(Prisma.sql`
      SELECT k."groupId" AS "groupId",
             COUNT(*) FILTER (WHERE ki."returnedQuantity" < ki."quantity") AS "pendingItems",
             COALESCE(SUM(ki."quantity" - ki."returnedQuantity")
                      FILTER (WHERE ki."returnedQuantity" < ki."quantity"), 0) AS "pendingUnits"
      FROM "KitItem" ki
      JOIN "Kit" k ON ki."kitId" = k."id"
      JOIN "Course" c ON k."courseId" = c."id"
      ${whereSql}
      GROUP BY k."groupId"
    `);
    const kitMap = new Map<string, { items: number; units: number }>();
    for (const r of kitRows) {
      kitMap.set(r.groupId, { items: Number(r.pendingItems), units: Number(r.pendingUnits) });
    }

    const result = courses
      .map((course) => {
        const groups = course.groups
          .map((g) => {
            const kit = kitMap.get(g.id) ?? { items: 0, units: 0 };
            const loan = loanMap.get(g.id) ?? { count: 0, units: 0 };
            return {
              groupId: g.id,
              groupName: g.name,
              pendingKitItems: kit.items,
              pendingLoans: loan.count,
              totalPendingUnits: kit.units + loan.units,
            };
          })
          .filter((g) => g.totalPendingUnits > 0)
          .sort((a, b) => b.totalPendingUnits - a.totalPendingUnits);

        return {
          course: {
            id: course.id,
            name: course.name,
            year: course.year,
            semester: course.semester,
          },
          groups,
        };
      })
      .filter((c) => c.groups.length > 0);

    const courseTotal = (c: (typeof result)[number]) =>
      c.groups.reduce((s, g) => s + g.totalPendingUnits, 0);
    result.sort((a, b) => courseTotal(b) - courseTotal(a));

    return result;
  }
}
