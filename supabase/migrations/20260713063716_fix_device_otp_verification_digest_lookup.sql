-- The verifier uses pgcrypto's digest() while keeping a restricted function
-- search path. Include the extension schema so OTP checks reach comparison.
alter function public.verify_device_verification_otp(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text
) set search_path = public, extensions;
