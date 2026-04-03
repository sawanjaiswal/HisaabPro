import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding demo data...')

  // Create demo user
  const user = await prisma.user.upsert({
    where: { phone: '9876543210' },
    update: {},
    create: {
      phone: '9876543210',
      name: 'Sawan Jaiswal',
      passwordHash: '$2b$10$dummyhashfordevonly000000000000000000000000000',
      isActive: true,
    },
  })
  console.log(`User: ${user.name} (${user.id})`)

  // Create business
  const business = await prisma.business.upsert({
    where: { id: 'demo-business-001' },
    update: {},
    create: {
      id: 'demo-business-001',
      name: 'Jaiswal Trading Co.',
      phone: '9876543210',
      email: 'jaiswal@hisaabpro.in',
      address: 'MG Road, Near Clock Tower',
      city: 'Indore',
      state: 'Madhya Pradesh',
      pincode: '452001',
    },
  })
  console.log(`Business: ${business.name} (${business.id})`)

  // Link user to business as owner
  await prisma.businessUser.upsert({
    where: { userId_businessId: { userId: user.id, businessId: business.id } },
    update: {},
    create: {
      userId: user.id,
      businessId: business.id,
      role: 'OWNER',
      isActive: true,
    },
  })

  // Create base unit
  const pcsUnit = await prisma.unit.upsert({
    where: { id: 'unit-pcs' },
    update: {},
    create: {
      id: 'unit-pcs',
      businessId: business.id,
      name: 'Pieces',
      symbol: 'pcs',
          },
  })

  const kgUnit = await prisma.unit.upsert({
    where: { id: 'unit-kg' },
    update: {},
    create: {
      id: 'unit-kg',
      businessId: business.id,
      name: 'Kilogram',
      symbol: 'kg',
          },
  })

  // Create categories
  const electronics = await prisma.category.upsert({
    where: { id: 'cat-electronics' },
    update: {},
    create: {
      id: 'cat-electronics',
      businessId: business.id,
      name: 'Electronics',
    },
  })

  const grocery = await prisma.category.upsert({
    where: { id: 'cat-grocery' },
    update: {},
    create: {
      id: 'cat-grocery',
      businessId: business.id,
      name: 'Grocery',
    },
  })

  // Create products
  const products = [
    { id: 'prod-001', name: 'Samsung Galaxy M14', sku: 'SAM-M14', salePrice: 1299900, purchasePrice: 1099900, currentStock: 25, categoryId: electronics.id, unitId: pcsUnit.id },
    { id: 'prod-002', name: 'Boat Airdopes 141', sku: 'BOAT-141', salePrice: 129900, purchasePrice: 79900, currentStock: 150, categoryId: electronics.id, unitId: pcsUnit.id },
    { id: 'prod-003', name: 'Tata Salt (1kg)', sku: 'TATA-SALT', salePrice: 2800, purchasePrice: 2200, currentStock: 500, categoryId: grocery.id, unitId: kgUnit.id },
    { id: 'prod-004', name: 'Amul Butter (500g)', sku: 'AMUL-BTR', salePrice: 28500, purchasePrice: 24000, currentStock: 80, categoryId: grocery.id, unitId: pcsUnit.id },
    { id: 'prod-005', name: 'Realme Buds Air 5', sku: 'REAL-BA5', salePrice: 249900, purchasePrice: 189900, currentStock: 45, categoryId: electronics.id, unitId: pcsUnit.id },
    { id: 'prod-006', name: 'Fortune Sunflower Oil (5L)', sku: 'FORT-OIL', salePrice: 72000, purchasePrice: 63000, currentStock: 200, categoryId: grocery.id, unitId: pcsUnit.id },
  ]

  for (const p of products) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        businessId: business.id,
        name: p.name,
        sku: p.sku,
        salePrice: p.salePrice,
        purchasePrice: p.purchasePrice,
        currentStock: p.currentStock,
        categoryId: p.categoryId,
        unitId: p.unitId,
      },
    })
  }
  console.log(`Products: ${products.length} created`)

  // Create parties (customers & suppliers)
  const parties = [
    { id: 'party-001', name: 'Rajesh Electronics', type: 'CUSTOMER', phone: '9111222333', city: 'Indore', openingBalance: 4500000 },
    { id: 'party-002', name: 'Priya Wholesale', type: 'CUSTOMER', phone: '9222333444', city: 'Bhopal', openingBalance: 1200000 },
    { id: 'party-003', name: 'Amit Distributors', type: 'SUPPLIER', phone: '9333444555', city: 'Delhi', openingBalance: -7800000 },
    { id: 'party-004', name: 'Sharma General Store', type: 'CUSTOMER', phone: '9444555666', city: 'Ujjain', openingBalance: 350000 },
    { id: 'party-005', name: 'Delhi Electronics Hub', type: 'SUPPLIER', phone: '9555666777', city: 'Delhi', openingBalance: -2500000 },
    { id: 'party-006', name: 'Gupta Kirana Mart', type: 'CUSTOMER', phone: '9666777888', city: 'Indore', openingBalance: 890000 },
    { id: 'party-007', name: 'Mumbai Imports Ltd', type: 'SUPPLIER', phone: '9777888999', city: 'Mumbai', openingBalance: -15000000 },
    { id: 'party-008', name: 'Verma Electronics', type: 'CUSTOMER', phone: '9888999000', city: 'Dewas', openingBalance: 670000 },
  ]

  for (const p of parties) {
    await prisma.party.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        businessId: business.id,
        name: p.name,
        type: p.type as 'CUSTOMER' | 'SUPPLIER',
        phone: p.phone,
      },
    })
  }
  console.log(`Parties: ${parties.length} created`)

  // Link dev admin user too
  const devUser = await prisma.user.findFirst({ where: { phone: '9999999999' } })
  if (devUser) {
    await prisma.businessUser.upsert({
      where: { userId_businessId: { userId: devUser.id, businessId: business.id } },
      update: {},
      create: {
        userId: devUser.id,
        businessId: business.id,
        role: 'OWNER',
        isActive: true,
      },
    })
    console.log(`Linked dev admin to business`)
  }

  console.log('\nSeed complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
