import { describe, expect, it } from 'vitest';
import {
  calculatePayerProcessingFee,
  calculateZaniaPayCharge,
  isZaniaPaySessionExpired,
  normalizeAdminZaniaPayAccount,
  ZANIA_PAY_MINIMUM_PAYMENT_KES,
  ZANIA_PAY_SERVICE_FEE_KES,
} from '@/lib/zaniaPay';

describe('Zania Pay payer-borne processing fees', () => {
  it('grosses up an M-Pesa payment so the professional keeps the invoice amount', () => {
    expect(calculateZaniaPayCharge(100_000, 'mpesa')).toEqual({
      invoicePayment: 100_000,
      processingFee: 1_524,
      serviceFee: 50,
      totalCharged: 101_574,
    });
  });

  it('rounds the fee up rather than leaving the professional short', () => {
    expect(calculatePayerProcessingFee(1_000, 'mpesa')).toBe(16);
  });

  it('does not quote a fee for an invalid amount', () => {
    expect(calculatePayerProcessingFee(0, 'mpesa')).toBe(0);
    expect(calculatePayerProcessingFee(Number.NaN, 'card')).toBe(0);
  });

  it('uses a flat KES 50 service fee and a KES 1,000 payment minimum', () => {
    expect(ZANIA_PAY_SERVICE_FEE_KES).toBe(50);
    expect(ZANIA_PAY_MINIMUM_PAYMENT_KES).toBe(1_000);
  });
});

describe('Zania Pay admin account summaries', () => {
  it('keeps only the safe, masked payout fields returned by the server', () => {
    expect(normalizeAdminZaniaPayAccount({
      id: 'account-1',
      professionalUserId: 'user-1',
      professionalName: 'Mwaniki Weddings',
      status: 'pending',
      mode: 'sandbox',
      settlementDestinationHint: 'M-PESA ••••4695',
      destinationType: 'mobile_money',
      destinationName: 'M-PESA',
      isDefault: true,
      providerAccountReference: 'ACCT_private',
    })).toEqual({
      id: 'account-1',
      professionalUserId: 'user-1',
      professionalName: 'Mwaniki Weddings',
      status: 'pending',
      mode: 'sandbox',
      settlementDestinationHint: 'M-PESA ••••4695',
      destinationType: 'mobile_money',
      destinationName: 'M-PESA',
      isDefault: true,
      audience: undefined,
      provider: undefined,
      providerVerificationStatus: undefined,
      settlementCurrency: undefined,
      rejectionReason: undefined,
      submittedAt: undefined,
      verifiedAt: undefined,
      lastProviderSyncAt: undefined,
      updatedAt: undefined,
    });
  });

  it('rejects rows without stable account and professional identifiers', () => {
    expect(normalizeAdminZaniaPayAccount({ status: 'pending' })).toBeNull();
  });
});

describe('Zania Pay payment-session recovery', () => {
  it('recognizes an expired-session response so the payer can sign in again', () => {
    expect(isZaniaPaySessionExpired(new Error('Your session has expired. Please sign in again.'))).toBe(true);
    expect(isZaniaPaySessionExpired(new Error('This invoice is no longer available.'))).toBe(false);
  });
});
