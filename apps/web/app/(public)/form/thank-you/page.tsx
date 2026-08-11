import { CheckCircle2 } from "lucide-react";


export const metadata = {
  title: "Thank You — Form Submitted",
  description: "Your response has been recorded.",
};

export default function ThankYouPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 text-center">
        {/* Icon */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-10 w-10 text-primary" />
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Thank you!</h1>

          <p className="text-sm text-muted-foreground">
            Your response has been recorded. We appreciate you taking the time
            to fill out this form.
          </p>
        </div>

        
      </div>
    </div>
  );
}
