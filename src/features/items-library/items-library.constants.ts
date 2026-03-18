/** Items Library — Constants & seed data */

import type { LibraryCategory, LibraryItem } from './items-library.types'

export const LIBRARY_CATEGORIES: LibraryCategory[] = [
  { id: 'grocery', name: 'Grocery & FMCG', icon: 'ShoppingCart', itemCount: 25 },
  { id: 'dairy', name: 'Dairy Products', icon: 'Milk', itemCount: 12 },
  { id: 'hardware', name: 'Hardware & Tools', icon: 'Wrench', itemCount: 15 },
  { id: 'electronics', name: 'Electronics', icon: 'Smartphone', itemCount: 10 },
  { id: 'textiles', name: 'Textiles & Garments', icon: 'Shirt', itemCount: 14 },
  { id: 'stationery', name: 'Stationery & Office', icon: 'Pen', itemCount: 12 },
  { id: 'medical', name: 'Medical & Pharma', icon: 'Pill', itemCount: 10 },
  { id: 'auto', name: 'Auto Parts', icon: 'Car', itemCount: 10 },
  { id: 'food', name: 'Food & Beverages', icon: 'UtensilsCrossed', itemCount: 15 },
  { id: 'building', name: 'Building Materials', icon: 'Building2', itemCount: 12 },
]

/** Seed data — common Indian products with HSN codes and units */
export const SEED_ITEMS: LibraryItem[] = [
  // Grocery & FMCG
  { id: 'g1', name: 'Rice (Basmati)', category: 'grocery', hsn: '1006', unit: 'KG', suggestedRate: 0 },
  { id: 'g2', name: 'Wheat Flour (Atta)', category: 'grocery', hsn: '1101', unit: 'KG', suggestedRate: 0 },
  { id: 'g3', name: 'Sugar', category: 'grocery', hsn: '1701', unit: 'KG', suggestedRate: 0 },
  { id: 'g4', name: 'Cooking Oil (Mustard)', category: 'grocery', hsn: '1514', unit: 'LTR', suggestedRate: 0 },
  { id: 'g5', name: 'Cooking Oil (Sunflower)', category: 'grocery', hsn: '1512', unit: 'LTR', suggestedRate: 0 },
  { id: 'g6', name: 'Toor Dal', category: 'grocery', hsn: '0713', unit: 'KG', suggestedRate: 0 },
  { id: 'g7', name: 'Moong Dal', category: 'grocery', hsn: '0713', unit: 'KG', suggestedRate: 0 },
  { id: 'g8', name: 'Chana Dal', category: 'grocery', hsn: '0713', unit: 'KG', suggestedRate: 0 },
  { id: 'g9', name: 'Salt (Iodised)', category: 'grocery', hsn: '2501', unit: 'KG', suggestedRate: 0 },
  { id: 'g10', name: 'Tea Leaves', category: 'grocery', hsn: '0902', unit: 'KG', suggestedRate: 0 },
  { id: 'g11', name: 'Coffee Powder', category: 'grocery', hsn: '0901', unit: 'KG', suggestedRate: 0 },
  { id: 'g12', name: 'Detergent Powder', category: 'grocery', hsn: '3402', unit: 'KG', suggestedRate: 0 },
  { id: 'g13', name: 'Soap (Bathing)', category: 'grocery', hsn: '3401', unit: 'PCS', suggestedRate: 0 },
  { id: 'g14', name: 'Shampoo', category: 'grocery', hsn: '3305', unit: 'PCS', suggestedRate: 0 },
  { id: 'g15', name: 'Toothpaste', category: 'grocery', hsn: '3306', unit: 'PCS', suggestedRate: 0 },
  { id: 'g16', name: 'Biscuits', category: 'grocery', hsn: '1905', unit: 'PKT', suggestedRate: 0 },
  { id: 'g17', name: 'Noodles (Instant)', category: 'grocery', hsn: '1902', unit: 'PKT', suggestedRate: 0 },
  { id: 'g18', name: 'Chips/Namkeen', category: 'grocery', hsn: '2106', unit: 'PKT', suggestedRate: 0 },
  { id: 'g19', name: 'Turmeric Powder', category: 'grocery', hsn: '0910', unit: 'KG', suggestedRate: 0 },
  { id: 'g20', name: 'Red Chilli Powder', category: 'grocery', hsn: '0904', unit: 'KG', suggestedRate: 0 },
  { id: 'g21', name: 'Cumin Seeds (Jeera)', category: 'grocery', hsn: '0909', unit: 'KG', suggestedRate: 0 },
  { id: 'g22', name: 'Coriander Powder', category: 'grocery', hsn: '0909', unit: 'KG', suggestedRate: 0 },
  { id: 'g23', name: 'Ghee', category: 'grocery', hsn: '0405', unit: 'KG', suggestedRate: 0 },
  { id: 'g24', name: 'Paneer', category: 'grocery', hsn: '0406', unit: 'KG', suggestedRate: 0 },
  { id: 'g25', name: 'Curd/Dahi', category: 'grocery', hsn: '0403', unit: 'KG', suggestedRate: 0 },

  // Dairy Products
  { id: 'd1', name: 'Full Cream Milk', category: 'dairy', hsn: '0401', unit: 'LTR', suggestedRate: 0 },
  { id: 'd2', name: 'Toned Milk', category: 'dairy', hsn: '0401', unit: 'LTR', suggestedRate: 0 },
  { id: 'd3', name: 'Double Toned Milk', category: 'dairy', hsn: '0401', unit: 'LTR', suggestedRate: 0 },
  { id: 'd4', name: 'Butter', category: 'dairy', hsn: '0405', unit: 'KG', suggestedRate: 0 },
  { id: 'd5', name: 'Cheese', category: 'dairy', hsn: '0406', unit: 'KG', suggestedRate: 0 },
  { id: 'd6', name: 'Buttermilk (Chaas)', category: 'dairy', hsn: '0403', unit: 'LTR', suggestedRate: 0 },
  { id: 'd7', name: 'Cream', category: 'dairy', hsn: '0401', unit: 'LTR', suggestedRate: 0 },
  { id: 'd8', name: 'Skimmed Milk Powder', category: 'dairy', hsn: '0402', unit: 'KG', suggestedRate: 0 },
  { id: 'd9', name: 'Flavoured Milk', category: 'dairy', hsn: '0401', unit: 'LTR', suggestedRate: 0 },
  { id: 'd10', name: 'Lassi', category: 'dairy', hsn: '0403', unit: 'LTR', suggestedRate: 0 },
  { id: 'd11', name: 'Ice Cream', category: 'dairy', hsn: '2105', unit: 'LTR', suggestedRate: 0 },
  { id: 'd12', name: 'Khoya/Mawa', category: 'dairy', hsn: '0402', unit: 'KG', suggestedRate: 0 },

  // Hardware & Tools
  { id: 'h1', name: 'Cement (OPC 43)', category: 'hardware', hsn: '2523', unit: 'BAG', suggestedRate: 0 },
  { id: 'h2', name: 'TMT Steel Bar', category: 'hardware', hsn: '7213', unit: 'KG', suggestedRate: 0 },
  { id: 'h3', name: 'PVC Pipe', category: 'hardware', hsn: '3917', unit: 'MTR', suggestedRate: 0 },
  { id: 'h4', name: 'Electrical Wire', category: 'hardware', hsn: '8544', unit: 'MTR', suggestedRate: 0 },
  { id: 'h5', name: 'Paint (Interior)', category: 'hardware', hsn: '3209', unit: 'LTR', suggestedRate: 0 },
  { id: 'h6', name: 'Paint (Exterior)', category: 'hardware', hsn: '3209', unit: 'LTR', suggestedRate: 0 },
  { id: 'h7', name: 'Sand', category: 'hardware', hsn: '2505', unit: 'CFT', suggestedRate: 0 },
  { id: 'h8', name: 'Bricks', category: 'hardware', hsn: '6901', unit: 'PCS', suggestedRate: 0 },
  { id: 'h9', name: 'Door Lock', category: 'hardware', hsn: '8301', unit: 'PCS', suggestedRate: 0 },
  { id: 'h10', name: 'Nails', category: 'hardware', hsn: '7317', unit: 'KG', suggestedRate: 0 },
  { id: 'h11', name: 'Screws', category: 'hardware', hsn: '7318', unit: 'PKT', suggestedRate: 0 },
  { id: 'h12', name: 'Plywood', category: 'hardware', hsn: '4412', unit: 'SFT', suggestedRate: 0 },
  { id: 'h13', name: 'Glass Sheet', category: 'hardware', hsn: '7005', unit: 'SFT', suggestedRate: 0 },
  { id: 'h14', name: 'Tiles (Floor)', category: 'hardware', hsn: '6908', unit: 'SFT', suggestedRate: 0 },
  { id: 'h15', name: 'Adhesive (Fevicol)', category: 'hardware', hsn: '3506', unit: 'KG', suggestedRate: 0 },

  // Stationery & Office
  { id: 's1', name: 'A4 Paper (Ream)', category: 'stationery', hsn: '4802', unit: 'PKT', suggestedRate: 0 },
  { id: 's2', name: 'Ball Pen', category: 'stationery', hsn: '9608', unit: 'PCS', suggestedRate: 0 },
  { id: 's3', name: 'Notebook', category: 'stationery', hsn: '4820', unit: 'PCS', suggestedRate: 0 },
  { id: 's4', name: 'Stapler', category: 'stationery', hsn: '8305', unit: 'PCS', suggestedRate: 0 },
  { id: 's5', name: 'Stapler Pins', category: 'stationery', hsn: '8305', unit: 'PKT', suggestedRate: 0 },
  { id: 's6', name: 'Envelope', category: 'stationery', hsn: '4817', unit: 'PKT', suggestedRate: 0 },
  { id: 's7', name: 'File Folder', category: 'stationery', hsn: '4819', unit: 'PCS', suggestedRate: 0 },
  { id: 's8', name: 'Whiteboard Marker', category: 'stationery', hsn: '9608', unit: 'PCS', suggestedRate: 0 },
  { id: 's9', name: 'Printer Ink/Toner', category: 'stationery', hsn: '3215', unit: 'PCS', suggestedRate: 0 },
  { id: 's10', name: 'Calculator', category: 'stationery', hsn: '8470', unit: 'PCS', suggestedRate: 0 },
  { id: 's11', name: 'Scissors', category: 'stationery', hsn: '8213', unit: 'PCS', suggestedRate: 0 },
  { id: 's12', name: 'Tape (Cello)', category: 'stationery', hsn: '3919', unit: 'PCS', suggestedRate: 0 },
]

export const ITEMS_PER_PAGE = 20
