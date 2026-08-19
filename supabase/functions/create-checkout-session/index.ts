// SHOT LOG のアプリ内から、都度払い(¥550)またはProサブスク(¥1,078/月)の
// Stripe Checkout Session を作成する。
//
// 必須環境変数(supabase secrets set で設定する。Sandbox/Liveで値を差し替える):
//   STRIPE_SECRET_KEY              Stripeのシークレットキー
//   STRIPE_PRICE_ONE_TIME          都度払い(1回)のPrice ID
//   STRIPE_PRICE_PRO_SUBSCRIPTION  Proサブスクの月額Price ID
//   ALLOWED_ORIGINS                許可するフロントエンドのオリジン(カンマ区切り)
//
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY は
// Edge Functionsランタイムが自動で注入するため、手動設定は不要。
//
// リクエストボディ: { "kind": "one_time" | "subscription", "returnUrl": "https://.../shot-log/" }
// レスポンス: { "url": "https://checkout.stripe.com/..." }

import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17.5.0';
import { corsHeaders, isAllowedOrigin } from '../_shared/cors.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2025-03-31.basil',
  httpClient: Stripe.createFetchHttpClient(),
});

const PRICE_IDS: Record<string, string> = {
  one_time: Deno.env.get('STRIPE_PRICE_ONE_TIME') || '',
  subscription: Deno.env.get('STRIPE_PRICE_PRO_SUBSCRIPTION') || '',
};

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

    const { kind, returnUrl } = await req.json();
    if (kind !== 'one_time' && kind !== 'subscription') {
      return new Response(JSON.stringify({ error: 'invalid kind' }), { status: 400, headers });
    }
    if (!PRICE_IDS[kind]) {
      return new Response(JSON.stringify({ error: 'price not configured' }), { status: 500, headers });
    }

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
    if (userError || !user || !user.email) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers });
    }

    // 課金状態の読み書きはservice_roleで行う(クライアントの自己申告を信用しない)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: account, error: accountError } = await supabaseAdmin
      .from('billing_accounts')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (accountError) {
      console.error('[create-checkout-session] billing_accounts lookup failed', user.id, accountError);
      return new Response(JSON.stringify({ error: 'billing account lookup failed' }), { status: 500, headers });
    }
    if (!account) {
      console.error('[create-checkout-session] billing_accounts row missing for user', user.id);
      return new Response(JSON.stringify({ error: 'billing account not initialized' }), { status: 500, headers });
    }

    let customerId = account.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabaseAdmin.rpc('set_stripe_customer_id', {
        p_user_id: user.id,
        p_customer_id: customerId,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: kind === 'one_time' ? 'payment' : 'subscription',
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: PRICE_IDS[kind], quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${baseUrl}?checkout=success`,
      cancel_url: `${baseUrl}?checkout=cancel`,
      metadata: {
        supabase_user_id: user.id,
        kind: kind === 'one_time' ? 'one_time_recording' : 'subscription',
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[create-checkout-session]', err);
    return new Response(JSON.stringify({ error: 'internal error' }), { status: 500, headers });
  }
});
