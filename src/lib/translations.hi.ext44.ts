// Phase 7 #149 — Data Import 7.1C (FE invoice entity) — Hindi.

export const hiExt44 = {
  importEntityInvoices: 'इनवॉइस',
  importEntityInvoicesDesc: 'लाइन-आइटम के साथ बिक्री और खरीद इनवॉइस',

  importInvoiceBlockedTitle: 'प्रोडक्ट सूची में कुछ आइटम मौजूद नहीं हैं',
  importInvoiceBlockedDesc:
    'इन इनवॉइस में ऐसे SKU हैं जो आपकी प्रोडक्ट सूची में नहीं हैं। पहले उन प्रोडक्ट को इम्पोर्ट करें, फिर यहाँ वापस आकर इनवॉइस इम्पोर्ट पूरा करें।',
  importInvoiceBlockedCta: 'पहले प्रोडक्ट इम्पोर्ट करें',
  importInvoiceBlockedCancel: 'इम्पोर्ट रद्द करें',
  importInvoiceBlockedMissingSkusLabel: 'गुम SKU',

  importInvoiceLineMore: '+{count} और',
  importInvoiceTotals: 'कुल',
  importInvoiceSubtotal: 'उप-योग',
  importInvoiceTax: 'टैक्स (CGST + SGST + IGST)',
  importInvoiceGrandTotal: 'कुल योग',
  importInvoiceNoLines: 'इस इनवॉइस में कोई लाइन आइटम नहीं',
  importInvoiceNumberLabel: 'इनवॉइस #',
  importInvoiceDateLabel: 'दिनांक',
  importInvoicePartyLabel: 'पार्टी',

  importInvoicePartyExact: 'मौजूदा',
  importInvoicePartyFlyCreate: 'नई — स्वतः बनेगी',
  importInvoicePartyNameOnly: 'केवल नाम',
  importInvoicePartyNotFound: 'आपकी सूची में नहीं',

  importInvoiceProductMatched: 'मिला',
  importInvoiceProductByName: 'नाम से',
  importInvoiceProductMissing: 'SKU नहीं मिला',

  importInvoiceIssue_PARTY_AUTO_CREATED: 'पार्टी स्वतः बनेगी',
  importInvoiceIssue_PARTY_NAME_ONLY_MATCH:
    'केवल नाम से मिला — फ़ोन सत्यापित करें',
  importInvoiceIssue_PARTY_NOT_FOUND: 'पार्टी आपकी सूची में नहीं है',
  importInvoiceIssue_PRODUCT_NOT_FOUND: 'प्रोडक्ट SKU नहीं मिला',
  importInvoiceIssue_PRODUCT_AMBIGUOUS:
    'इस SKU से कई प्रोडक्ट मेल खाते हैं',
  importInvoiceIssue_AMOUNT_OUT_OF_RANGE:
    'राशि प्रति-इनवॉइस अधिकतम सीमा से अधिक है',
  importInvoiceIssue_AMOUNT_NEGATIVE:
    'नकारात्मक राशि — क्रेडिट-नोट प्रवाह उपयोग करें',
  importInvoiceIssue_INVALID_DATE: 'इनवॉइस दिनांक अमान्य है',
  importInvoiceIssue_TAX_MATH_MISMATCH:
    'टैक्स कुल लाइन योग से मेल नहीं खाता',
  importInvoiceIssue_HEADER_MISMATCH_WITHIN_INVOICE:
    'इस इनवॉइस की पंक्तियों में हेडर अलग है',
  importInvoiceIssue_LINES_PER_INVOICE_EXCEEDED:
    'इस इनवॉइस पर बहुत अधिक लाइन आइटम हैं',
  importInvoiceIssue_INTRA_FILE_DUPLICATE:
    'इस फ़ाइल में डुप्लिकेट इनवॉइस',
  importInvoiceIssue_DUPLICATE_INVOICE_NUMBER:
    'इनवॉइस नंबर आपकी किताबों में पहले से मौजूद है',
  importInvoiceIssue_INVOICE_NUMBER_REQUIRED: 'इनवॉइस नंबर गायब है',
  importInvoiceIssue_NO_LINES: 'इनवॉइस में कोई लाइन आइटम नहीं',
  importInvoiceIssue_DUPLICATE_EXACT: 'मौजूदा इनवॉइस का सटीक डुप्लिकेट',

  backToInvoiceImport: 'इनवॉइस इम्पोर्ट पर वापस जाएँ',
  backToInvoiceImportDesc:
    'जो इनवॉइस इम्पोर्ट आपने शुरू किया था उस पर वापस जाएँ — आपकी पंक्तियाँ अभी भी प्रतीक्षा में हैं।',

  importClientVersionUpgradeRequired:
    'इनवॉइस इम्पोर्ट करने के लिए कृपया ऐप अपडेट करें।',
} as const
