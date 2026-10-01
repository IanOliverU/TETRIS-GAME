"use client";
import { useTheme, type BlockStyle, type Theme } from "@/lib/theme";

export default function ThemeSwitcher() {
  const { theme, setTheme, blockStyle, setBlockStyle, soundOn, setSoundOn } = useTheme();
  return (
    <div className="theme-bar">
      <span className="theme-bar__brand">▦ TETRIS BATTLE</span>
      <div className="theme-bar__settings">
        <label className="theme-bar__control">
          <span>THEME</span>
          <select value={theme} onChange={(e) => { document.documentElement.dataset.theme = e.target.value; setTheme(e.target.value as Theme); }} aria-label="Color theme">
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="vscode">VS Code Dark+</option>
          <option value="one-dark">One Dark Pro</option>
          <option value="monokai">Monokai</option>
          <option value="solarized">Solarized Light</option>
          </select>
        </label>
        <label className="theme-bar__control">
          <span>BLOCKS</span>
          <select value={blockStyle} onChange={(e) => setBlockStyle(e.target.value as BlockStyle)} aria-label="Block style">
            <option value="bevel">Beveled</option>
            <option value="flat">Flat</option>
            <option value="outline">Outline</option>
          </select>
        </label>
        <label className="theme-bar__control theme-bar__sound">
          <input type="checkbox" checked={soundOn} onChange={(e) => setSoundOn(e.target.checked)} />
          <span>SOUND</span>
        </label>
      </div>
    </div>
  );
}
