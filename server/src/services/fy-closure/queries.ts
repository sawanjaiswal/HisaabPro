/**
 * FY Closure queries — read-only listing of prior closures.
 */
import { prisma } from '../../lib/prisma.js'

export async function getFYClosures(businessId: string) {
  return prisma.financialYearClosure.findMany({
    where: { businessId },
    orderBy: { financialYear: 'desc' },
    take: 50, // bounded: typically < 50 financial years per business
  })
}
