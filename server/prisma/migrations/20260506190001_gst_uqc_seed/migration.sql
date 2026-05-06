-- GST Phase 2 — UQC (Unit Quantity Code) master seed
-- Architecture §1.1: idempotent INSERT ... ON CONFLICT DO NOTHING
-- Inserts chapter-representative HSN codes with correct UQC per CGST Notification 12/2017.
-- Safe to re-run: ON CONFLICT (code) DO NOTHING preserves any rows already present.
-- UQC codes: NOS=Numbers, KGS=Kilograms, LTR=Litres, MTR=Metres, SQM=Square Metres,
--            TON=Tonnes, CBM=Cubic Metres, GMS=Grams, KLR=Kilolitres

INSERT INTO "HsnCode" (code, description, chapter, "defaultRate", "cessApplicable", "cessRate", uqc)
VALUES
  -- Chapter 01 — Live animals (NOS)
  ('0101', 'Live horses, asses, mules and hinnies', '01', 0, false, 0, 'NOS'),
  ('0102', 'Live bovine animals', '01', 0, false, 0, 'NOS'),
  ('0103', 'Live swine', '01', 500, false, 0, 'NOS'),
  ('0104', 'Live sheep and goats', '01', 0, false, 0, 'NOS'),
  ('0105', 'Live poultry', '01', 0, false, 0, 'NOS'),
  -- Chapter 02 — Meat (KGS)
  ('0201', 'Meat of bovine animals, fresh or chilled', '02', 0, false, 0, 'KGS'),
  ('0202', 'Meat of bovine animals, frozen', '02', 0, false, 0, 'KGS'),
  ('0203', 'Meat of swine, fresh, chilled or frozen', '02', 1200, false, 0, 'KGS'),
  ('0204', 'Meat of sheep or goats, fresh, chilled or frozen', '02', 0, false, 0, 'KGS'),
  ('0207', 'Meat and edible offal of poultry', '02', 1200, false, 0, 'KGS'),
  -- Chapter 03 — Fish (KGS)
  ('0301', 'Live fish', '03', 0, false, 0, 'KGS'),
  ('0302', 'Fish, fresh or chilled', '03', 500, false, 0, 'KGS'),
  ('0303', 'Fish, frozen', '03', 500, false, 0, 'KGS'),
  ('0304', 'Fish fillets and other fish meat', '03', 1200, false, 0, 'KGS'),
  ('0305', 'Fish, dried, salted or in brine; smoked fish', '03', 500, false, 0, 'KGS'),
  -- Chapter 04 — Dairy (KGS)
  ('0401', 'Milk and cream, not concentrated', '04', 0, false, 0, 'KGS'),
  ('0402', 'Milk and cream, concentrated or sweetened', '04', 500, false, 0, 'KGS'),
  ('0403', 'Buttermilk, curdled milk and cream, yogurt', '04', 500, false, 0, 'KGS'),
  ('0405', 'Butter and other fats and oils derived from milk', '04', 1200, false, 0, 'KGS'),
  ('0406', 'Cheese and curd', '04', 1200, false, 0, 'KGS'),
  -- Chapter 07 — Vegetables (KGS)
  ('0701', 'Potatoes, fresh or chilled', '07', 0, false, 0, 'KGS'),
  ('0702', 'Tomatoes, fresh or chilled', '07', 0, false, 0, 'KGS'),
  ('0703', 'Onions, shallots, garlic, leeks', '07', 0, false, 0, 'KGS'),
  ('0706', 'Carrots, turnips, salad beetroot, radishes', '07', 0, false, 0, 'KGS'),
  ('0709', 'Other vegetables, fresh or chilled', '07', 0, false, 0, 'KGS'),
  -- Chapter 08 — Fruits (KGS)
  ('0801', 'Coconuts, Brazil nuts and cashew nuts', '08', 500, false, 0, 'KGS'),
  ('0803', 'Bananas, fresh or dried', '08', 0, false, 0, 'KGS'),
  ('0804', 'Dates, figs, pineapples, avocados, mangoes', '08', 1200, false, 0, 'KGS'),
  ('0805', 'Citrus fruit, fresh or dried', '08', 1200, false, 0, 'KGS'),
  ('0806', 'Grapes, fresh or dried', '08', 1200, false, 0, 'KGS'),
  -- Chapter 09 — Spices (KGS)
  ('0901', 'Coffee', '09', 500, false, 0, 'KGS'),
  ('0902', 'Tea', '09', 500, false, 0, 'KGS'),
  ('0904', 'Pepper', '09', 500, false, 0, 'KGS'),
  ('0907', 'Cloves', '09', 500, false, 0, 'KGS'),
  ('0910', 'Ginger, saffron, turmeric, thyme, bay leaves', '09', 500, false, 0, 'KGS'),
  -- Chapter 10 — Cereals (KGS)
  ('1001', 'Wheat and meslin', '10', 0, false, 0, 'KGS'),
  ('1002', 'Rye', '10', 0, false, 0, 'KGS'),
  ('1006', 'Rice', '10', 500, false, 0, 'KGS'),
  ('1007', 'Grain sorghum', '10', 0, false, 0, 'KGS'),
  ('1008', 'Buckwheat, millet, canary seed; other cereals', '10', 0, false, 0, 'KGS'),
  -- Chapter 17 — Sugars (KGS)
  ('1701', 'Cane or beet sugar and chemically pure sucrose', '17', 500, false, 0, 'KGS'),
  ('1702', 'Other sugars', '17', 1800, false, 0, 'KGS'),
  ('1704', 'Sugar confectionery (not containing cocoa)', '17', 1800, false, 0, 'KGS'),
  -- Chapter 18 — Cocoa (KGS)
  ('1801', 'Cocoa beans', '18', 500, false, 0, 'KGS'),
  ('1805', 'Cocoa powder, not containing added sugar', '18', 500, false, 0, 'KGS'),
  ('1806', 'Chocolate and other food preparations containing cocoa', '18', 1800, false, 0, 'KGS'),
  -- Chapter 22 — Beverages (LTR)
  ('2201', 'Waters, ice and snow', '22', 1800, false, 0, 'LTR'),
  ('2202', 'Waters, including mineral waters and aerated waters, with sugar', '22', 2800, true, 1200, 'LTR'),
  ('2203', 'Beer made from malt', '22', 2800, true, 0, 'LTR'),
  ('2204', 'Wine of fresh grapes', '22', 2800, false, 0, 'LTR'),
  ('2207', 'Ethyl alcohol, undenatured, of alcoholic strength >= 80%', '22', 1800, false, 0, 'LTR'),
  -- Chapter 25 — Salt, stone (TON)
  ('2501', 'Salt, sodium chloride', '25', 0, false, 0, 'TON'),
  ('2504', 'Natural graphite', '25', 500, false, 0, 'TON'),
  ('2507', 'Kaolin and other kaolinic clays', '25', 0, false, 0, 'TON'),
  ('2517', 'Pebbles, gravel, broken or crushed stone', '25', 500, false, 0, 'TON'),
  ('2523', 'Portland cement, aluminous cement, slag cement', '25', 2800, false, 0, 'TON'),
  -- Chapter 27 — Mineral fuels (KLR)
  ('2701', 'Coal; briquettes, ovoids from coal', '27', 500, false, 0, 'TON'),
  ('2709', 'Petroleum oils and oils obtained from bituminous minerals, crude', '27', 0, false, 0, 'KLR'),
  ('2710', 'Petroleum oils, not crude', '27', 1800, false, 0, 'KLR'),
  ('2711', 'Petroleum gas and other gaseous hydrocarbons', '27', 500, false, 0, 'KGS'),
  -- Chapter 28 — Inorganic chemicals (KGS)
  ('2801', 'Fluorine, chlorine, bromine and iodine', '28', 1800, false, 0, 'KGS'),
  ('2814', 'Ammonia, anhydrous or in aqueous solution', '28', 1800, false, 0, 'KGS'),
  ('2836', 'Carbonates', '28', 1800, false, 0, 'KGS'),
  -- Chapter 29 — Organic chemicals (KGS)
  ('2901', 'Acyclic hydrocarbons', '29', 1800, false, 0, 'KGS'),
  ('2905', 'Acyclic alcohols and their halogenated, sulphonated, etc. derivatives', '29', 1800, false, 0, 'KGS'),
  -- Chapter 30 — Pharmaceuticals (NOS)
  ('3001', 'Glands and other organs for organo-therapeutic uses', '30', 1200, false, 0, 'NOS'),
  ('3002', 'Human blood; animal blood for therapeutic, prophylactic or diagnostic uses', '30', 1200, false, 0, 'NOS'),
  ('3003', 'Medicaments (not in measured doses)', '30', 1200, false, 0, 'NOS'),
  ('3004', 'Medicaments (in measured doses)', '30', 1200, false, 0, 'NOS'),
  ('3005', 'Wadding, gauze, bandages used in medicine', '30', 1200, false, 0, 'NOS'),
  -- Chapter 39 — Plastics (KGS)
  ('3901', 'Polymers of ethylene, in primary forms', '39', 1800, false, 0, 'KGS'),
  ('3902', 'Polymers of propylene, in primary forms', '39', 1800, false, 0, 'KGS'),
  ('3926', 'Other articles of plastics', '39', 1800, false, 0, 'KGS'),
  -- Chapter 44 — Wood (CBM)
  ('4401', 'Fuel wood, in logs, billets, twigs, faggots', '44', 0, false, 0, 'CBM'),
  ('4403', 'Wood in the rough', '44', 1800, false, 0, 'CBM'),
  ('4407', 'Wood sawn or chipped lengthwise, sliced or peeled', '44', 1800, false, 0, 'CBM'),
  ('4418', 'Builders'' joinery and carpentry of wood', '44', 1800, false, 0, 'CBM'),
  -- Chapter 48 — Paper (KGS)
  ('4801', 'Newsprint, in rolls or sheets', '48', 500, false, 0, 'KGS'),
  ('4802', 'Uncoated paper and paperboard', '48', 1800, false, 0, 'KGS'),
  ('4804', 'Uncoated kraft paper and paperboard', '48', 1200, false, 0, 'KGS'),
  ('4811', 'Paper, paperboard, coated, impregnated or surface-covered', '48', 1800, false, 0, 'KGS'),
  -- Chapter 52 — Cotton (KGS)
  ('5201', 'Cotton, not carded or combed', '52', 500, false, 0, 'KGS'),
  ('5205', 'Cotton yarn (not sewing thread)', '52', 500, false, 0, 'KGS'),
  ('5208', 'Woven fabrics of cotton, >= 85% cotton, <= 200 g/m²', '52', 500, false, 0, 'MTR'),
  ('5209', 'Woven fabrics of cotton, >= 85% cotton, > 200 g/m²', '52', 500, false, 0, 'MTR'),
  -- Chapter 57 — Carpets (SQM)
  ('5701', 'Carpets and other textile floor coverings, knotted', '57', 1200, false, 0, 'SQM'),
  ('5702', 'Carpets and other textile floor coverings, woven', '57', 1200, false, 0, 'SQM'),
  ('5703', 'Carpets and other textile floor coverings, tufted', '57', 1200, false, 0, 'SQM'),
  -- Chapter 61 — Knitted clothing (NOS)
  ('6101', 'Men''s or boys'' overcoats, car-coats, capes, cloaks, anoraks, ski-jackets (knitted)', '61', 1200, false, 0, 'NOS'),
  ('6109', 'T-shirts, singlets and other vests (knitted)', '61', 500, false, 0, 'NOS'),
  ('6110', 'Jerseys, pullovers, sweatshirts, waistcoats (knitted)', '61', 500, false, 0, 'NOS'),
  -- Chapter 62 — Not-knitted clothing (NOS)
  ('6201', 'Men''s or boys'' overcoats, car-coats (not knitted)', '62', 500, false, 0, 'NOS'),
  ('6205', 'Men''s or boys'' shirts (not knitted)', '62', 500, false, 0, 'NOS'),
  ('6206', 'Women''s or girls'' blouses, shirts (not knitted)', '62', 500, false, 0, 'NOS'),
  -- Chapter 64 — Footwear (NOS)
  ('6401', 'Waterproof footwear', '64', 1800, false, 0, 'NOS'),
  ('6402', 'Other footwear with outer soles and uppers of rubber or plastics', '64', 1800, false, 0, 'NOS'),
  ('6403', 'Footwear with outer soles of rubber, plastics, leather or composition leather', '64', 1800, false, 0, 'NOS'),
  -- Chapter 71 — Precious metals (GMS)
  ('7101', 'Pearls, natural or cultured', '71', 300, false, 0, 'GMS'),
  ('7102', 'Diamonds', '71', 0, false, 0, 'GMS'),
  ('7103', 'Precious stones (other than diamonds)', '71', 300, false, 0, 'GMS'),
  ('7106', 'Silver', '71', 300, false, 0, 'GMS'),
  ('7108', 'Gold', '71', 300, false, 0, 'GMS'),
  -- Chapter 72 — Iron and steel (TON)
  ('7201', 'Pig iron and spiegeleisen in pigs, blocks or other primary forms', '72', 1800, false, 0, 'TON'),
  ('7204', 'Ferrous waste and scrap', '72', 1800, false, 0, 'TON'),
  ('7208', 'Flat-rolled products of iron or non-alloy steel, hot-rolled', '72', 1800, false, 0, 'TON'),
  ('7210', 'Flat-rolled products of iron or non-alloy steel, coated', '72', 1800, false, 0, 'TON'),
  ('7213', 'Bars and rods, hot-rolled, in irregularly wound coils', '72', 1800, false, 0, 'TON'),
  -- Chapter 84 — Machinery (NOS)
  ('8401', 'Nuclear reactors; fuel elements for nuclear reactors; machinery for isotope separation', '84', 1800, false, 0, 'NOS'),
  ('8414', 'Air or vacuum pumps, air or other gas compressors', '84', 1800, false, 0, 'NOS'),
  ('8415', 'Air conditioning machines', '84', 2800, false, 0, 'NOS'),
  ('8418', 'Refrigerators, freezers and other refrigerating or freezing equipment', '84', 2800, false, 0, 'NOS'),
  ('8443', 'Printing machinery; machines for uses ancillary to printing', '84', 1800, false, 0, 'NOS'),
  ('8471', 'Automatic data processing machines (computers)', '84', 1800, false, 0, 'NOS'),
  -- Chapter 85 — Electrical machinery (NOS)
  ('8501', 'Electric motors and generators', '85', 1800, false, 0, 'NOS'),
  ('8504', 'Electrical transformers, static converters and inductors', '85', 1800, false, 0, 'NOS'),
  ('8517', 'Telephone sets, mobile phones', '85', 1800, false, 0, 'NOS'),
  ('8525', 'Transmission apparatus for radio-broadcasting or television', '85', 1800, false, 0, 'NOS'),
  ('8528', 'Monitors and projectors, television receivers', '85', 2800, false, 0, 'NOS'),
  -- Chapter 87 — Vehicles (NOS)
  ('8701', 'Tractors', '87', 1200, false, 0, 'NOS'),
  ('8703', 'Motor cars and other motor vehicles principally for transport of persons', '87', 2800, true, 1700, 'NOS'),
  ('8704', 'Motor vehicles for the transport of goods', '87', 2800, false, 0, 'NOS'),
  ('8711', 'Motorcycles (including mopeds)', '87', 2800, true, 200, 'NOS'),
  -- Chapter 90 — Optical instruments (NOS)
  ('9006', 'Photographic cameras', '90', 1800, false, 0, 'NOS'),
  ('9018', 'Instruments and appliances used in medical, surgical, dental or veterinary sciences', '90', 1200, false, 0, 'NOS'),
  ('9021', 'Orthopaedic appliances; artificial parts of body', '90', 1200, false, 0, 'NOS'),
  -- Chapter 94 — Furniture (NOS)
  ('9401', 'Seats (other than those of heading 9402), whether or not convertible', '94', 1800, false, 0, 'NOS'),
  ('9403', 'Other furniture and parts thereof', '94', 1800, false, 0, 'NOS'),
  ('9404', 'Mattress supports; mattresses, quilts, eiderdowns, pillows', '94', 1800, false, 0, 'NOS'),
  -- Chapter 95 — Toys (NOS)
  ('9503', 'Tricycles, scooters, pedal cars and similar wheeled toys; dolls'' carriages', '95', 1800, false, 0, 'NOS'),
  ('9504', 'Video game consoles and machines, articles for funfair, table or parlour games', '95', 2800, false, 0, 'NOS'),
  -- Chapter 99 — Services SAC codes (NOS)
  ('9954', 'Construction services', '99', 1800, false, 0, 'NOS'),
  ('9961', 'Services in wholesale trade', '99', 1800, false, 0, 'NOS'),
  ('9962', 'Services in retail trade', '99', 1800, false, 0, 'NOS'),
  ('9971', 'Financial and related services', '99', 1800, false, 0, 'NOS'),
  ('9972', 'Real estate services', '99', 1800, false, 0, 'NOS'),
  ('9973', 'Leasing or rental services', '99', 1800, false, 0, 'NOS'),
  ('9981', 'Research and development services', '99', 1800, false, 0, 'NOS'),
  ('9982', 'Legal and accounting services', '99', 1800, false, 0, 'NOS'),
  ('9983', 'Other professional, technical and business services', '99', 1800, false, 0, 'NOS'),
  ('9984', 'Telecommunications, broadcasting and information supply services', '99', 1800, false, 0, 'NOS'),
  ('9985', 'Support services', '99', 1800, false, 0, 'NOS'),
  ('9986', 'Agriculture, forestry, fishing related support services', '99', 0, false, 0, 'NOS'),
  ('9987', 'Maintenance, repair and installation (except construction) services', '99', 1800, false, 0, 'NOS'),
  ('9988', 'Manufacturing services on physical inputs (goods) owned by others', '99', 500, false, 0, 'NOS'),
  ('9989', 'Other manufacturing services; publishing, printing and reproduction services', '99', 1800, false, 0, 'NOS'),
  ('9991', 'Public administration and other services provided to the community', '99', 0, false, 0, 'NOS'),
  ('9992', 'Education services', '99', 0, false, 0, 'NOS'),
  ('9993', 'Human health and social care services', '99', 0, false, 0, 'NOS'),
  ('9994', 'Sewage and waste collection, treatment and disposal and other environmental protection services', '99', 1800, false, 0, 'NOS'),
  ('9995', 'Services of membership organisations', '99', 1800, false, 0, 'NOS'),
  ('9996', 'Recreational, cultural and sporting services', '99', 1800, false, 0, 'NOS'),
  ('9997', 'Other services', '99', 1800, false, 0, 'NOS'),
  ('9998', 'Domestic services', '99', 0, false, 0, 'NOS'),
  ('9999', 'Services provided by extraterritorial organisations and bodies', '99', 0, false, 0, 'NOS')
ON CONFLICT (code) DO NOTHING;

-- Update UQC for any rows already inserted without correct chapter mapping.
-- Idempotent: only sets uqc where it is still 'NOS' and the chapter has a non-NOS code.
-- Chapter-to-UQC mapping per CGST Notification 12/2017.
UPDATE "HsnCode" SET uqc = 'KGS' WHERE chapter IN ('02','03','04','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','23','24','28','29','31','32','33','34','35','36','38','40','45','46','47','48','50','51','52','53','54','55','56','63','73','74','75','76','78','79','80','81') AND uqc = 'NOS';
UPDATE "HsnCode" SET uqc = 'LTR' WHERE chapter IN ('22') AND uqc = 'NOS';
UPDATE "HsnCode" SET uqc = 'MTR' WHERE chapter IN ('58','59','60') AND uqc = 'NOS';
UPDATE "HsnCode" SET uqc = 'SQM' WHERE chapter IN ('41','57') AND uqc = 'NOS';
UPDATE "HsnCode" SET uqc = 'TON' WHERE chapter IN ('25','26','72') AND uqc = 'NOS';
UPDATE "HsnCode" SET uqc = 'CBM' WHERE chapter IN ('44') AND uqc = 'NOS';
UPDATE "HsnCode" SET uqc = 'GMS' WHERE chapter IN ('71') AND uqc = 'NOS';
UPDATE "HsnCode" SET uqc = 'KLR' WHERE chapter IN ('27') AND uqc = 'NOS';

-- DOWN (manual rollback reference — Prisma does not run this block)
-- DELETE FROM "HsnCode" WHERE code IN (
--   '0101','0102','0103','0104','0105','0201','0202','0203','0204','0207',
--   '0301','0302','0303','0304','0305','0401','0402','0403','0405','0406',
--   '0701','0702','0703','0706','0709','0801','0803','0804','0805','0806',
--   '0901','0902','0904','0907','0910','1001','1002','1006','1007','1008',
--   '1701','1702','1704','1801','1805','1806','2201','2202','2203','2204',
--   '2207','2501','2504','2507','2517','2523','2701','2709','2710','2711',
--   '2801','2814','2836','2901','2905','3001','3002','3003','3004','3005',
--   '3901','3902','3926','4401','4403','4407','4418','4801','4802','4804',
--   '4811','5201','5205','5208','5209','5701','5702','5703','6101','6109',
--   '6110','6201','6205','6206','6401','6402','6403','7101','7102','7103',
--   '7106','7108','7201','7204','7208','7210','7213','8401','8414','8415',
--   '8418','8443','8471','8501','8504','8517','8525','8528','8701','8703',
--   '8704','8711','9006','9018','9021','9401','9403','9404','9503','9504',
--   '9954','9961','9962','9971','9972','9973','9981','9982','9983','9984',
--   '9985','9986','9987','9988','9989','9991','9992','9993','9994','9995',
--   '9996','9997','9998','9999'
-- );
