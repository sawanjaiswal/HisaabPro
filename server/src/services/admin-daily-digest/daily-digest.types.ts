export interface HisaabProDailyDigestMetrics {
  targetDateStr: string; // YYYY-MM-DD
  registrations: {
    newUsers: number;
    newBusinesses: number;
    totalUsers: number;
    totalBusinesses: number;
  };
  salesAndInvoices: {
    invoicesCreatedToday: number;
    totalSalesPaise: number;
  };
  collections: {
    paymentsReceivedCount: number;
    totalCollectionsPaise: number;
  };
  subscriptions: {
    activeSubscriptions: number;
    proPlanCount: number;
    enterprisePlanCount: number;
  };
}
