export const font =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif";
export const mono = "'SF Mono', 'JetBrains Mono', Menlo, monospace";

/* Pure black / dark-gray monochrome palette */
export const c = {
  bg:            "#000000",
  bgSubtle:      "#080808",
  panel:         "#0d0d0d",
  panelAlt:      "#141414",
  sidebar:       "#060606",
  sidebarText:   "#e6e6e6",
  sidebarMuted:  "#8a8a8a",
  sidebarActive: "#1c1c1c",
  sidebarHover:  "#131313",

  border:        "#232323",
  borderSoft:    "#1a1a1a",
  borderStrong:  "#333333",

  text:          "#ededed",
  muted:         "#9a9a9a",
  faint:         "#5e5e5e",
  dim:           "#3d3d3d",

  accent:        "#e8e8e8",
  accentStrong:  "#ffffff",
  accentSoft:    "rgba(255,255,255,0.10)",

  green:         "#8f8f8f",
  greenSoft:     "rgba(200,200,200,0.10)",
  red:           "#6f6f6f",
  redSoft:       "rgba(120,120,120,0.10)",
  blue:          "#b4b4b4",
  blueSoft:      "rgba(180,180,180,0.12)",
  purple:        "#a5a5a5",
  purpleSoft:    "rgba(165,165,165,0.10)",
  amber:         "#c4c4c4",
  amberSoft:     "rgba(196,196,196,0.10)",

  chip:          "#141414",
  chipHover:     "#212121",
  input:         "#0b0b0b",
  scrollbar:     "#262626",
  codeBg:        "#0a0a0a",

  diffAdd:       "rgba(255,255,255,0.055)",
  diffAddText:   "#dcdcdc",
  diffDel:       "rgba(255,255,255,0.02)",
  diffDelText:   "#6b6b6b",

  shadow:        "0 1px 3px rgba(0,0,0,0.9), 0 8px 28px rgba(0,0,0,0.7)",
  shadowPop:     "0 18px 50px rgba(0,0,0,0.85), 0 2px 10px rgba(0,0,0,0.7)",
};

/* Editor token colors — monochrome, differentiated by brightness */
export const tok = {
  plain:   "#c9c9c9",
  keyword: "#ffffff",
  string:  "#9e9e9e",
  comment: "#4f4f4f",
  number:  "#bdbdbd",
  fn:      "#e2e2e2",
  punct:   "#6e6e6e",
};
