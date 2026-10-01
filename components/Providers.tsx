"use client";
import { SessionProvider } from "@/lib/session";
import { ThemeProvider } from "@/lib/theme";
import ThemeSwitcher from "./ThemeSwitcher";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <ThemeProvider><SessionProvider><ThemeSwitcher />{children}</SessionProvider></ThemeProvider>;
}
