import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { updateUserCredits, logTransaction } from '@/utils/credits';
import { CREDIT_TRANSACTION_TYPE } from '@/db/schema';
import { getCreditPackage } from '@/utils/credits';
import ms from 'ms';
import { CREDITS_EXPIRATION_YEARS } from '@/constants';

// Stripe webhook events we handle
const WEBHOOK_EVENTS = {
  PAYMENT_INTENT_SUCCEEDED: 'payment_intent.succeeded',
  CHECKOUT_SESSION_COMPLETED: 'checkout.session.completed',
  PAYMENT_INTENT_FAILED: 'payment_intent.payment_failed',
  CHARGE_SUCCEEDED: 'charge.succeeded',
  CHARGE_FAILED: 'charge.failed',
} as const;

// Type definitions for Stripe webhook objects
interface StripePaymentIntent {
  id: string;
  metadata?: {
    userId?: string;
    packageId?: string;
    credits?: string;
  };
  last_payment_error?: {
    message?: string;
  };
}

interface StripeCheckoutSession {
  id: string;
  payment_status?: string;
  payment_intent?: string;
  metadata?: {
    userId?: string;
    packageId?: string;
    credits?: string;
  };
}

interface StripeCharge {
  id: string;
}

export async function POST(request: NextRequest) {
  try {
    // Get the raw body for signature verification
    const body = await request.text();
    
    // Get the signature from headers
    const signature = request.headers.get('stripe-signature');
    
    if (!signature) {
      console.error('[Stripe Webhook] No signature provided');
      return NextResponse.json(
        { error: 'No signature provided' },
        { status: 400 }
      );
    }

    // Get webhook secret from environment
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    let event;
    
    try {
      // Construct and verify the event
      const stripe = getStripe();
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret
      );
    } catch (err) {
      const error = err as Error;
      console.error('[Stripe Webhook] Signature verification failed:', error.message);
      return NextResponse.json(
        { error: `Webhook signature verification failed: ${error.message}` },
        { status: 400 }
      );
    }

    console.log(`[Stripe Webhook] Received event: ${event.type}`);

    // Handle the event based on type
    switch (event.type) {
      case WEBHOOK_EVENTS.PAYMENT_INTENT_SUCCEEDED: {
        const paymentIntent = event.data.object as StripePaymentIntent;
        console.log(`[Stripe Webhook] Payment intent succeeded: ${paymentIntent.id}`);
        
        // Extract metadata
        const { userId, packageId, credits } = paymentIntent.metadata || {};
        
        if (!userId || !packageId || !credits) {
          console.warn('[Stripe Webhook] Missing metadata in payment intent');
          break;
        }

        // Get the credit package details
        const creditPackage = getCreditPackage(packageId);
        
        if (!creditPackage) {
          console.error(`[Stripe Webhook] Invalid package ID: ${packageId}`);
          break;
        }

        // Verify the credits match
        if (parseInt(credits) !== creditPackage.credits) {
          console.error('[Stripe Webhook] Credit mismatch in payment intent');
          break;
        }

        try {
          // Add credits to user account
          await updateUserCredits(userId, creditPackage.credits);
          
          // Log the transaction
          await logTransaction({
            userId,
            amount: creditPackage.credits,
            description: `Purchased ${creditPackage.credits} credits via Stripe webhook`,
            type: CREDIT_TRANSACTION_TYPE.PURCHASE,
            expirationDate: new Date(Date.now() + ms(`${CREDITS_EXPIRATION_YEARS} years`)),
            paymentIntentId: paymentIntent.id
          });
          
          console.log(`[Stripe Webhook] Successfully added ${creditPackage.credits} credits to user ${userId}`);
        } catch (error) {
          console.error('[Stripe Webhook] Error processing payment:', error);
          // Return error so Stripe will retry
          return NextResponse.json(
            { error: 'Failed to process payment' },
            { status: 500 }
          );
        }
        break;
      }

      case WEBHOOK_EVENTS.CHECKOUT_SESSION_COMPLETED: {
        const session = event.data.object as StripeCheckoutSession;
        console.log(`[Stripe Webhook] Checkout session completed: ${session.id}`);
        
        // If using checkout sessions, handle similar to payment intent
        if (session.payment_status === 'paid') {
          const { userId, packageId, credits } = session.metadata || {};
          
          if (!userId || !packageId || !credits) {
            console.warn('[Stripe Webhook] Missing metadata in checkout session');
            break;
          }

          const creditPackage = getCreditPackage(packageId);
          
          if (!creditPackage || parseInt(credits) !== creditPackage.credits) {
            console.error('[Stripe Webhook] Invalid package or credit mismatch');
            break;
          }

          try {
            await updateUserCredits(userId, creditPackage.credits);
            await logTransaction({
              userId,
              amount: creditPackage.credits,
              description: `Purchased ${creditPackage.credits} credits via Stripe checkout`,
              type: CREDIT_TRANSACTION_TYPE.PURCHASE,
              expirationDate: new Date(Date.now() + ms(`${CREDITS_EXPIRATION_YEARS} years`)),
              paymentIntentId: session.payment_intent
            });
            
            console.log(`[Stripe Webhook] Successfully processed checkout for user ${userId}`);
          } catch (error) {
            console.error('[Stripe Webhook] Error processing checkout:', error);
            return NextResponse.json(
              { error: 'Failed to process checkout' },
              { status: 500 }
            );
          }
        }
        break;
      }

      case WEBHOOK_EVENTS.PAYMENT_INTENT_FAILED: {
        const paymentIntent = event.data.object as StripePaymentIntent;
        console.error(`[Stripe Webhook] Payment failed for intent: ${paymentIntent.id}`);
        
        // You could log failed payment attempts here for analytics
        const { userId } = paymentIntent.metadata || {};
        if (userId) {
          await logTransaction({
            userId,
            amount: 0,
            description: `Payment failed: ${paymentIntent.last_payment_error?.message || 'Unknown error'}`,
            type: CREDIT_TRANSACTION_TYPE.FAILED_PURCHASE,
            expirationDate: new Date(),
            paymentIntentId: paymentIntent.id
          });
        }
        break;
      }

      case WEBHOOK_EVENTS.CHARGE_SUCCEEDED: {
        const charge = event.data.object as StripeCharge;
        console.log(`[Stripe Webhook] Charge succeeded: ${charge.id}`);
        // Charge events are handled via payment_intent.succeeded
        break;
      }

      case WEBHOOK_EVENTS.CHARGE_FAILED: {
        const charge = event.data.object as StripeCharge;
        console.error(`[Stripe Webhook] Charge failed: ${charge.id}`);
        // Log for monitoring purposes
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    // Return success response to Stripe
    return NextResponse.json(
      { received: true, type: event.type },
      { status: 200 }
    );

  } catch (error) {
    console.error('[Stripe Webhook] Unexpected error:', error);
    
    // Return error status so Stripe will retry
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// Handle other HTTP methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}