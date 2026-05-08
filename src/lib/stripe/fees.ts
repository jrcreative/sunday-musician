// Fee math for marketplace charges.
//
// The musician must receive their full quoted fee. The platform must net $5
// after Stripe processing fees. So the church pays a grossed-up total that
// covers musician_amount + $5 + Stripe's cut.
//
// Stripe US standard pricing (cards): 2.9% + $0.30 per successful charge.
// For a destination charge, Stripe deducts the processing fee from the
// platform's application_fee_amount by default — i.e. our cut absorbs the fee
// unless we gross up the charge total.
//
// All amounts in cents.

const STRIPE_PCT = 0.029;
const STRIPE_FIXED = 30; // cents
export const PLATFORM_FEE_CENTS = 500; // $5

export type FeeBreakdown = {
  musicianAmount: number;       // sent to connected account
  platformNet: number;          // our $5 (always 500)
  stripeFee: number;            // Stripe's processing fee on the gross
  applicationFeeAmount: number; // platform_net + stripe_fee → goes on the PI
  chargeTotal: number;          // total charged to the church's card
};

export function computeFees(musicianAmountCents: number): FeeBreakdown {
  if (!Number.isInteger(musicianAmountCents) || musicianAmountCents < 0) {
    throw new Error("musicianAmountCents must be a non-negative integer");
  }
  // chargeTotal = (musicianAmount + platformNet + STRIPE_FIXED) / (1 - STRIPE_PCT)
  const numerator = musicianAmountCents + PLATFORM_FEE_CENTS + STRIPE_FIXED;
  const chargeTotal = Math.ceil(numerator / (1 - STRIPE_PCT));
  const stripeFee = Math.round(chargeTotal * STRIPE_PCT) + STRIPE_FIXED;
  const applicationFeeAmount = chargeTotal - musicianAmountCents;
  return {
    musicianAmount: musicianAmountCents,
    platformNet: PLATFORM_FEE_CENTS,
    stripeFee,
    applicationFeeAmount,
    chargeTotal,
  };
}
