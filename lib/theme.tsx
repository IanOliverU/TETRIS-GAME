"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark" | "vscode" | "one-dark" | "monokai" | "solarized";
export type BlockStyle = "bevel" | "flat" | "outline";

const ThemeContext = createContext<{
  theme: Theme; setTheme: (theme: Theme) => void;
  blockStyle: BlockStyle; setBlockStyle: (style: BlockStyle) => void;
  soundOn: boolean; setSoundOn: (enabled: boolean) => void;
}>({
  theme: "light",
  setTheme: () => {},
  blockStyle: "bevel",
  setBlockStyle: () => {},
  soundOn: true,
  setSoundOn: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [blockStyle, setBlockStyle] = useState<BlockStyle>("bevel");
  const [soundOn, setSoundOn] = useState(true);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === "light" || theme === "solarized" ? "light" : "dark";
  }, [theme]);
  return <ThemeContext.Provider value={{ theme, setTheme, blockStyle, setBlockStyle, soundOn, setSoundOn }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
