/**
 * GST Phase 2 — UQC (Unit Quantity Code) seed
 *
 * Idempotent upsert: sets HsnCode.uqc per HSN chapter based on CGST Notification 12/2017.
 * Safe to re-run — uses upsert with update that only sets uqc when the current value is 'NOS'
 * (preserves any manual overrides already in the DB).
 *
 * Standard UQC codes (47 total per CGST schedule):
 *   BAG, BAL, BDL, BKL, BOU, BOX, BTL, BUN, CAN, CBM, CCM, CMS, CTN, DOZ, DRM,
 *   GGK, GMS, GRS, GYD, KGS, KLR, KME, KNS, LTR, MLS, MLT, MTR, MTS, NOS, OTH,
 *   PAC, PCE, PCS, PKG, PKT, PLT, QNT, ROL, SET, SQC, SQF, SQM, SQY, TBS, TGM,
 *   THD, TON
 *
 * Chapter→UQC mapping follows commodity conventions; NOS (Numbers) is the safe default
 * for chapters that don't have a clear weight/volume unit.
 *
 * Run: npx ts-node --project tsconfig.json prisma/seed.gst.uqc.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/** Chapter prefix (2 chars) → UQC */
const CHAPTER_UQC_MAP: Record<string, string> = {
  // Section I — Live animals (Ch 1-5)
  '01': 'NOS', // Live animals
  '02': 'KGS', // Meat
  '03': 'KGS', // Fish
  '04': 'KGS', // Dairy, eggs
  '05': 'KGS', // Other animal products

  // Section II — Vegetable products (Ch 6-14)
  '06': 'NOS', // Live plants, cut flowers
  '07': 'KGS', // Vegetables
  '08': 'KGS', // Fruits
  '09': 'KGS', // Coffee, tea, spices
  '10': 'KGS', // Cereals
  '11': 'KGS', // Milling industry products
  '12': 'KGS', // Oil seeds
  '13': 'KGS', // Lac, gums, resins
  '14': 'KGS', // Vegetable plaiting materials

  // Section III — Fats (Ch 15)
  '15': 'KGS', // Animal/vegetable fats and oils

  // Section IV — Prepared foodstuffs (Ch 16-24)
  '16': 'KGS', // Preparations of meat/fish
  '17': 'KGS', // Sugars
  '18': 'KGS', // Cocoa
  '19': 'KGS', // Cereal/flour/starch preparations
  '20': 'KGS', // Preparations of vegetables/fruit
  '21': 'KGS', // Miscellaneous edible preparations
  '22': 'LTR', // Beverages, spirits, vinegar
  '23': 'KGS', // Residues from food industry
  '24': 'KGS', // Tobacco

  // Section V — Mineral products (Ch 25-27)
  '25': 'TON', // Salt, sulfur, earths, stone
  '26': 'TON', // Ores, slag, ash
  '27': 'KLR', // Mineral fuels, oils

  // Section VI — Chemical products (Ch 28-38)
  '28': 'KGS', // Inorganic chemicals
  '29': 'KGS', // Organic chemicals
  '30': 'NOS', // Pharmaceutical products
  '31': 'KGS', // Fertilisers
  '32': 'KGS', // Tanning/dyeing extracts
  '33': 'KGS', // Essential oils, perfumes
  '34': 'KGS', // Soap, washing preparations
  '35': 'KGS', // Albuminoidal substances, glues
  '36': 'KGS', // Explosives, pyrotechnics
  '37': 'NOS', // Photographic goods
  '38': 'KGS', // Miscellaneous chemical products

  // Section VII — Plastics, rubber (Ch 39-40)
  '39': 'KGS', // Plastics
  '40': 'KGS', // Rubber

  // Section VIII — Leather (Ch 41-43)
  '41': 'SQM', // Raw hides, skins, leather
  '42': 'NOS', // Articles of leather
  '43': 'NOS', // Furskins

  // Section IX — Wood, cork (Ch 44-46)
  '44': 'CBM', // Wood, articles of wood
  '45': 'KGS', // Cork
  '46': 'KGS', // Plaiting materials

  // Section X — Pulp, paper (Ch 47-49)
  '47': 'KGS', // Pulp of wood
  '48': 'KGS', // Paper and paperboard
  '49': 'NOS', // Printed books, newspapers

  // Section XI — Textiles (Ch 50-63)
  '50': 'KGS', // Silk
  '51': 'KGS', // Wool
  '52': 'KGS', // Cotton
  '53': 'KGS', // Other vegetable textile fibres
  '54': 'KGS', // Man-made filaments
  '55': 'KGS', // Man-made staple fibres
  '56': 'KGS', // Wadding, felt, nonwovens
  '57': 'SQM', // Carpets
  '58': 'MTR', // Special woven fabrics
  '59': 'MTR', // Impregnated textile fabrics
  '60': 'MTR', // Knitted/crocheted fabrics
  '61': 'NOS', // Knitted/crocheted clothing
  '62': 'NOS', // Not knitted clothing
  '63': 'KGS', // Other made-up textile articles

  // Section XII — Footwear, headgear (Ch 64-67)
  '64': 'NOS', // Footwear
  '65': 'NOS', // Headgear
  '66': 'NOS', // Umbrellas, walking sticks
  '67': 'NOS', // Prepared feathers

  // Section XIII — Articles of stone, ceramics, glass (Ch 68-70)
  '68': 'NOS', // Articles of stone
  '69': 'NOS', // Ceramic products
  '70': 'NOS', // Glass

  // Section XIV — Precious stones and metals (Ch 71)
  '71': 'GMS', // Natural/cultured pearls, precious stones, precious metals

  // Section XV — Base metals (Ch 72-83)
  '72': 'TON', // Iron and steel
  '73': 'KGS', // Articles of iron/steel
  '74': 'KGS', // Copper
  '75': 'KGS', // Nickel
  '76': 'KGS', // Aluminium
  '78': 'KGS', // Lead
  '79': 'KGS', // Zinc
  '80': 'KGS', // Tin
  '81': 'KGS', // Other base metals
  '82': 'NOS', // Tools, implements
  '83': 'NOS', // Miscellaneous articles of base metal

  // Section XVI — Machinery (Ch 84-85)
  '84': 'NOS', // Nuclear reactors, boilers, machinery
  '85': 'NOS', // Electrical machinery, equipment

  // Section XVII — Vehicles (Ch 86-89)
  '86': 'NOS', // Railway locomotives
  '87': 'NOS', // Vehicles (cars, trucks, etc.)
  '88': 'NOS', // Aircraft, spacecraft
  '89': 'NOS', // Ships, boats

  // Section XVIII — Optical, precision instruments (Ch 90-92)
  '90': 'NOS', // Optical, photographic, medical instruments
  '91': 'NOS', // Clocks, watches
  '92': 'NOS', // Musical instruments

  // Section XIX — Arms, ammunition (Ch 93)
  '93': 'NOS', // Arms and ammunition

  // Section XX — Miscellaneous (Ch 94-96)
  '94': 'NOS', // Furniture, bedding
  '95': 'NOS', // Toys, games
  '96': 'NOS', // Miscellaneous manufactured articles

  // Section XXI — Works of art (Ch 97)
  '97': 'NOS', // Works of art, collectors' pieces

  // SAC (Services) — 99xx chapters
  '99': 'NOS', // Services (NOS is the CGST-specified UQC for SAC codes)
}

async function seed(): Promise<void> {
  console.log('GST UQC seed — starting idempotent upsert by chapter...')

  // Fetch all HSN codes that still have the default 'NOS' value
  // (respect manual overrides — only patch rows where uqc = 'NOS')
  const hsnCodes = await prisma.hsnCode.findMany({
    select: { code: true, chapter: true, uqc: true },
  })

  let updated = 0
  let skipped = 0

  for (const hsn of hsnCodes) {
    const chapter = hsn.chapter ?? hsn.code.substring(0, 2)
    const targetUqc = CHAPTER_UQC_MAP[chapter] ?? 'NOS'

    // Only write if the current value is 'NOS' (default) and target differs.
    // Preserves any manual per-code overrides already in the DB.
    if (hsn.uqc === 'NOS' && targetUqc !== 'NOS') {
      await prisma.hsnCode.update({
        where: { code: hsn.code },
        data: { uqc: targetUqc },
      })
      updated++
    } else {
      skipped++
    }
  }

  console.log(`GST UQC seed — done. updated=${updated} skipped=${skipped}`)
}

seed()
  .catch((err) => {
    console.error('GST UQC seed failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
