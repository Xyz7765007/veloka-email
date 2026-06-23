import { cookies } from "next/headers";
import { ACCESS_COOKIE, cookieValid, accessConfigured } from "@/lib/auth";
import { Gate } from "@/components/Gate";
import { AdminConsole } from "@/components/AdminConsole";

// Reads the access cookie, so this route must render dynamically.
export const dynamic = "force-dynamic";

export default function Page() {
  const value = cookies().get(ACCESS_COOKIE)?.value;
  if (!cookieValid(value)) {
    return <Gate configured={accessConfigured()} />;
  }
  return <AdminConsole />;
}
