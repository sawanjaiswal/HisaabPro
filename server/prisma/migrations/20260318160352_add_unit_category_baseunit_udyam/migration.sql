-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'SUPER_ADMIN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "passwordHash" TEXT,
    "pinHash" TEXT,
    "biometricEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastFailedLoginAt" TIMESTAMP(3),
    "accountLockedUntil" TIMESTAMP(3),
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "suspendedAt" TIMESTAMP(3),
    "suspendedReason" TEXT,
    "referredBy" TEXT,
    "referralBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "referralBalanceInReview" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "referralTotalEarned" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "referralFraudFlags" INTEGER NOT NULL DEFAULT 0,
    "walletFrozen" BOOLEAN NOT NULL DEFAULT false,
    "lastReferralAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "logoUrl" TEXT,
    "businessType" TEXT NOT NULL DEFAULT 'general',
    "currencyCode" TEXT NOT NULL DEFAULT 'INR',
    "financialYearStart" INTEGER NOT NULL DEFAULT 4,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "udyamNumber" TEXT,
    "gstin" TEXT,
    "stateCode" TEXT,
    "compositionScheme" BOOLEAN NOT NULL DEFAULT false,
    "eInvoiceEnabled" BOOLEAN NOT NULL DEFAULT false,
    "eWayBillEnabled" BOOLEAN NOT NULL DEFAULT false,
    "turnoverSlab" TEXT,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessUser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "roleId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastActiveAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "deviceInfo" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyLog" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "rating" INTEGER,
    "screenshot" TEXT,
    "metadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "companyName" TEXT,
    "type" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "groupId" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "gstin" TEXT,
    "stateCode" TEXT,
    "gstinVerified" BOOLEAN NOT NULL DEFAULT false,
    "gstinVerifiedAt" TIMESTAMP(3),
    "compositionScheme" BOOLEAN NOT NULL DEFAULT false,
    "pan" TEXT,
    "creditLimit" INTEGER NOT NULL DEFAULT 0,
    "creditLimitMode" TEXT NOT NULL DEFAULT 'WARN',
    "outstandingBalance" INTEGER NOT NULL DEFAULT 0,
    "totalBusiness" INTEGER NOT NULL DEFAULT 0,
    "lastTransactionAt" TIMESTAMP(3),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyAddress" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Default',
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'BILLING',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyGroup" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFieldDefinition" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "required" BOOLEAN NOT NULL DEFAULT false,
    "showOnInvoice" BOOLEAN NOT NULL DEFAULT false,
    "entityType" TEXT NOT NULL DEFAULT 'PARTY',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomFieldDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyCustomFieldValue" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyCustomFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpeningBalance" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "asOfDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpeningBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyPricing" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "minQty" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyPricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CUSTOM',
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CUSTOM',
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "decimalAllowed" BOOLEAN NOT NULL DEFAULT true,
    "baseUnitId" TEXT,
    "baseUnitFactor" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitConversion" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "fromUnitId" TEXT NOT NULL,
    "toUnitId" TEXT NOT NULL,
    "factor" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitConversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "categoryId" TEXT,
    "unitId" TEXT NOT NULL,
    "salePrice" INTEGER NOT NULL DEFAULT 0,
    "purchasePrice" INTEGER,
    "currentStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minStockLevel" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stockValidation" TEXT NOT NULL DEFAULT 'GLOBAL',
    "hsnCode" TEXT,
    "sacCode" TEXT,
    "taxCategoryId" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "customReason" TEXT,
    "notes" TEXT,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "referenceNumber" TEXT,
    "movementDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCustomFieldValue" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCustomFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventorySetting" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "stockValidationMode" TEXT NOT NULL DEFAULT 'WARN_ONLY',
    "skuPrefix" TEXT NOT NULL DEFAULT 'PRD',
    "skuAutoGenerate" BOOLEAN NOT NULL DEFAULT true,
    "skuNextCounter" INTEGER NOT NULL DEFAULT 1,
    "lowStockAlertEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lowStockAlertFrequency" TEXT NOT NULL DEFAULT 'DAILY',
    "decimalPrecisionQty" INTEGER NOT NULL DEFAULT 2,
    "defaultCategoryId" TEXT,
    "defaultUnitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventorySetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "documentNumber" TEXT,
    "sequenceNumber" INTEGER,
    "financialYear" TEXT,
    "partyId" TEXT NOT NULL,
    "shippingAddressId" TEXT,
    "documentDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "paymentTerms" TEXT,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "totalDiscount" INTEGER NOT NULL DEFAULT 0,
    "totalAdditionalCharges" INTEGER NOT NULL DEFAULT 0,
    "roundOff" INTEGER NOT NULL DEFAULT 0,
    "grandTotal" INTEGER NOT NULL DEFAULT 0,
    "placeOfSupply" TEXT,
    "supplyType" TEXT NOT NULL DEFAULT 'B2B',
    "isReverseCharge" BOOLEAN NOT NULL DEFAULT false,
    "isComposite" BOOLEAN NOT NULL DEFAULT false,
    "totalTaxableValue" INTEGER NOT NULL DEFAULT 0,
    "totalCgst" INTEGER NOT NULL DEFAULT 0,
    "totalSgst" INTEGER NOT NULL DEFAULT 0,
    "totalIgst" INTEGER NOT NULL DEFAULT 0,
    "totalCess" INTEGER NOT NULL DEFAULT 0,
    "tdsRate" INTEGER NOT NULL DEFAULT 0,
    "tdsAmount" INTEGER NOT NULL DEFAULT 0,
    "tcsRate" INTEGER NOT NULL DEFAULT 0,
    "tcsAmount" INTEGER NOT NULL DEFAULT 0,
    "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "exchangeRate" INTEGER NOT NULL DEFAULT 100,
    "foreignCurrencyTotal" INTEGER NOT NULL DEFAULT 0,
    "totalCost" INTEGER NOT NULL DEFAULT 0,
    "totalProfit" INTEGER NOT NULL DEFAULT 0,
    "profitPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "termsAndConditions" TEXT,
    "includeSignature" BOOLEAN NOT NULL DEFAULT false,
    "vehicleNumber" TEXT,
    "driverName" TEXT,
    "transportNotes" TEXT,
    "sourceDocumentId" TEXT,
    "paidAmount" INTEGER NOT NULL DEFAULT 0,
    "balanceDue" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "permanentDeleteAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clientId" TEXT,
    "recurringInvoiceId" TEXT,
    "originalDocumentId" TEXT,
    "creditDebitReason" VARCHAR(500),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentLineItem" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "quantity" DOUBLE PRECISION NOT NULL,
    "rate" INTEGER NOT NULL,
    "discountType" TEXT NOT NULL DEFAULT 'AMOUNT',
    "discountValue" INTEGER NOT NULL DEFAULT 0,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "lineTotal" INTEGER NOT NULL DEFAULT 0,
    "taxCategoryId" TEXT,
    "hsnCode" TEXT,
    "sacCode" TEXT,
    "taxableValue" INTEGER NOT NULL DEFAULT 0,
    "cgstRate" INTEGER NOT NULL DEFAULT 0,
    "cgstAmount" INTEGER NOT NULL DEFAULT 0,
    "sgstRate" INTEGER NOT NULL DEFAULT 0,
    "sgstAmount" INTEGER NOT NULL DEFAULT 0,
    "igstRate" INTEGER NOT NULL DEFAULT 0,
    "igstAmount" INTEGER NOT NULL DEFAULT 0,
    "cessRate" INTEGER NOT NULL DEFAULT 0,
    "cessAmount" INTEGER NOT NULL DEFAULT 0,
    "purchasePrice" INTEGER NOT NULL DEFAULT 0,
    "profit" INTEGER NOT NULL DEFAULT 0,
    "profitPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stockBefore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stockAfter" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "DocumentLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentAdditionalCharge" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'FIXED',
    "value" INTEGER NOT NULL DEFAULT 0,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DocumentAdditionalCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentShareLog" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "recipientPhone" TEXT,
    "recipientEmail" TEXT,
    "fileUrl" TEXT,
    "fileSize" INTEGER,
    "message" TEXT,
    "sentBy" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentShareLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentNumberSeries" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT 'INV',
    "suffix" TEXT NOT NULL DEFAULT '',
    "separator" TEXT NOT NULL DEFAULT '-',
    "paddingDigits" INTEGER NOT NULL DEFAULT 3,
    "currentSequence" INTEGER NOT NULL DEFAULT 0,
    "startingNumber" INTEGER NOT NULL DEFAULT 1,
    "resetOnNewYear" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentNumberSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigitalSignature" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "autoApply" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DigitalSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermsAndConditionsTemplate" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "appliesTo" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TermsAndConditionsTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentSettings" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "defaultPaymentTerms" TEXT NOT NULL DEFAULT 'COD',
    "roundOffTo" TEXT NOT NULL DEFAULT 'NEAREST_1',
    "showProfitDuringBilling" BOOLEAN NOT NULL DEFAULT true,
    "allowFutureDates" BOOLEAN NOT NULL DEFAULT false,
    "transactionLockDays" INTEGER NOT NULL DEFAULT 0,
    "recycleBinRetentionDays" INTEGER NOT NULL DEFAULT 30,
    "autoShareOnSave" BOOLEAN NOT NULL DEFAULT false,
    "autoShareChannel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "autoShareFormat" TEXT NOT NULL DEFAULT 'PDF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "offlineId" TEXT,
    "businessId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "mode" TEXT NOT NULL,
    "referenceNumber" VARCHAR(100),
    "notes" VARCHAR(500),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentDiscount" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "calculatedAmount" INTEGER NOT NULL,
    "reason" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReminder" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "message" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "failureReason" VARCHAR(500),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "isAutomatic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderConfig" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "autoRemindEnabled" BOOLEAN NOT NULL DEFAULT false,
    "frequencyDays" INTEGER[] DEFAULT ARRAY[1, 3, 7]::INTEGER[],
    "maxRemindersPerInvoice" INTEGER NOT NULL DEFAULT 5,
    "defaultChannel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "quietHoursStart" TEXT NOT NULL DEFAULT '21:00',
    "quietHoursEnd" TEXT NOT NULL DEFAULT '09:00',
    "whatsappTemplate" TEXT,
    "smsTemplate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffInvite" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionLockConfig" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "lockAfterDays" INTEGER,
    "requireApprovalForEdit" BOOLEAN NOT NULL DEFAULT false,
    "requireApprovalForDelete" BOOLEAN NOT NULL DEFAULT false,
    "priceChangeThresholdPercent" DOUBLE PRECISION,
    "discountThresholdPercent" DOUBLE PRECISION,
    "operationPinHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionLockConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "requestedChanges" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityLabel" TEXT,
    "userId" TEXT NOT NULL,
    "changes" JSONB,
    "reason" TEXT,
    "ipAddress" TEXT,
    "deviceInfo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "totalReferrals" INTEGER NOT NULL DEFAULT 0,
    "successfulRewards" INTEGER NOT NULL DEFAULT 0,
    "totalEarned" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralEvent" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventData" JSONB,
    "ipAddress" TEXT,
    "deviceFingerprint" TEXT,
    "userAgent" TEXT,
    "isSuspicious" BOOLEAN NOT NULL DEFAULT false,
    "suspiciousReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralReward" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL,
    "eligibleAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "clawedBackAt" TIMESTAMP(3),
    "clawBackReason" TEXT,
    "withdrawalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralWithdrawal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "upiId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "statusReason" TEXT,
    "autoApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "transactionId" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAppSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dateFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
    "pinEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pinHash" TEXT,
    "pinAttempts" INTEGER NOT NULL DEFAULT 0,
    "pinLockedUntil" TIMESTAMP(3),
    "biometricEnabled" BOOLEAN NOT NULL DEFAULT false,
    "calculatorPosition" TEXT NOT NULL DEFAULT 'BOTTOM_RIGHT',
    "language" TEXT NOT NULL DEFAULT 'en',
    "theme" TEXT NOT NULL DEFAULT 'light',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "accountLockedUntil" TIMESTAMP(3),
    "lastFailedLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAction" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSuspension" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "suspendedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "suspendedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liftedAt" TIMESTAMP(3),
    "liftedBy" TEXT,
    "liftNotes" TEXT,

    CONSTRAINT "UserSuspension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxCategory" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" INTEGER NOT NULL DEFAULT 0,
    "cessRate" INTEGER NOT NULL DEFAULT 0,
    "cessType" TEXT NOT NULL DEFAULT 'PERCENTAGE',
    "hsnCode" TEXT,
    "sacCode" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HsnCode" (
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "chapter" TEXT,
    "defaultRate" INTEGER NOT NULL DEFAULT 0,
    "cessApplicable" BOOLEAN NOT NULL DEFAULT false,
    "cessRate" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HsnCode_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "EInvoice" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "irn" TEXT NOT NULL,
    "ackNumber" TEXT NOT NULL,
    "ackDate" TIMESTAMP(3) NOT NULL,
    "qrCodeData" TEXT NOT NULL,
    "signedInvoice" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "rawResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EWayBill" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "ewbNumber" TEXT NOT NULL,
    "ewbDate" TIMESTAMP(3) NOT NULL,
    "validUpto" TIMESTAMP(3) NOT NULL,
    "transportMode" TEXT NOT NULL DEFAULT 'ROAD',
    "transporterId" TEXT,
    "transporterName" TEXT,
    "vehicleNumber" TEXT,
    "vehicleType" TEXT,
    "distance" INTEGER NOT NULL DEFAULT 0,
    "fromPincode" TEXT NOT NULL,
    "toPincode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "partBUpdates" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EWayBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GstReturn" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "returnType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "filedAt" TIMESTAMP(3),
    "jsonData" JSONB,
    "summary" JSONB,
    "invoiceCount" INTEGER NOT NULL DEFAULT 0,
    "totalTaxableValue" INTEGER NOT NULL DEFAULT 0,
    "totalTax" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GstReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GstReconciliation" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "reconType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalInvoices" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "mismatchedCount" INTEGER NOT NULL DEFAULT 0,
    "missingInGstrCount" INTEGER NOT NULL DEFAULT 0,
    "extraInGstrCount" INTEGER NOT NULL DEFAULT 0,
    "totalBookValue" INTEGER NOT NULL DEFAULT 0,
    "totalGstrValue" INTEGER NOT NULL DEFAULT 0,
    "differenceValue" INTEGER NOT NULL DEFAULT 0,
    "gstrData" JSONB,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GstReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GstReconciliationEntry" (
    "id" TEXT NOT NULL,
    "reconciliationId" TEXT NOT NULL,
    "documentId" TEXT,
    "documentNumber" TEXT,
    "documentDate" TIMESTAMP(3),
    "partyGstin" VARCHAR(15),
    "partyName" TEXT,
    "bookTaxableValue" INTEGER NOT NULL DEFAULT 0,
    "bookTaxAmount" INTEGER NOT NULL DEFAULT 0,
    "gstrInvoiceNumber" TEXT,
    "gstrInvoiceDate" TIMESTAMP(3),
    "gstrTaxableValue" INTEGER NOT NULL DEFAULT 0,
    "gstrTaxAmount" INTEGER NOT NULL DEFAULT 0,
    "matchStatus" TEXT NOT NULL,
    "taxableValueDiff" INTEGER NOT NULL DEFAULT 0,
    "taxAmountDiff" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GstReconciliationEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringInvoice" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "templateDocumentId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "nextRunDate" TIMESTAMP(3) NOT NULL,
    "dayOfMonth" INTEGER,
    "dayOfWeek" INTEGER,
    "autoSend" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "generatedCount" INTEGER NOT NULL DEFAULT 0,
    "lastGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "fromCurrency" VARCHAR(3) NOT NULL,
    "toCurrency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "rate" INTEGER NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerAccount" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subType" TEXT,
    "parentId" TEXT,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "bankAccountId" TEXT,
    "partyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "entryNumber" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "narration" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sourceType" TEXT,
    "sourceId" TEXT,
    "sourceNumber" TEXT,
    "totalDebit" INTEGER NOT NULL DEFAULT 0,
    "totalCredit" INTEGER NOT NULL DEFAULT 0,
    "voidedAt" TIMESTAMP(3),
    "voidedBy" TEXT,
    "voidReason" TEXT,
    "createdBy" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntryLine" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "debit" INTEGER NOT NULL DEFAULT 0,
    "credit" INTEGER NOT NULL DEFAULT 0,
    "narration" TEXT,
    "partyId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntryLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "ifscCode" TEXT,
    "branchName" TEXT,
    "accountType" TEXT NOT NULL DEFAULT 'CURRENT',
    "openingBalance" INTEGER NOT NULL DEFAULT 0,
    "currentBalance" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "paymentMode" TEXT NOT NULL,
    "bankAccountId" TEXT,
    "partyId" TEXT,
    "referenceNumber" VARCHAR(100),
    "notes" TEXT,
    "receiptUrl" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "gstApplicable" BOOLEAN NOT NULL DEFAULT false,
    "gstRate" INTEGER NOT NULL DEFAULT 0,
    "gstAmount" INTEGER NOT NULL DEFAULT 0,
    "journalEntryId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtherIncome" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "paymentMode" TEXT NOT NULL,
    "bankAccountId" TEXT,
    "partyId" TEXT,
    "referenceNumber" VARCHAR(100),
    "notes" TEXT,
    "journalEntryId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtherIncome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cheque" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "chequeNumber" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "partyId" TEXT,
    "amount" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "clearanceDate" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "bounceCharges" INTEGER NOT NULL DEFAULT 0,
    "bounceReason" TEXT,
    "referenceNumber" VARCHAR(100),
    "notes" TEXT,
    "journalEntryId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cheque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanAccount" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "partyId" TEXT,
    "loanName" TEXT NOT NULL,
    "principalAmount" INTEGER NOT NULL,
    "interestRate" INTEGER NOT NULL DEFAULT 0,
    "tenure" INTEGER,
    "emiAmount" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "outstandingAmount" INTEGER NOT NULL DEFAULT 0,
    "totalInterestPaid" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "journalEntryId" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanTransaction" (
    "id" TEXT NOT NULL,
    "loanAccountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "principalAmount" INTEGER NOT NULL DEFAULT 0,
    "interestAmount" INTEGER NOT NULL DEFAULT 0,
    "date" TIMESTAMP(3) NOT NULL,
    "journalEntryId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialYearClosure" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL,
    "closedBy" TEXT NOT NULL,
    "retainedEarnings" INTEGER NOT NULL DEFAULT 0,
    "journalEntryId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CLOSED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialYearClosure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_referredBy_idx" ON "User"("referredBy");

-- CreateIndex
CREATE INDEX "User_referralFraudFlags_idx" ON "User"("referralFraudFlags");

-- CreateIndex
CREATE INDEX "User_lastReferralAt_idx" ON "User"("lastReferralAt");

-- CreateIndex
CREATE INDEX "Business_name_idx" ON "Business"("name");

-- CreateIndex
CREATE INDEX "BusinessUser_businessId_idx" ON "BusinessUser"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessUser_userId_businessId_key" ON "BusinessUser"("userId", "businessId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "OtpCode_phone_verified_idx" ON "OtpCode"("phone", "verified");

-- CreateIndex
CREATE INDEX "OtpCode_expiresAt_idx" ON "OtpCode"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyLog_key_key" ON "IdempotencyLog"("key");

-- CreateIndex
CREATE INDEX "IdempotencyLog_expiresAt_idx" ON "IdempotencyLog"("expiresAt");

-- CreateIndex
CREATE INDEX "Feedback_userId_idx" ON "Feedback"("userId");

-- CreateIndex
CREATE INDEX "Feedback_status_idx" ON "Feedback"("status");

-- CreateIndex
CREATE INDEX "Party_businessId_type_isActive_idx" ON "Party"("businessId", "type", "isActive");

-- CreateIndex
CREATE INDEX "Party_businessId_name_idx" ON "Party"("businessId", "name");

-- CreateIndex
CREATE INDEX "Party_businessId_outstandingBalance_idx" ON "Party"("businessId", "outstandingBalance");

-- CreateIndex
CREATE INDEX "Party_groupId_idx" ON "Party"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Party_businessId_phone_key" ON "Party"("businessId", "phone");

-- CreateIndex
CREATE INDEX "PartyAddress_partyId_type_idx" ON "PartyAddress"("partyId", "type");

-- CreateIndex
CREATE INDEX "PartyGroup_businessId_idx" ON "PartyGroup"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "PartyGroup_businessId_name_key" ON "PartyGroup"("businessId", "name");

-- CreateIndex
CREATE INDEX "CustomFieldDefinition_businessId_entityType_idx" ON "CustomFieldDefinition"("businessId", "entityType");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldDefinition_businessId_name_entityType_key" ON "CustomFieldDefinition"("businessId", "name", "entityType");

-- CreateIndex
CREATE INDEX "PartyCustomFieldValue_fieldId_idx" ON "PartyCustomFieldValue"("fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "PartyCustomFieldValue_partyId_fieldId_key" ON "PartyCustomFieldValue"("partyId", "fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "OpeningBalance_partyId_key" ON "OpeningBalance"("partyId");

-- CreateIndex
CREATE INDEX "PartyPricing_productId_idx" ON "PartyPricing"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "PartyPricing_partyId_productId_key" ON "PartyPricing"("partyId", "productId");

-- CreateIndex
CREATE INDEX "Category_businessId_idx" ON "Category"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_businessId_name_key" ON "Category"("businessId", "name");

-- CreateIndex
CREATE INDEX "Unit_businessId_idx" ON "Unit"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_businessId_name_key" ON "Unit"("businessId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_businessId_symbol_key" ON "Unit"("businessId", "symbol");

-- CreateIndex
CREATE INDEX "UnitConversion_businessId_idx" ON "UnitConversion"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "UnitConversion_businessId_fromUnitId_toUnitId_key" ON "UnitConversion"("businessId", "fromUnitId", "toUnitId");

-- CreateIndex
CREATE INDEX "Product_businessId_status_idx" ON "Product"("businessId", "status");

-- CreateIndex
CREATE INDEX "Product_businessId_categoryId_idx" ON "Product"("businessId", "categoryId");

-- CreateIndex
CREATE INDEX "Product_businessId_name_idx" ON "Product"("businessId", "name");

-- CreateIndex
CREATE INDEX "Product_businessId_currentStock_minStockLevel_idx" ON "Product"("businessId", "currentStock", "minStockLevel");

-- CreateIndex
CREATE UNIQUE INDEX "Product_businessId_sku_key" ON "Product"("businessId", "sku");

-- CreateIndex
CREATE INDEX "StockMovement_productId_createdAt_idx" ON "StockMovement"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_businessId_movementDate_idx" ON "StockMovement"("businessId", "movementDate");

-- CreateIndex
CREATE INDEX "StockMovement_referenceType_referenceId_idx" ON "StockMovement"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "ProductCustomFieldValue_fieldId_idx" ON "ProductCustomFieldValue"("fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCustomFieldValue_productId_fieldId_key" ON "ProductCustomFieldValue"("productId", "fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "InventorySetting_businessId_key" ON "InventorySetting"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_sourceDocumentId_key" ON "Document"("sourceDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_clientId_key" ON "Document"("clientId");

-- CreateIndex
CREATE INDEX "Document_businessId_type_status_idx" ON "Document"("businessId", "type", "status");

-- CreateIndex
CREATE INDEX "Document_businessId_partyId_idx" ON "Document"("businessId", "partyId");

-- CreateIndex
CREATE INDEX "Document_businessId_documentDate_idx" ON "Document"("businessId", "documentDate");

-- CreateIndex
CREATE INDEX "Document_permanentDeleteAt_idx" ON "Document"("permanentDeleteAt");

-- CreateIndex
CREATE INDEX "Document_clientId_idx" ON "Document"("clientId");

-- CreateIndex
CREATE INDEX "Document_recurringInvoiceId_idx" ON "Document"("recurringInvoiceId");

-- CreateIndex
CREATE INDEX "Document_originalDocumentId_idx" ON "Document"("originalDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_businessId_type_documentNumber_key" ON "Document"("businessId", "type", "documentNumber");

-- CreateIndex
CREATE INDEX "DocumentLineItem_documentId_idx" ON "DocumentLineItem"("documentId");

-- CreateIndex
CREATE INDEX "DocumentLineItem_productId_idx" ON "DocumentLineItem"("productId");

-- CreateIndex
CREATE INDEX "DocumentAdditionalCharge_documentId_idx" ON "DocumentAdditionalCharge"("documentId");

-- CreateIndex
CREATE INDEX "DocumentShareLog_documentId_idx" ON "DocumentShareLog"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentNumberSeries_businessId_documentType_financialYear_key" ON "DocumentNumberSeries"("businessId", "documentType", "financialYear");

-- CreateIndex
CREATE UNIQUE INDEX "DigitalSignature_businessId_key" ON "DigitalSignature"("businessId");

-- CreateIndex
CREATE INDEX "TermsAndConditionsTemplate_businessId_idx" ON "TermsAndConditionsTemplate"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "TermsAndConditionsTemplate_businessId_name_key" ON "TermsAndConditionsTemplate"("businessId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSettings_businessId_key" ON "DocumentSettings"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_offlineId_key" ON "Payment"("offlineId");

-- CreateIndex
CREATE INDEX "Payment_businessId_date_idx" ON "Payment"("businessId", "date");

-- CreateIndex
CREATE INDEX "Payment_businessId_partyId_idx" ON "Payment"("businessId", "partyId");

-- CreateIndex
CREATE INDEX "Payment_businessId_type_idx" ON "Payment"("businessId", "type");

-- CreateIndex
CREATE INDEX "Payment_businessId_mode_idx" ON "Payment"("businessId", "mode");

-- CreateIndex
CREATE INDEX "Payment_businessId_isDeleted_idx" ON "Payment"("businessId", "isDeleted");

-- CreateIndex
CREATE INDEX "PaymentAllocation_invoiceId_idx" ON "PaymentAllocation"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_paymentId_invoiceId_key" ON "PaymentAllocation"("paymentId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentDiscount_paymentId_key" ON "PaymentDiscount"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentReminder_businessId_status_idx" ON "PaymentReminder"("businessId", "status");

-- CreateIndex
CREATE INDEX "PaymentReminder_businessId_partyId_idx" ON "PaymentReminder"("businessId", "partyId");

-- CreateIndex
CREATE INDEX "PaymentReminder_scheduledAt_status_idx" ON "PaymentReminder"("scheduledAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderConfig_businessId_key" ON "ReminderConfig"("businessId");

-- CreateIndex
CREATE INDEX "Role_businessId_idx" ON "Role"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_businessId_name_key" ON "Role"("businessId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "StaffInvite_code_key" ON "StaffInvite"("code");

-- CreateIndex
CREATE INDEX "StaffInvite_businessId_idx" ON "StaffInvite"("businessId");

-- CreateIndex
CREATE INDEX "StaffInvite_phone_idx" ON "StaffInvite"("phone");

-- CreateIndex
CREATE INDEX "StaffInvite_code_idx" ON "StaffInvite"("code");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionLockConfig_businessId_key" ON "TransactionLockConfig"("businessId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_businessId_status_idx" ON "ApprovalRequest"("businessId", "status");

-- CreateIndex
CREATE INDEX "ApprovalRequest_requestedBy_idx" ON "ApprovalRequest"("requestedBy");

-- CreateIndex
CREATE INDEX "AuditLog_businessId_createdAt_idx" ON "AuditLog"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_businessId_entityType_idx" ON "AuditLog"("businessId", "entityType");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_userId_key" ON "ReferralCode"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");

-- CreateIndex
CREATE INDEX "ReferralCode_code_idx" ON "ReferralCode"("code");

-- CreateIndex
CREATE INDEX "ReferralCode_userId_idx" ON "ReferralCode"("userId");

-- CreateIndex
CREATE INDEX "ReferralEvent_referrerId_eventType_idx" ON "ReferralEvent"("referrerId", "eventType");

-- CreateIndex
CREATE INDEX "ReferralEvent_referredId_eventType_idx" ON "ReferralEvent"("referredId", "eventType");

-- CreateIndex
CREATE INDEX "ReferralEvent_referrerId_isSuspicious_idx" ON "ReferralEvent"("referrerId", "isSuspicious");

-- CreateIndex
CREATE INDEX "ReferralEvent_isSuspicious_createdAt_idx" ON "ReferralEvent"("isSuspicious", "createdAt");

-- CreateIndex
CREATE INDEX "ReferralEvent_createdAt_idx" ON "ReferralEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ReferralReward_referrerId_status_idx" ON "ReferralReward"("referrerId", "status");

-- CreateIndex
CREATE INDEX "ReferralReward_status_eligibleAt_idx" ON "ReferralReward"("status", "eligibleAt");

-- CreateIndex
CREATE INDEX "ReferralWithdrawal_userId_status_idx" ON "ReferralWithdrawal"("userId", "status");

-- CreateIndex
CREATE INDEX "ReferralWithdrawal_status_createdAt_idx" ON "ReferralWithdrawal"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserAppSettings_userId_key" ON "UserAppSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "AdminUser_email_idx" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "AdminUser_role_isActive_idx" ON "AdminUser"("role", "isActive");

-- CreateIndex
CREATE INDEX "AdminAction_adminId_createdAt_idx" ON "AdminAction"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAction_targetType_targetId_idx" ON "AdminAction"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AdminAction_createdAt_idx" ON "AdminAction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserSuspension_userId_key" ON "UserSuspension"("userId");

-- CreateIndex
CREATE INDEX "UserSuspension_userId_idx" ON "UserSuspension"("userId");

-- CreateIndex
CREATE INDEX "UserSuspension_suspendedBy_idx" ON "UserSuspension"("suspendedBy");

-- CreateIndex
CREATE INDEX "TaxCategory_businessId_isActive_idx" ON "TaxCategory"("businessId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TaxCategory_businessId_name_key" ON "TaxCategory"("businessId", "name");

-- CreateIndex
CREATE INDEX "HsnCode_chapter_idx" ON "HsnCode"("chapter");

-- CreateIndex
CREATE INDEX "HsnCode_description_idx" ON "HsnCode"("description");

-- CreateIndex
CREATE UNIQUE INDEX "EInvoice_documentId_key" ON "EInvoice"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "EInvoice_irn_key" ON "EInvoice"("irn");

-- CreateIndex
CREATE INDEX "EInvoice_status_idx" ON "EInvoice"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EWayBill_documentId_key" ON "EWayBill"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "EWayBill_ewbNumber_key" ON "EWayBill"("ewbNumber");

-- CreateIndex
CREATE INDEX "EWayBill_documentId_idx" ON "EWayBill"("documentId");

-- CreateIndex
CREATE INDEX "EWayBill_status_idx" ON "EWayBill"("status");

-- CreateIndex
CREATE INDEX "EWayBill_ewbNumber_idx" ON "EWayBill"("ewbNumber");

-- CreateIndex
CREATE INDEX "GstReturn_businessId_returnType_idx" ON "GstReturn"("businessId", "returnType");

-- CreateIndex
CREATE UNIQUE INDEX "GstReturn_businessId_period_returnType_key" ON "GstReturn"("businessId", "period", "returnType");

-- CreateIndex
CREATE INDEX "GstReconciliation_businessId_period_idx" ON "GstReconciliation"("businessId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "GstReconciliation_businessId_period_reconType_key" ON "GstReconciliation"("businessId", "period", "reconType");

-- CreateIndex
CREATE INDEX "GstReconciliationEntry_reconciliationId_matchStatus_idx" ON "GstReconciliationEntry"("reconciliationId", "matchStatus");

-- CreateIndex
CREATE INDEX "RecurringInvoice_businessId_status_idx" ON "RecurringInvoice"("businessId", "status");

-- CreateIndex
CREATE INDEX "RecurringInvoice_nextRunDate_status_idx" ON "RecurringInvoice"("nextRunDate", "status");

-- CreateIndex
CREATE INDEX "ExchangeRate_businessId_fromCurrency_effectiveDate_idx" ON "ExchangeRate"("businessId", "fromCurrency", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_businessId_fromCurrency_toCurrency_effectiveDa_key" ON "ExchangeRate"("businessId", "fromCurrency", "toCurrency", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_bankAccountId_key" ON "LedgerAccount"("bankAccountId");

-- CreateIndex
CREATE INDEX "LedgerAccount_businessId_type_isActive_idx" ON "LedgerAccount"("businessId", "type", "isActive");

-- CreateIndex
CREATE INDEX "LedgerAccount_businessId_subType_idx" ON "LedgerAccount"("businessId", "subType");

-- CreateIndex
CREATE INDEX "LedgerAccount_parentId_idx" ON "LedgerAccount"("parentId");

-- CreateIndex
CREATE INDEX "LedgerAccount_partyId_idx" ON "LedgerAccount"("partyId");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_businessId_code_key" ON "LedgerAccount"("businessId", "code");

-- CreateIndex
CREATE INDEX "JournalEntry_businessId_date_idx" ON "JournalEntry"("businessId", "date");

-- CreateIndex
CREATE INDEX "JournalEntry_businessId_type_idx" ON "JournalEntry"("businessId", "type");

-- CreateIndex
CREATE INDEX "JournalEntry_businessId_status_idx" ON "JournalEntry"("businessId", "status");

-- CreateIndex
CREATE INDEX "JournalEntry_sourceType_sourceId_idx" ON "JournalEntry"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_businessId_entryNumber_key" ON "JournalEntry"("businessId", "entryNumber");

-- CreateIndex
CREATE INDEX "JournalEntryLine_journalEntryId_idx" ON "JournalEntryLine"("journalEntryId");

-- CreateIndex
CREATE INDEX "JournalEntryLine_accountId_idx" ON "JournalEntryLine"("accountId");

-- CreateIndex
CREATE INDEX "JournalEntryLine_partyId_idx" ON "JournalEntryLine"("partyId");

-- CreateIndex
CREATE INDEX "BankAccount_businessId_isActive_idx" ON "BankAccount"("businessId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_businessId_accountNumber_key" ON "BankAccount"("businessId", "accountNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_journalEntryId_key" ON "Expense"("journalEntryId");

-- CreateIndex
CREATE INDEX "Expense_businessId_date_idx" ON "Expense"("businessId", "date");

-- CreateIndex
CREATE INDEX "Expense_businessId_categoryId_idx" ON "Expense"("businessId", "categoryId");

-- CreateIndex
CREATE INDEX "Expense_businessId_isDeleted_idx" ON "Expense"("businessId", "isDeleted");

-- CreateIndex
CREATE INDEX "ExpenseCategory_businessId_isActive_idx" ON "ExpenseCategory"("businessId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_businessId_name_key" ON "ExpenseCategory"("businessId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "OtherIncome_journalEntryId_key" ON "OtherIncome"("journalEntryId");

-- CreateIndex
CREATE INDEX "OtherIncome_businessId_date_idx" ON "OtherIncome"("businessId", "date");

-- CreateIndex
CREATE INDEX "OtherIncome_businessId_category_idx" ON "OtherIncome"("businessId", "category");

-- CreateIndex
CREATE INDEX "OtherIncome_businessId_isDeleted_idx" ON "OtherIncome"("businessId", "isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "Cheque_journalEntryId_key" ON "Cheque"("journalEntryId");

-- CreateIndex
CREATE INDEX "Cheque_businessId_status_idx" ON "Cheque"("businessId", "status");

-- CreateIndex
CREATE INDEX "Cheque_businessId_type_idx" ON "Cheque"("businessId", "type");

-- CreateIndex
CREATE INDEX "Cheque_businessId_date_idx" ON "Cheque"("businessId", "date");

-- CreateIndex
CREATE INDEX "Cheque_bankAccountId_idx" ON "Cheque"("bankAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "LoanAccount_journalEntryId_key" ON "LoanAccount"("journalEntryId");

-- CreateIndex
CREATE INDEX "LoanAccount_businessId_type_status_idx" ON "LoanAccount"("businessId", "type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LoanTransaction_journalEntryId_key" ON "LoanTransaction"("journalEntryId");

-- CreateIndex
CREATE INDEX "LoanTransaction_loanAccountId_date_idx" ON "LoanTransaction"("loanAccountId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialYearClosure_journalEntryId_key" ON "FinancialYearClosure"("journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialYearClosure_businessId_financialYear_key" ON "FinancialYearClosure"("businessId", "financialYear");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_referredBy_fkey" FOREIGN KEY ("referredBy") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "BusinessUser" ADD CONSTRAINT "BusinessUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessUser" ADD CONSTRAINT "BusinessUser_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessUser" ADD CONSTRAINT "BusinessUser_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Party" ADD CONSTRAINT "Party_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Party" ADD CONSTRAINT "Party_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PartyGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyAddress" ADD CONSTRAINT "PartyAddress_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyGroup" ADD CONSTRAINT "PartyGroup_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldDefinition" ADD CONSTRAINT "CustomFieldDefinition_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyCustomFieldValue" ADD CONSTRAINT "PartyCustomFieldValue_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyCustomFieldValue" ADD CONSTRAINT "PartyCustomFieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "CustomFieldDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningBalance" ADD CONSTRAINT "OpeningBalance_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyPricing" ADD CONSTRAINT "PartyPricing_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyPricing" ADD CONSTRAINT "PartyPricing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_baseUnitId_fkey" FOREIGN KEY ("baseUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitConversion" ADD CONSTRAINT "UnitConversion_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitConversion" ADD CONSTRAINT "UnitConversion_fromUnitId_fkey" FOREIGN KEY ("fromUnitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitConversion" ADD CONSTRAINT "UnitConversion_toUnitId_fkey" FOREIGN KEY ("toUnitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_taxCategoryId_fkey" FOREIGN KEY ("taxCategoryId") REFERENCES "TaxCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCustomFieldValue" ADD CONSTRAINT "ProductCustomFieldValue_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCustomFieldValue" ADD CONSTRAINT "ProductCustomFieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "CustomFieldDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySetting" ADD CONSTRAINT "InventorySetting_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_recurringInvoiceId_fkey" FOREIGN KEY ("recurringInvoiceId") REFERENCES "RecurringInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_originalDocumentId_fkey" FOREIGN KEY ("originalDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentLineItem" ADD CONSTRAINT "DocumentLineItem_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentLineItem" ADD CONSTRAINT "DocumentLineItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAdditionalCharge" ADD CONSTRAINT "DocumentAdditionalCharge_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentShareLog" ADD CONSTRAINT "DocumentShareLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentShareLog" ADD CONSTRAINT "DocumentShareLog_sentBy_fkey" FOREIGN KEY ("sentBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentNumberSeries" ADD CONSTRAINT "DocumentNumberSeries_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalSignature" ADD CONSTRAINT "DigitalSignature_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermsAndConditionsTemplate" ADD CONSTRAINT "TermsAndConditionsTemplate_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSettings" ADD CONSTRAINT "DocumentSettings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentDiscount" ADD CONSTRAINT "PaymentDiscount_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReminder" ADD CONSTRAINT "PaymentReminder_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReminder" ADD CONSTRAINT "PaymentReminder_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReminder" ADD CONSTRAINT "PaymentReminder_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderConfig" ADD CONSTRAINT "ReminderConfig_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffInvite" ADD CONSTRAINT "StaffInvite_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionLockConfig" ADD CONSTRAINT "TransactionLockConfig_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralEvent" ADD CONSTRAINT "ReferralEvent_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralEvent" ADD CONSTRAINT "ReferralEvent_referredId_fkey" FOREIGN KEY ("referredId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_referredId_fkey" FOREIGN KEY ("referredId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "ReferralWithdrawal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralWithdrawal" ADD CONSTRAINT "ReferralWithdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAppSettings" ADD CONSTRAINT "UserAppSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAction" ADD CONSTRAINT "AdminAction_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxCategory" ADD CONSTRAINT "TaxCategory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EInvoice" ADD CONSTRAINT "EInvoice_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EWayBill" ADD CONSTRAINT "EWayBill_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GstReturn" ADD CONSTRAINT "GstReturn_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GstReconciliation" ADD CONSTRAINT "GstReconciliation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GstReconciliationEntry" ADD CONSTRAINT "GstReconciliationEntry_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "GstReconciliation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringInvoice" ADD CONSTRAINT "RecurringInvoice_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeRate" ADD CONSTRAINT "ExchangeRate_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "LedgerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntryLine" ADD CONSTRAINT "JournalEntryLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntryLine" ADD CONSTRAINT "JournalEntryLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtherIncome" ADD CONSTRAINT "OtherIncome_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtherIncome" ADD CONSTRAINT "OtherIncome_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cheque" ADD CONSTRAINT "Cheque_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cheque" ADD CONSTRAINT "Cheque_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanAccount" ADD CONSTRAINT "LoanAccount_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanTransaction" ADD CONSTRAINT "LoanTransaction_loanAccountId_fkey" FOREIGN KEY ("loanAccountId") REFERENCES "LoanAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialYearClosure" ADD CONSTRAINT "FinancialYearClosure_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
