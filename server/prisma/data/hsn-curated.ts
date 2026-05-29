/**
 * Curated HSN/SAC seed dataset (#76 — subset; full ~12K master deferred).
 *
 * ~160 of the most-used HSN goods codes + common SAC service codes for Indian
 * retail/wholesale MSMEs. Rates are GST slab in BASIS POINTS (1800 = 18%),
 * matching HsnCode.defaultRate / cessRate units (see schema.prisma + tax-calc).
 *
 * Rates reflect the common/general slab for the heading; food staples have
 * branded-vs-unbranded nuance — values here are a sensible default the user
 * can override on the product form. `chapter` = first 2 digits of the code.
 *
 * Idempotent upsert keyed on `code` (prisma/seed.hsn.ts) — safe to re-run and
 * non-destructive when the full 12K master is loaded later.
 */

export interface CuratedHsnCode {
  code: string
  description: string
  chapter: string
  defaultRate: number // basis points (1800 = 18%)
  cessApplicable?: boolean
  cessRate?: number // basis points
}

export const CURATED_HSN_CODES: CuratedHsnCode[] = [
  // ── Dairy, eggs, honey (Ch 04) ─────────────────────────────────────────────
  { code: '0401', description: 'Milk and cream, not concentrated nor sweetened', chapter: '04', defaultRate: 0 },
  { code: '0402', description: 'Milk and cream, concentrated or sweetened (milk powder)', chapter: '04', defaultRate: 500 },
  { code: '0403', description: 'Curd, lassi, buttermilk', chapter: '04', defaultRate: 0 },
  { code: '0405', description: 'Butter and other fats derived from milk; ghee', chapter: '04', defaultRate: 1200 },
  { code: '0406', description: 'Cheese and paneer', chapter: '04', defaultRate: 500 },
  { code: '0407', description: 'Birds eggs, in shell, fresh', chapter: '04', defaultRate: 0 },
  { code: '0409', description: 'Natural honey', chapter: '04', defaultRate: 500 },

  // ── Vegetables, fruits (Ch 07, 08) ─────────────────────────────────────────
  { code: '0701', description: 'Potatoes, fresh or chilled', chapter: '07', defaultRate: 0 },
  { code: '0702', description: 'Tomatoes, fresh or chilled', chapter: '07', defaultRate: 0 },
  { code: '0703', description: 'Onions, garlic, leeks, fresh', chapter: '07', defaultRate: 0 },
  { code: '0713', description: 'Dried leguminous vegetables (pulses, dal)', chapter: '07', defaultRate: 0 },
  { code: '0803', description: 'Bananas, fresh or dried', chapter: '08', defaultRate: 0 },
  { code: '0805', description: 'Citrus fruit, fresh or dried', chapter: '08', defaultRate: 0 },
  { code: '0808', description: 'Apples, pears and quinces, fresh', chapter: '08', defaultRate: 0 },

  // ── Coffee, tea, spices (Ch 09) ────────────────────────────────────────────
  { code: '0901', description: 'Coffee, whether or not roasted', chapter: '09', defaultRate: 500 },
  { code: '0902', description: 'Tea, whether or not flavoured', chapter: '09', defaultRate: 500 },
  { code: '0904', description: 'Pepper; dried/crushed chillies of genus Capsicum', chapter: '09', defaultRate: 500 },
  { code: '0908', description: 'Nutmeg, mace and cardamoms', chapter: '09', defaultRate: 500 },
  { code: '0910', description: 'Ginger, saffron, turmeric, thyme, curry, spices', chapter: '09', defaultRate: 500 },

  // ── Cereals & milling (Ch 10, 11) ──────────────────────────────────────────
  { code: '1001', description: 'Wheat and meslin', chapter: '10', defaultRate: 0 },
  { code: '1005', description: 'Maize (corn)', chapter: '10', defaultRate: 0 },
  { code: '1006', description: 'Rice', chapter: '10', defaultRate: 500 },
  { code: '1101', description: 'Wheat or meslin flour (atta, maida)', chapter: '11', defaultRate: 0 },
  { code: '1102', description: 'Cereal flours other than wheat (besan etc.)', chapter: '11', defaultRate: 0 },
  { code: '1106', description: 'Flour and meal of dried legumes / sago', chapter: '11', defaultRate: 500 },

  // ── Oil seeds, edible oils (Ch 12, 15) ─────────────────────────────────────
  { code: '1207', description: 'Other oil seeds and oleaginous fruits', chapter: '12', defaultRate: 500 },
  { code: '1507', description: 'Soya-bean oil and its fractions', chapter: '15', defaultRate: 500 },
  { code: '1511', description: 'Palm oil and its fractions', chapter: '15', defaultRate: 500 },
  { code: '1512', description: 'Sunflower-seed, safflower or cotton-seed oil', chapter: '15', defaultRate: 500 },
  { code: '1517', description: 'Margarine; edible mixtures of fats and oils', chapter: '15', defaultRate: 500 },

  // ── Sugar, confectionery, bakery (Ch 17, 18, 19) ───────────────────────────
  { code: '1701', description: 'Cane or beet sugar, sucrose, chemically pure', chapter: '17', defaultRate: 500 },
  { code: '1704', description: 'Sugar confectionery (incl. white chocolate)', chapter: '17', defaultRate: 1800 },
  { code: '1806', description: 'Chocolate and other cocoa preparations', chapter: '18', defaultRate: 1800 },
  { code: '1905', description: 'Bread, pastry, cakes, biscuits, rusks', chapter: '19', defaultRate: 1800 },
  { code: '1902', description: 'Pasta, noodles, macaroni, vermicelli', chapter: '19', defaultRate: 1200 },

  // ── Edible preparations, beverages (Ch 20, 21, 22) ─────────────────────────
  { code: '2009', description: 'Fruit and vegetable juices, unfermented', chapter: '20', defaultRate: 1200 },
  { code: '2101', description: 'Extracts of coffee/tea; instant coffee', chapter: '21', defaultRate: 1800 },
  { code: '2103', description: 'Sauces, ketchup, mixed condiments and seasonings', chapter: '21', defaultRate: 1200 },
  { code: '2106', description: 'Food preparations not elsewhere specified', chapter: '21', defaultRate: 1800 },
  { code: '2201', description: 'Waters, incl. natural/artificial mineral, packaged', chapter: '22', defaultRate: 1800 },
  { code: '2202', description: 'Aerated waters and sweetened beverages', chapter: '22', defaultRate: 2800, cessApplicable: true, cessRate: 1200 },

  // ── Tobacco (Ch 24) — cess applies ─────────────────────────────────────────
  { code: '2402', description: 'Cigars, cheroots and cigarettes (tobacco)', chapter: '24', defaultRate: 2800, cessApplicable: true, cessRate: 3600 },
  { code: '2403', description: 'Other manufactured tobacco (chewing tobacco)', chapter: '24', defaultRate: 2800, cessApplicable: true, cessRate: 7100 },

  // ── Minerals, cement (Ch 25) ───────────────────────────────────────────────
  { code: '2501', description: 'Salt and pure sodium chloride', chapter: '25', defaultRate: 0 },
  { code: '2523', description: 'Portland cement, aluminous cement, clinkers', chapter: '25', defaultRate: 2800 },

  // ── Pharma (Ch 30) ─────────────────────────────────────────────────────────
  { code: '3003', description: 'Medicaments, not in measured doses (bulk)', chapter: '30', defaultRate: 1200 },
  { code: '3004', description: 'Medicaments, in measured doses for retail sale', chapter: '30', defaultRate: 1200 },
  { code: '3005', description: 'Wadding, gauze, bandages, surgical dressings', chapter: '30', defaultRate: 1200 },

  // ── Cosmetics, soap, candles (Ch 33, 34) ───────────────────────────────────
  { code: '3303', description: 'Perfumes and toilet waters', chapter: '33', defaultRate: 1800 },
  { code: '3304', description: 'Beauty/make-up and skin-care preparations', chapter: '33', defaultRate: 1800 },
  { code: '3305', description: 'Preparations for use on the hair (shampoo, oil)', chapter: '33', defaultRate: 1800 },
  { code: '3306', description: 'Oral / dental hygiene preparations (toothpaste)', chapter: '33', defaultRate: 1800 },
  { code: '3401', description: 'Soap; organic surface-active products (bath bars)', chapter: '34', defaultRate: 1800 },
  { code: '3402', description: 'Washing & cleaning preparations (detergents)', chapter: '34', defaultRate: 1800 },

  // ── Plastics, rubber (Ch 39, 40) ───────────────────────────────────────────
  { code: '3923', description: 'Plastic articles for packing/conveyance of goods', chapter: '39', defaultRate: 1800 },
  { code: '3924', description: 'Plastic tableware, kitchenware, household articles', chapter: '39', defaultRate: 1800 },
  { code: '3926', description: 'Other articles of plastics', chapter: '39', defaultRate: 1800 },
  { code: '4011', description: 'New pneumatic tyres, of rubber', chapter: '40', defaultRate: 2800 },

  // ── Leather, footwear (Ch 42, 64) ──────────────────────────────────────────
  { code: '4202', description: 'Trunks, suitcases, handbags, wallets', chapter: '42', defaultRate: 1800 },
  { code: '6403', description: 'Footwear with leather uppers', chapter: '64', defaultRate: 1800 },
  { code: '6405', description: 'Other footwear', chapter: '64', defaultRate: 1800 },

  // ── Paper, printed matter, stationery (Ch 48, 49) ──────────────────────────
  { code: '4802', description: 'Uncoated paper for writing/printing', chapter: '48', defaultRate: 1200 },
  { code: '4817', description: 'Envelopes, letter cards, correspondence cards', chapter: '48', defaultRate: 1800 },
  { code: '4820', description: 'Registers, notebooks, diaries, account books', chapter: '48', defaultRate: 1200 },
  { code: '4901', description: 'Printed books, brochures and similar matter', chapter: '49', defaultRate: 0 },
  { code: '4909', description: 'Printed greeting/postcards and trade ads', chapter: '49', defaultRate: 1800 },

  // ── Textiles & apparel (Ch 52, 61, 62, 63) ─────────────────────────────────
  { code: '5208', description: 'Woven fabrics of cotton, >=85% cotton', chapter: '52', defaultRate: 500 },
  { code: '6109', description: 'T-shirts, singlets, vests, knitted/crocheted', chapter: '61', defaultRate: 500 },
  { code: '6203', description: "Men's suits, jackets, trousers (not knitted)", chapter: '62', defaultRate: 500 },
  { code: '6204', description: "Women's suits, dresses, skirts (not knitted)", chapter: '62', defaultRate: 500 },
  { code: '6302', description: 'Bed linen, table linen, toilet & kitchen linen', chapter: '63', defaultRate: 500 },

  // ── Base metals, hardware (Ch 72, 73, 76, 82, 83) ──────────────────────────
  { code: '7214', description: 'Bars and rods of iron or non-alloy steel (TMT)', chapter: '72', defaultRate: 1800 },
  { code: '7308', description: 'Structures and parts of iron or steel', chapter: '73', defaultRate: 1800 },
  { code: '7323', description: 'Table/kitchen/household articles of iron or steel', chapter: '73', defaultRate: 1800 },
  { code: '7615', description: 'Table/kitchen/household articles of aluminium', chapter: '76', defaultRate: 1200 },
  { code: '8201', description: 'Hand tools — spades, shovels, hoes, axes', chapter: '82', defaultRate: 1200 },
  { code: '8301', description: 'Padlocks and locks; keys of base metal', chapter: '83', defaultRate: 1800 },

  // ── Machinery, electronics, appliances (Ch 84, 85) ─────────────────────────
  { code: '8413', description: 'Pumps for liquids; liquid elevators', chapter: '84', defaultRate: 1800 },
  { code: '8415', description: 'Air conditioning machines', chapter: '84', defaultRate: 2800 },
  { code: '8418', description: 'Refrigerators, freezers and refrigerating equipment', chapter: '84', defaultRate: 1800 },
  { code: '8443', description: 'Printing machinery; printers, copiers', chapter: '84', defaultRate: 1800 },
  { code: '8450', description: 'Household / laundry-type washing machines', chapter: '84', defaultRate: 1800 },
  { code: '8471', description: 'Computers / automatic data-processing machines', chapter: '84', defaultRate: 1800 },
  { code: '8473', description: 'Parts and accessories of computers / machines', chapter: '84', defaultRate: 1800 },
  { code: '8504', description: 'Electrical transformers, static converters, chargers', chapter: '85', defaultRate: 1800 },
  { code: '8506', description: 'Primary cells and primary batteries', chapter: '85', defaultRate: 1800 },
  { code: '8507', description: 'Electric accumulators (incl. rechargeable batteries)', chapter: '85', defaultRate: 2800 },
  { code: '8517', description: 'Telephone sets incl. smartphones; network apparatus', chapter: '85', defaultRate: 1800 },
  { code: '8523', description: 'Discs, tapes, solid-state storage devices, media', chapter: '85', defaultRate: 1800 },
  { code: '8528', description: 'Monitors and projectors; television receivers', chapter: '85', defaultRate: 2800 },
  { code: '8536', description: 'Electrical apparatus for switching/protecting circuits', chapter: '85', defaultRate: 1800 },
  { code: '8544', description: 'Insulated wire, cable and other electric conductors', chapter: '85', defaultRate: 1800 },

  // ── Vehicles & parts (Ch 87) — cess on vehicles ────────────────────────────
  { code: '8703', description: 'Motor cars and vehicles for transport of persons', chapter: '87', defaultRate: 2800, cessApplicable: true, cessRate: 1700 },
  { code: '8711', description: 'Motorcycles and mopeds', chapter: '87', defaultRate: 2800, cessApplicable: true, cessRate: 300 },
  { code: '8714', description: 'Parts and accessories of motorcycles / cycles', chapter: '87', defaultRate: 2800 },
  { code: '8712', description: 'Bicycles and other cycles, not motorised', chapter: '87', defaultRate: 1200 },

  // ── Optical, medical, clocks (Ch 90, 91) ───────────────────────────────────
  { code: '9004', description: 'Spectacles, goggles and the like (corrective)', chapter: '90', defaultRate: 1200 },
  { code: '9018', description: 'Instruments and appliances used in medical sciences', chapter: '90', defaultRate: 1200 },
  { code: '9101', description: 'Wrist-watches, pocket-watches (precious metal case)', chapter: '91', defaultRate: 1800 },

  // ── Furniture, lighting, toys (Ch 94, 95) ──────────────────────────────────
  { code: '9401', description: 'Seats (chairs), whether or not convertible into beds', chapter: '94', defaultRate: 1800 },
  { code: '9403', description: 'Other furniture and parts thereof', chapter: '94', defaultRate: 1800 },
  { code: '9405', description: 'Lamps and lighting fittings incl. LED', chapter: '94', defaultRate: 1200 },
  { code: '9503', description: 'Tricycles, scooters, toys, puzzles', chapter: '95', defaultRate: 1200 },
  { code: '9506', description: 'Sports goods and equipment; fitness articles', chapter: '95', defaultRate: 1200 },

  // ── Pens, misc manufactured (Ch 96) ────────────────────────────────────────
  { code: '9608', description: 'Ball-point, felt-tipped and other pens; pencils', chapter: '96', defaultRate: 1800 },
  { code: '9619', description: 'Sanitary towels, napkins, diapers', chapter: '96', defaultRate: 1200 },

  // ── Services — SAC codes (Ch 99) ───────────────────────────────────────────
  { code: '995411', description: 'Construction services of residential buildings', chapter: '99', defaultRate: 1800 },
  { code: '996511', description: 'Road transport services of goods (GTA)', chapter: '99', defaultRate: 500 },
  { code: '996412', description: 'Taxi / passenger road transport services', chapter: '99', defaultRate: 500 },
  { code: '996311', description: 'Room/accommodation services by hotels, inns', chapter: '99', defaultRate: 1200 },
  { code: '996331', description: 'Restaurant / catering food and beverage services', chapter: '99', defaultRate: 500 },
  { code: '997212', description: 'Rental / leasing of own non-residential property', chapter: '99', defaultRate: 1800 },
  { code: '998313', description: 'Information technology (IT) consulting services', chapter: '99', defaultRate: 1800 },
  { code: '998314', description: 'IT design and development services (software)', chapter: '99', defaultRate: 1800 },
  { code: '998361', description: 'Advertising services', chapter: '99', defaultRate: 1800 },
  { code: '998599', description: 'Other support services n.e.c.', chapter: '99', defaultRate: 1800 },
  { code: '998711', description: 'Maintenance and repair of fabricated metal products', chapter: '99', defaultRate: 1800 },
  { code: '998721', description: 'Repair services of footwear and leather goods', chapter: '99', defaultRate: 1800 },
  { code: '998723', description: 'Repair of household appliances and home equipment', chapter: '99', defaultRate: 1800 },
  { code: '999293', description: 'Commercial training and coaching services', chapter: '99', defaultRate: 1800 },
  { code: '997331', description: 'Licensing services for the right to use software', chapter: '99', defaultRate: 1800 },
  { code: '996819', description: 'Other courier and delivery services', chapter: '99', defaultRate: 1800 },
  { code: '998212', description: 'Legal documentation and certification services', chapter: '99', defaultRate: 1800 },
  { code: '998222', description: 'Accounting, bookkeeping and auditing services', chapter: '99', defaultRate: 1800 },
  { code: '998511', description: 'Recruitment and HR / staffing services', chapter: '99', defaultRate: 1800 },
  { code: '996111', description: 'Wholesale trade services on a fee/commission basis', chapter: '99', defaultRate: 1800 },
]
