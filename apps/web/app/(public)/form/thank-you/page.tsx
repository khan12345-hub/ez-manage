import { Suspense } from "react";
import ThankYouContent from "./ThankYouContent";

export default function ThankYouPage() {
  return (
    <Suspense fallback={null}>
      <ThankYouContent />
    </Suspense>
  );
}