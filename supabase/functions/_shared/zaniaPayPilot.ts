export function assertLivePaystackKey(secretKey: string): void {
  if (!secretKey.startsWith('sk_live_')) throw new Error('Live Zania Pay requires a live Paystack key.');
}
