import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

export function DeviceVerificationGate({ inline = false }: { inline?: boolean }) {
  const {
    deviceVerificationMessage,
    deviceVerificationEmailHint,
    deviceVerificationSubmitting,
    sendCurrentDeviceVerificationCode,
    verifyCurrentDeviceVerificationCode,
    signOut,
  } = useAuth();
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const deliveryNeedsRetry = /request a verification code/i.test(deviceVerificationMessage ?? '');

  const handleVerify = async () => {
    setError(null);

    try {
      await verifyCurrentDeviceVerificationCode(otpCode);
      setOtpCode('');
    } catch (verificationError) {
      console.error('Device verification failed:', verificationError);
      setError('We could not verify that code. Check it and try again.');
    }
  };

  const handleResend = async () => {
    setError(null);

    try {
      await sendCurrentDeviceVerificationCode();
    } catch (resendError) {
      console.error('Device verification code request failed:', resendError);
      setError('We could not send a new code right now. Please try again shortly.');
    }
  };

  const verificationCard = (
    <Card className={inline ? 'border-[#ded7cf] shadow-none' : 'shadow-card'}>
          <CardHeader>
            <CardTitle>{inline ? 'Confirm this device to pay' : 'Verify this device'}</CardTitle>
            <CardDescription>
              {inline
                ? deliveryNeedsRetry
                  ? 'We could not send the code. Tap “Send code again” to try once more. Your invoice and M-Pesa number will stay here.'
                  : 'For your security, enter the six-digit code we sent to your email. Your invoice and M-Pesa number will stay here while you confirm.'
                : deviceVerificationMessage ?? 'We noticed a sign-in from a new device. Enter the code sent to your email to continue.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Code destination: <span className="font-medium text-foreground">{deviceVerificationEmailHint ?? 'your email'}</span>
            </p>

            <div className="space-y-3">
              <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                <InputOTPGroup className="justify-between">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <InputOTPSlot key={index} index={index} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="button" onClick={() => void handleVerify()} disabled={deviceVerificationSubmitting || otpCode.length !== 6} className="flex-1">
                {deviceVerificationSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Verify device
              </Button>
              <Button type="button" variant="outline" onClick={() => void handleResend()} disabled={deviceVerificationSubmitting}>
                {deliveryNeedsRetry ? 'Send code again' : 'Resend code'}
              </Button>
            </div>

            <Button type="button" variant="ghost" className="w-full" onClick={() => void signOut()}>
              Sign out instead
            </Button>
          </CardContent>
    </Card>
  );

  if (inline) return verificationCard;

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-lg">
        {verificationCard}
      </div>
    </div>
  );
}
