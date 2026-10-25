import AppShell from "@/components/platform/AppShell";
import { PlatformProvider } from "@/components/platform/store";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlatformProvider>
      <AppShell>{children}</AppShell>
    </PlatformProvider>
  );
}
