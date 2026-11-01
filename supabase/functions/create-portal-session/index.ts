// SHOT LOG のアプリ内から Stripe の顧客ポータル(解約・支払い方法の変更)を開く。
//
// 必須環境変数(create-checkout-session と共通):
//   STRIPE_SECRET_KEY   Stripeのシークレットキー
//   ALLOWED_ORIGINS     許可するフロントエンドのオリジン(カンマ区切り)
//
// Stripeダッシュボードで顧客ポータルの設定を一度保存しておく必要がある
// (Settings > Billing > Customer portal)。
//
// リクエストボディ: { "returnUrl": "https://.../shot-log/" }
// レスポンス: { "url": "https://billing.stripe.com/..." }

import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17.5.0';
import { corsHeaders, isAllowedOrigin } from '../_shared/cors.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2025-03-31.basil',
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), { status: 405, headers });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers });
    }

    const { returnUrl } = await req.json();
    let baseUrl: string;
    try {
      const parsed = new URL(returnUrl);
      if (!isAllowedOrigin(parsed.origin)) throw new Error('origin not allowed');
      baseUrl = `${parsed.origin}${parsed.pathname}`;
    } catch {
      return new Response(JSON.stringify({ error: 'invalid returnUrl' }), { status: 400, headers });
    }

    // 呼び出し元ユーザーの認証(anon key + Authorization ヘッダーで検証)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: account, error: accountError } = await supabaseAdmin
      .from('billing_accounts')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (accountError || !account?.stripe_customer_id) {
      return new Response(JSON.stringify({ error: 'no customer' }), { status: 404, headers });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: account.stripe_customer_id,
      return_url: baseUrl,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[create-portal-session]', err);
    return new Response(JSON.stringify({ error: 'internal error' }), { status: 500, headers });
  }
});
