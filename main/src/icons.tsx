import type { JSX } from "react";

const P = {
  send: <path d="M3.5 4.2 20 12 3.5 19.8 6 12 3.5 4.2ZM6 12h14" />,
  bot: (
    <>
      <rect x="4" y="8" width="16" height="11" rx="3" />
      <path d="M12 4.5V8M9.5 13h.01M14.5 13h.01M9 16.5h6" />
      <circle cx="12" cy="3.6" r="1.1" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <path d="M17 13.5v7M13.5 17h7" />
    </>
  ),
  chat: <path d="M4 5.5h16v10H8.5L4.5 19V5.5Z" />,
  pin: <path d="M9 3.5h6l-.8 5.2 3.3 3v1.6h-5v6.2l-.6 1.2-.6-1.2v-6.2h-5v-1.6l3.3-3L9 3.5Z" />,
  dots: (
    <>
      <circle cx="5.5" cy="12" r="1.3" />
      <circle cx="12" cy="12" r="1.3" />
      <circle cx="18.5" cy="12" r="1.3" />
    </>
  ),
  arrowLeft: <path d="M14.5 5.5 8 12l6.5 6.5" />,
  arrowRight: <path d="M9.5 5.5 16 12l-6.5 6.5" />,
  arrowUp: <path d="M12 19V5.5M6 11.5 12 5.5l6 6" />,
  sliders: <path d="M4 7h10M18 7h2M4 17h4M12 17h8M16 4.8v4.4M8 14.8v4.4" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1A2 2 0 1 1 4.5 16l.1-.1A1.6 1.6 0 0 0 3.5 13H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1A2 2 0 1 1 7 3.4l.1.1A1.6 1.6 0 0 0 9.8 2.4V2a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.8 1.1l.1-.1A2 2 0 1 1 19.5 6l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.4a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.3 1.8Z" />
    </>
  ),
  chevUpDown: <path d="M8 10 12 6l4 4M8 14l4 4 4-4" />,
  chevDown: <path d="M6 9.5 12 15.5l6-6" />,
  chevRight: <path d="M9.5 6 15.5 12l-6 6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.2" />
      <path d="M15.6 15.6 20 20" />
    </>
  ),
  panel: (
    <>
      <rect x="3.2" y="4.5" width="17.6" height="15" rx="2.6" />
      <path d="M9.5 4.5v15" />
    </>
  ),
  columns: (
    <>
      <rect x="3.2" y="4.5" width="17.6" height="15" rx="2.6" />
      <path d="M12 4.5v15" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
    </>
  ),
  moon: <path d="M20 14.2A8.4 8.4 0 0 1 9.8 4 8.4 8.4 0 1 0 20 14.2Z" />,
  maximize: <path d="M9 4.5H4.5V9M15 4.5h4.5V9M15 19.5h4.5V15M9 19.5H4.5V15" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  minus: <path d="M5 12h14" />,
  check: <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.2 12.3 11 15l4.8-5.6" />
    </>
  ),
  circle: <circle cx="12" cy="12" r="8" />,
  dot: <circle cx="12" cy="12" r="3.4" />,
  gitCommit: (
    <>
      <circle cx="12" cy="12" r="3.4" />
      <path d="M3 12h5.6M15.4 12H21" />
    </>
  ),
  gitBranch: (
    <>
      <circle cx="7" cy="5.5" r="2.2" />
      <circle cx="7" cy="18.5" r="2.2" />
      <circle cx="17" cy="9" r="2.2" />
      <path d="M7 7.7v8.6M17 11.2c0 3.2-3.2 3.6-5.6 4.3-1.7.5-2.4 1.4-2.4 2.6" />
    </>
  ),
  pr: (
    <>
      <circle cx="6.5" cy="6" r="2.2" />
      <circle cx="6.5" cy="18" r="2.2" />
      <circle cx="17.5" cy="18" r="2.2" />
      <path d="M6.5 8.2v7.6M17.5 15.8V9.5a3 3 0 0 0-3-3h-3m0 0 2-2m-2 2 2 2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  file: <path d="M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-5.5-5.5Zm0 0V9H19" />,
  fileDiff: (
    <>
      <path d="M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-5.5-5.5Z" />
      <path d="M12 10v4M10 12h4M9.5 17.5h5" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2.2" />
      <path d="M15.5 5.5A2 2 0 0 0 13.5 4H6.5a2 2 0 0 0-2 2v7a2 2 0 0 0 1.5 1.9" />
    </>
  ),
  play: <path d="M7.5 5.2 18.5 12 7.5 18.8V5.2Z" />,
  mic: (
    <>
      <rect x="9" y="3" width="6" height="10.5" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
    </>
  ),
  sparkle: <path d="M12 3.2 13.9 9 19.8 11 13.9 13 12 18.8 10.1 13 4.2 11 10.1 9 12 3.2ZM18.5 3.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" />,
  terminal: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2.6" />
      <path d="M7 10l2.6 2.4L7 15M12.8 15.4h4.2" />
    </>
  ),
  folder: <path d="M3.5 6.5a2 2 0 0 1 2-2h3.2l2 2.4h7.8a2 2 0 0 1 2 2v8.6a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-11Z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.2l3.2 2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.4" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  zap: <path d="M13.2 2.5 4.5 13.5h6L10.8 21.5 19.5 10.5h-6l-.3-8Z" />,
  download: <path d="M12 3.5v11m0 0 4-4m-4 4-4-4M4.5 17v2a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-2" />,
  bars: <path d="M5 20V13M12 20V4M19 20v-9" />,
  pencil: <path d="M4 20l.9-4L16.2 4.7a2 2 0 0 1 2.8 0l.3.3a2 2 0 0 1 0 2.8L8 19.1 4 20Z" />,
  enter: <path d="M20 5.5v6a3 3 0 0 1-3 3H5m0 0 4.5-4.5M5 14.5 9.5 19" />,
  window: (
    <>
      <rect x="3.2" y="4.5" width="17.6" height="15" rx="2.6" />
      <path d="M3.2 9h17.6M6.4 6.8h.01M9 6.8h.01" />
    </>
  ),
  cloud: <path d="M7.2 19a4.2 4.2 0 0 1-.5-8.4 5.4 5.4 0 0 1 10.3-1.2A3.9 3.9 0 0 1 17 19H7.2Z" />,
  alert: (
    <>
      <path d="M12 4.2 21 19.5H3L12 4.2Z" />
      <path d="M12 10v3.6M12 16.6h.01" />
    </>
  ),
  loader: <path d="M12 3.5v3.2M12 17.3v3.2M3.5 12h3.2M17.3 12h3.2M5.9 5.9l2.3 2.3M15.8 15.8l2.3 2.3M18.1 5.9l-2.3 2.3M8.2 15.8l-2.3 2.3" />,
  book: <path d="M4 5a2 2 0 0 1 2-2h4.5v18H6a2 2 0 0 1-2-2V5Zm6.5-2H18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7.5" />,
  code: <path d="M8.5 8 4.5 12l4 4M15.5 8l4 4-4 4M13.5 5l-3 14" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5M16 5.2a3.2 3.2 0 0 1 0 6M17.5 14.9c2 .6 3.2 2.3 3.2 4.6" />
    </>
  ),
  list: <path d="M4.5 7h.01M4.5 12h.01M4.5 17h.01M9 7h11M9 12h11M9 17h11" />,
  todo: (
    <>
      <rect x="3.5" y="4" width="17" height="16" rx="2.4" />
      <path d="M7.5 9.5 9 11l3-3.4M7.5 16l1.5 1.5 3-3.4M14.5 9.5H17M14.5 16H17" />
    </>
  ),
  wrench: <path d="M15.6 3.6a5.4 5.4 0 0 0-6.4 7l-5.4 5.4a2 2 0 0 0 0 2.8l1 1a2 2 0 0 0 2.8 0l5.4-5.4a5.4 5.4 0 0 0 7-6.4l-3.2 3.2-3-.6-.6-3 2.4-4Z" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.6 9.5h16.8M3.6 14.5h16.8M12 3.5c2.4 2.4 3.4 5.4 3.4 8.5S14.4 18.1 12 20.5c-2.4-2.4-3.4-5.4-3.4-8.5S9.6 5.9 12 3.5Z" />
    </>
  ),
  command: <path d="M8.5 5.5a2.5 2.5 0 1 0 2.5 2.5v8a2.5 2.5 0 1 0 2.5-2.5h-8a2.5 2.5 0 1 0 2.5 2.5V8a2.5 2.5 0 1 0-2.5 2.5h8A2.5 2.5 0 1 0 15.5 8" />,
  trash: <path d="M4.5 6.5h15M9.5 6.5V4.8A1.3 1.3 0 0 1 10.8 3.5h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7M6.5 6.5l.9 12a2 2 0 0 0 2 1.9h5.2a2 2 0 0 0 2-1.9l.9-12M10 10.5v6M14 10.5v6" />,
  refresh: <path d="M20 11.5a8 8 0 1 0-.6 4.5M20 4.5v5h-5" />,
  star: <path d="m12 3.6 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8L12 3.6Z" />,
  external: <path d="M14 4.5h5.5V10M19.5 4.5 11 13M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5V8A1.5 1.5 0 0 1 6 6.5h4.5" />,
  layers: <path d="m12 3.5 8.5 4.3L12 12 3.5 7.8 12 3.5ZM3.5 12 12 16.2 20.5 12M3.5 16.2 12 20.5l8.5-4.3" />,
  cpu: (
    <>
      <rect x="6.5" y="6.5" width="11" height="11" rx="2.2" />
      <path d="M9.8 3v3.5M14.2 3v3.5M9.8 17.5V21M14.2 17.5V21M3 9.8h3.5M3 14.2h3.5M17.5 9.8H21M17.5 14.2H21" />
    </>
  ),
  shield: <path d="M12 3.2 20 6v6.2c0 4.6-3.3 7.4-8 8.6-4.7-1.2-8-4-8-8.6V6l8-2.8ZM9 12.2l2.2 2.2 4-4.4" />,
  filter: <path d="M3.5 5.5h17l-6.6 7.6v5.6l-3.8 2v-7.6L3.5 5.5Z" />,
  inbox: <path d="M3.5 13.5h4l1.5 3h6l1.5-3h4M3.5 13.5 6 5.2a2 2 0 0 1 1.9-1.4h8.2A2 2 0 0 1 18 5.2l2.5 8.3v4.3a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-4.3Z" />,
  flame: <path d="M12 21c3.6 0 6.2-2.4 6.2-5.8 0-4.4-4.6-5.6-3.6-11.2-3 1-6 4.2-6 8 0 1.6-1 2-1.6 1.2-.5-.6-.7-1.6-.7-2.4-1 1.4-1.5 3-1.5 4.6C4.8 18.6 8 21 12 21Z" />,
  brain: <path d="M9.5 3.5A3 3 0 0 0 6.6 7 3 3 0 0 0 5 12.4 3.2 3.2 0 0 0 7 18a3 3 0 0 0 5.5-1.6V5.6a2.1 2.1 0 0 0-3-2.1ZM14.5 3.5A3 3 0 0 1 17.4 7a3 3 0 0 1 1.6 5.4A3.2 3.2 0 0 1 17 18a3 3 0 0 1-4.5-1.6" />,
  spinner: <path d="M12 3.5a8.5 8.5 0 1 1-8.5 8.5" />,
  branchSm: (
    <>
      <circle cx="6.5" cy="6" r="2" />
      <circle cx="6.5" cy="18" r="2" />
      <circle cx="17.5" cy="7.5" r="2" />
      <path d="M6.5 8v8M17.5 9.5c0 3-3.4 3.6-6 4.4-1.8.6-2.6 1.6-2.6 2.6" />
    </>
  ),
  github: (
    <path d="M9 19.5c-4.5 1.4-4.5-2.3-6.3-2.8m12.6 5.3v-3.6a3.1 3.1 0 0 0-.9-2.4c2.9-.3 6-1.4 6-6.4a5 5 0 0 0-1.4-3.4 4.6 4.6 0 0 0-.1-3.5s-1.1-.3-3.6 1.4a12.3 12.3 0 0 0-6.5 0C6.3 2.4 5.2 2.7 5.2 2.7a4.6 4.6 0 0 0-.1 3.5 5 5 0 0 0-1.4 3.5c0 4.9 3 6 5.9 6.4a3.1 3.1 0 0 0-.9 2.3V22" />
  ),
  upload: <path d="M12 16.5V4.5m0 0-4 4m4-4 4 4M4.5 16.5v2.2A1.8 1.8 0 0 0 6.3 20.5h11.4a1.8 1.8 0 0 0 1.8-1.8v-2.2" />,
  workflow: (
    <>
      <rect x="3" y="3.5" width="7" height="6" rx="1.8" />
      <rect x="14" y="14.5" width="7" height="6" rx="1.8" />
      <path d="M10 6.5h4.5a2 2 0 0 1 2 2v6M6.5 9.5v5a2 2 0 0 0 2 2H14" />
    </>
  ),
  wand: <path d="M4 20 15 9m0 0 2.5-2.5M15 9l-2-2 2.5-2.5 2 2L15 9Zm-8-4.5.6 1.9 1.9.6-1.9.6L7 9.5l-.6-1.9-1.9-.6 1.9-.6L7 4.5Zm12 8 .5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5.5-1.5Z" />,
  monitor: (
    <>
      <rect x="2.8" y="4" width="18.4" height="12.5" rx="2.2" />
      <path d="M9 20.5h6M12 16.5v4" />
    </>
  ),
  tablet: (
    <>
      <rect x="5" y="2.5" width="14" height="19" rx="2.5" />
      <circle cx="12" cy="18.5" r="1" />
    </>
  ),
  laptop: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M1 18h22" />
    </>
  ),
  pointer: <path d="m6 3.5 12.5 7.6-5.4 1.3-2.4 5.2L6 3.5Z" />,
  stop: <rect x="6.5" y="6.5" width="11" height="11" rx="2" />,
  boxes: (
    <>
      <rect x="2.8" y="12.8" width="8" height="8" rx="1.8" />
      <rect x="13.2" y="12.8" width="8" height="8" rx="1.8" />
      <rect x="8" y="3.2" width="8" height="8" rx="1.8" />
    </>
  ),
  link: <path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 1 0-5.7-5.7l-1.4 1.4M13.5 10.5a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 1 0 5.7 5.7l1.4-1.4" />,
  image: (
    <>
      <rect x="3.2" y="4.5" width="17.6" height="15" rx="2.4" />
      <circle cx="8.6" cy="9.6" r="1.6" />
      <path d="m3.6 17 4.8-4.4 3.4 3 3-2.6 5.4 4.8" />
    </>
  ),
  save: <path d="M5.5 3.5h10L20.5 8.5v10a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Zm2 0v5h7v-5m-7 12h9" />,
  rocket: <path d="M12.5 3.5c3.4 1.4 5.6 4.6 6 8.5l-4 4c-3.9-.4-7.1-2.6-8.5-6l4-4a10 10 0 0 1 2.5-2.5ZM6 15c-1.4 1.4-1.7 4.4-1.7 4.4S7.3 19.1 8.7 17.7M13.8 9.9a1.6 1.6 0 1 0 2.3-2.3 1.6 1.6 0 0 0-2.3 2.3Z" />,
  swap: <path d="M7 4.5 3.5 8 7 11.5M3.5 8h13M17 12.5l3.5 3.5L17 19.5M20.5 16h-13" />,
  gauge: (
    <>
      <path d="M4 17.5a9 9 0 1 1 16 0" />
      <path d="m12 13.5 3.5-3.5" />
      <circle cx="12" cy="14" r="1.4" />
    </>
  ),
  doc: <path d="M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-5.5-5.5Zm0 0V9H19M8.5 13h7M8.5 16.5h5" />,
  key: (
    <>
      <circle cx="8" cy="12" r="3.6" />
      <path d="M11.6 12H21l-1.8 2.4M17 12v2.6" />
    </>
  ),
  server: (
    <>
      <rect x="3.2" y="4" width="17.6" height="7" rx="2" />
      <rect x="3.2" y="13" width="17.6" height="7" rx="2" />
      <path d="M7 7.5h.01M7 16.5h.01M10 7.5h.01M10 16.5h.01" />
    </>
  ),
  hook: <path d="M15.5 4.5v9a3.5 3.5 0 1 1-3.5-3.5H21M15.5 4.5H21v5.5" />,
  agentBadge: (
    <>
      <circle cx="12" cy="9" r="4" />
      <path d="M4.5 20.5c1.2-3.2 4.2-5 7.5-5s6.3 1.8 7.5 5" />
      <circle cx="18" cy="6" r="2.4" fill="currentColor" stroke="none" opacity="0.85" />
    </>
  ),
  slash: <path d="m6 20 12-16" />,
  at: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5.5a2.5 2.5 0 0 0 4.5-1.5 8.5 8.5 0 1 0-3 6.5" />
    </>
  ),
  history: <path d="M3.5 12a8.5 8.5 0 1 0 3.2-6.6M3.5 4v5h5M12 7v5.2l3.2 2" />,
  branchMerge: (
    <>
      <circle cx="7" cy="5.5" r="2" />
      <circle cx="7" cy="18.5" r="2" />
      <circle cx="17" cy="12" r="2" />
      <path d="M7 7.5v9M7 7.5c0 3.5 3.5 4.5 8 4.5" />
    </>
  ),
  keyboard: (
    <>
      <rect x="2.8" y="6" width="18.4" height="12" rx="2" />
      <path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M6.5 13.5h.01M10 13.5h.01M13.5 13.5h.01M17 13.5h.01M8 16.5h8" />
    </>
  ),
  compress: <path d="M9 4v3.5a1.5 1.5 0 0 1-1.5 1.5H4M15 4v3.5a1.5 1.5 0 0 0 1.5 1.5H20M9 20v-3.5a1.5 1.5 0 0 0-1.5-1.5H4M15 20v-3.5a1.5 1.5 0 0 1 1.5-1.5H20" />,
  ide: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <path d="M3 9h18M6 12l1.5 1.5L6 15M10 15h4" />
    </>
  ),
  phone: (
    <>
      <rect x="7" y="2.6" width="10" height="18.8" rx="2.6" />
      <path d="M10.6 5h2.8M11 18.6h2" />
    </>
  ),
  qr: (
    <>
      <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.2" />
      <rect x="14" y="3.5" width="6.5" height="6.5" rx="1.2" />
      <rect x="3.5" y="14" width="6.5" height="6.5" rx="1.2" />
      <path d="M14 14h2.6v2.6H14zM18 18h2.5v2.5H18zM14 20.5v.01M20.5 14v.01" />
    </>
  ),
  logo: (
    <>
      <path d="M12 2.6 21 7.6v9L12 21.6 3 16.6v-9l9-5Z" />
      <path d="m3 7.6 9 5 9-5M12 12.6v9" />
    </>
  ),
} satisfies Record<string, JSX.Element>;

export type IconName = keyof typeof P;

export function Icon({
  name,
  size = 16,
  className = "",
  strokeWidth = 1.6,
  fill = false,
}: {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
  fill?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      shapeRendering="geometricPrecision"
    >
      {P[name]}
    </svg>
  );
}
