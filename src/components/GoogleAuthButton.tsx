import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.9-5.4 3.9-3.2 0-5.8-2.7-5.8-6s2.6-6 5.8-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.3 14.6 2.4 12 2.4c-5.3 0-9.6 4.3-9.6 9.6s4.3 9.6 9.6 9.6c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.5H12z"
      />
      <path
        fill="#34A853"
        d="M2.4 7.8l3.2 2.3C6.5 7.9 9 6 12 6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.3 14.6 2.4 12 2.4 8.3 2.4 5.1 4.5 3.5 7.5l-1.1.3z"
      />
      <path
        fill="#FBBC05"
        d="M12 21.6c2.5 0 4.5-.8 6-2.2l-2.9-2.4c-.8.6-1.9 1-3.1 1-3.8 0-5.2-2.6-5.4-3.8l-3.3 2.5c1.6 3.1 4.8 4.9 8.7 4.9z"
      />
      <path
        fill="#4285F4"
        d="M21.1 12.3c0-.6-.1-1.1-.2-1.5H12v3.9h5.4c-.3 1.4-1.4 2.5-2.3 3.2l2.9 2.4c1.7-1.6 3.1-4 3.1-8z"
      />
    </svg>
  );
}

interface GoogleAuthButtonProps {
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void | Promise<void>;
  text?: string;
}

export default function GoogleAuthButton({
  disabled,
  loading,
  onClick,
  text = "Continue with Google",
}: GoogleAuthButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={disabled || loading}
      onClick={() => void onClick()}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
      {text}
    </Button>
  );
}
