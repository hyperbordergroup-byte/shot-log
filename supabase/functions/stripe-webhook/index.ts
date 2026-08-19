// Stripe Webhookを受信し、都度払い購入・サブスク状態の変化を
// billing_accounts / billing_transactions に反映する。
//
// 冪等化: event.id を stripe_events に先にINSERTし、主キー重複(=再送)
// なら何もせず200を返す。同じイベントを複数回受信しても回数やPro状態を
// 重複反映しない(9-1章の必須条件)。
//
// 必須環境変数:
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET   Stripeダッシュボードでこのエンドポイントを
//                           登録した際に発行される署名シークレット
//
// Stripeダッシュボードで登録するイベント:
//   checkout.session.completed
//   customer.subscription.created
//   customer.subscription.updated
//   customer.subscription.deleted

import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17.5.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2025-03-31.basil',
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret, undefined, cryptoProvider);
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed', err);
    return new Response('invalid signature', { status: 400 });
  }

  const { error: insertError } = await supabaseAdmin
    .from('stripe_events')
    .insert({ id: event.id, event_type: event.type, payload: event as unknown as Record<string, unknown> });
  if (insertError) {
    // 主キー重複 = 受信済みイベントの再送
    return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = (session.metadata?.supabase_user_id || session.client_reference_id) ?? null;
        const kind = session.metadata?.kind;

        if (userId && kind === 'one_time_recording') {
          const { error } = await supabaseAdmin.rpc('apply_stripe_checkout_completed', {
            p_user_id: userId,
            p_customer_id: session.customer as string,
            p_checkout_session_id: session.id,
            p_kind: 'one_time_recording',
            p_quantity: 1,
            p_amount: session.amount_total,
            p_currency: session.currency,
          });
          if (error) throw error;
        }
        // subscriptionモードのPro反映は customer.subscription.* 側で確定させる
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const periodEnd = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null;

        const { error } = await supabaseAdmin.rpc('apply_stripe_subscription_status', {
          p_customer_id: subscription.customer as string,
          p_subscription_id: subscription.id,
          p_status: subscription.status,
          p_current_period_end: periodEnd,
        });
        if (error) throw error;
        break;
      }

      default:
        // 未対応イベントは記録のみ(stripe_eventsへのINSERT)して処理はスキップ
        break;
    }

    await supabaseAdmin
      .from('stripe_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('id', event.id);

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    console.error('[stripe-webhook] processing failed', event.type, err);
    // processed_at を立てない = Stripe側の自動リトライで再処理される
    return new Response(JSON.stringify({ error: 'processing failed' }), { status: 500 });
  }
});
