import { PlatformProvider } from "@/components/platform/store";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return <PlatformProvider>{children}</PlatformProvider>;
}
