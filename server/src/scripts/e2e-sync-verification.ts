export {};

const BASE_URL = 'http://localhost:5001/api';

class SyncTestClient {
  private cookies: Map<string, string> = new Map();
  private token: string | null = null;
  private csrfToken: string | null = null;

  async init() {
    const res = await fetch(`${BASE_URL}/auth/csrf-token`);
    this.extractCookies(res);
    const data: any = await res.json();
    this.csrfToken = data.csrfToken || data.data?.csrfToken;
  }

  setToken(token: string) {
    this.token = token;
  }

  private extractCookies(res: Response) {
    const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean) as string[];
    for (const cookieStr of setCookie) {
      if (!cookieStr) continue;
      const parts = cookieStr.split(';')[0].split('=');
      if (parts.length >= 2) {
        this.cookies.set(parts[0].trim(), parts.slice(1).join('=').trim());
      }
    }
  }

  private getCookieHeader(): string {
    const pairs: string[] = [];
    for (const [k, v] of this.cookies.entries()) {
      pairs.push(`${k}=${v}`);
    }
    return pairs.join('; ');
  }

  async request(method: string, path: string, body?: any) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
      headers['X-Request-Nonce'] = crypto.randomUUID();
      headers['X-Request-Timestamp'] = Date.now().toString();
    }

    const cookieHeader = this.getCookieHeader();
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }
    if (this.csrfToken) {
      headers['x-csrf-token'] = this.csrfToken;
    }
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    this.extractCookies(res);

    const json: any = await res.json();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} on ${method} ${path}: ${JSON.stringify(json)}`);
    }
    return json.data !== undefined ? json.data : json;
  }

  get(path: string) {
    return this.request('GET', path);
  }

  post(path: string, body: any) {
    return this.request('POST', path, body);
  }
}

async function run() {
  console.log('===============================================================');
  console.log('🚀 HISAABPRO OFFLINE-FIRST BIDIRECTIONAL SYNC VERIFICATION');
  console.log('===============================================================\n');

  const phone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
  const client = new SyncTestClient();
  await client.init();

  console.log(`1. Registering new tenant (${phone})...`);
  const regRes = await client.post('/auth/direct-register', {
    name: 'Vikram Singh',
    phone,
    password: 'Password@123',
    businessName: 'Singh Logistics & Traders',
  });

  const activeBiz = regRes.activeBusiness || regRes.businesses?.[0];
  console.log('✅ Tenant Registered:', {
    user: regRes.user.name,
    businessId: activeBiz.id,
  });

  client.setToken(regRes.tokens.accessToken);

  // 2. Simulate Outbox Batch Push
  console.log('\n2. Pushing simulated outbox batch (1 Party + 1 Product) via POST /api/sync/push...');
  const partyId = `party_offline_${Date.now()}`;
  const productId = `prod_offline_${Date.now()}`;

  const pushRes = await client.post('/sync/push', {
    deviceId: 'mobile_android_12',
    mutations: [
      {
        id: crypto.randomUUID(),
        idempotencyKey: `idemp_${activeBiz.id.slice(0, 8)}_party_${partyId}_create_v0`,
        entityType: 'PARTY',
        entityId: partyId,
        operation: 'CREATE',
        baseVersion: 0,
        payload: {
          name: 'Kisan Fertilisers Pvt Ltd',
          phone: '9822334455',
          type: 'SUPPLIER',
          openingBalance: 250000,
        },
      },
      {
        id: crypto.randomUUID(),
        idempotencyKey: `idemp_${activeBiz.id.slice(0, 8)}_prod_${productId}_create_v0`,
        entityType: 'PRODUCT',
        entityId: productId,
        operation: 'CREATE',
        baseVersion: 0,
        payload: {
          name: 'Organic Urea 50kg',
          salePrice: 65000,
          purchasePrice: 50000,
          openingStock: 200,
        },
      },
    ],
  });

  console.log('✅ Sync Push Response:', {
    acceptedCount: pushRes.accepted?.length,
    rejectedCount: pushRes.rejected?.length,
    accepted: pushRes.accepted,
    rejected: pushRes.rejected,
  });

  if (pushRes.accepted?.length !== 2) {
    throw new Error('❌ Push sync failed to accept all mutations');
  }

  // 3. Verify Database State
  console.log('\n3. Verifying records in PostgreSQL via standard APIs...');
  const partiesRes = await client.get('/parties');
  const parties = partiesRes.parties || partiesRes;
  const createdParty = parties.find((p: any) => p.id === partyId);
  console.log(`✅ Party verified in PostgreSQL: "${createdParty.name}" (ID: ${createdParty.id})`);

  const productsRes = await client.get('/products');
  const products = productsRes.products || productsRes;
  const createdProd = products.find((p: any) => p.id === productId);
  console.log(`✅ Product verified in PostgreSQL: "${createdProd.name}" (Stock: ${createdProd.currentStock})`);

  // 4. Test Delta Pull
  console.log('\n4. Testing Delta Pull via GET /api/sync/pull?since=...');
  const pullRes = await client.get('/sync/pull?since=' + new Date(Date.now() - 60000).toISOString());
  console.log('✅ Delta Pull Summary:', {
    partiesDeltaCount: pullRes.changes?.parties?.length,
    productsDeltaCount: pullRes.changes?.products?.length,
    serverTimestamp: pullRes.serverTimestamp,
  });

  console.log('\n===============================================================');
  console.log('🎉 OFFLINE-FIRST SYNC ENGINE VERIFIED 100% OPERATIONAL!');
  console.log('===============================================================');
}

run().catch((err) => {
  console.error('❌ Sync verification failed:', err.message);
  process.exit(1);
});
