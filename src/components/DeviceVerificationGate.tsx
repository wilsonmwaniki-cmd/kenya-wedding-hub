import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

export function DeviceVerificationGate() {
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

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-lg">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Verify this device</CardTitle>
            <CardDescription>
              {deviceVerificationMessage ?? 'We noticed a sign-in from a new device. Enter the code sent to your email to continue.'}
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
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="button" onClick={() => void handleVerify()} disabled={deviceVerificationSubmitting || otpCode.length !== 6} className="flex-1">
                {deviceVerificationSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Verify device
              </Button>
              <Button type="button" variant="outline" onClick={() => void handleResend()} disabled={deviceVerificationSubmitting}>
                Resend code
              </Button>
            </div>

            <Button type="button" variant="ghost" className="w-full" onClick={() => void signOut()}>
              Sign out instead
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
