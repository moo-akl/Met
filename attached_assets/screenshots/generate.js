const fs = require("fs");

const GREEN = "#2EBD55";
const GREEN_LIGHT = "#F0FBF4";
const GREEN_BADGE = "#1A9E44";
const DARK = "#111827";
const MID = "#374151";
const GRAY = "#6B7280";
const LGRAY = "#9CA3AF";
const BORDER = "#E5E7EB";
const BG = "#F9FAFB";
const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif";

const W = 430;
const H = 932;
const HEADER_H = 278;

const FEATURES = [
  { icon: "users",         label: "Daily encounters",                  free: "20",       plus: "Unlimited", pro: "Unlimited", plusBold: true,  proBold: false },
  { icon: "image",         label: "Profile photos",                    free: "1",        plus: "3 (1+2)",   pro: "6 (1+5)",   plusBold: true,  proBold: false },
  { icon: "send",          label: "Reveal requests",                   free: "4 / day",  plus: "Unlimited", pro: "Unlimited", plusBold: true,  proBold: false },
  { icon: "message",       label: "Opening messages",                  free: null,       plus: "1 / day",   pro: "2 / day",   plusBold: true,  proBold: false },
  { icon: "clock",         label: "Full encounter history",            free: null,       plus: true,        pro: true,        plusBold: false, proBold: false },
  { icon: "eye",           label: "Read receipts",                     free: null,       plus: true,        pro: true,        plusBold: false, proBold: false },
  { icon: "repeat",        label: "Frequent paths",                    free: null,       plus: true,        pro: true,        plusBold: false, proBold: false },
  { icon: "lock",          label: "Privacy mode",                      free: null,       plus: true,        pro: true,        plusBold: false, proBold: false },
  { icon: "badge",         label: "Verified badge",                    free: null,       plus: true,        pro: true,        plusBold: false, proBold: false },
  { icon: "trend",         label: "Boost — rank higher in encounters", free: null,       plus: false,       pro: true,        plusBold: false, proBold: false },
  { icon: "eye2",          label: "See who viewed your profile",       free: null,       plus: false,       pro: true,        plusBold: false, proBold: false },
  { icon: "star",          label: "Premium gold badge",                free: null,       plus: false,       pro: true,        plusBold: false, proBold: false },
];

function icon(name, x, y) {
  const s = `stroke="${LGRAY}" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"`;
  const cx = x + 7, cy = y + 7;
  switch (name) {
    case "users":
      return `<circle cx="${cx-2}" cy="${cy-2}" r="3" ${s}/><path d="M${x},${y+13} C${x},${y+10} ${cx-5},${y+8} ${cx-2},${y+8} C${cx+1},${y+8} ${cx+4},${y+10} ${cx+4},${y+13}" ${s}/><path d="M${cx+4},${y+5} a2,2 0 0 1 0,4" ${s}/><path d="M${cx+8},${y+13} C${cx+8},${y+11} ${cx+6},${y+9} ${cx+4},${y+9}" ${s}/>`;
    case "image":
      return `<rect x="${x}" y="${y+1}" width="14" height="11" rx="1.5" ${s}/><path d="M${x},${y+8} l3,-3 2,2 3,-3 4,4" ${s}/><circle cx="${cx-3}" cy="${cy-2}" r="1.2" fill="${LGRAY}" stroke="none"/>`;
    case "send":
      return `<path d="M${x+13},${y+1} L${x+8},${y+13} L${x+6},${y+7} L${x},${y+5} Z" ${s}/><line x1="${x+13}" y1="${y+1}" x2="${x+6}" y2="${y+7}" ${s}/>`;
    case "message":
      return `<path d="M${x+13},${y+1} H${x+2} a1,1 0 0 0 -1,1 v7 a1,1 0 0 0 1,1 h2 l2,2.5 2,-2.5 h6 a1,1 0 0 0 1,-1 V${y+2} a1,1 0 0 0 -1,-1 Z" ${s}/>`;
    case "clock":
      return `<circle cx="${cx}" cy="${cy}" r="6" ${s}/><polyline points="${cx},${cy-3} ${cx},${cy} ${cx+3},${cy+1.5}" ${s}/>`;
    case "eye":
      return `<path d="M${x+1},${cy} C${x+4},${y+2} ${x+10},${y+2} ${x+13},${cy} C${x+10},${y+12} ${x+4},${y+12} ${x+1},${cy}" ${s}/><circle cx="${cx}" cy="${cy}" r="2" ${s}/>`;
    case "repeat":
      return `<polyline points="${x+11},${y+1} ${x+14},${y+4} ${x+11},${y+7}" ${s}/><path d="M${x+3},${y+4} h9 a2,2 0 0 1 2,2 v2" ${s}/><polyline points="${x+3},${y+13} ${x},${y+10} ${x+3},${y+7}" ${s}/><path d="M${x+11},${y+10} h-9 a2,2 0 0 1 -2,-2 V${y+6}" ${s}/>`;
    case "lock":
      return `<rect x="${x+2}" y="${y+7}" width="10" height="7" rx="1.5" ${s}/><path d="M${x+4},${y+7} V${y+4} a3,3 0 0 1 6,0 v3" ${s}/>`;
    case "badge":
      return `<circle cx="${cx}" cy="${cy}" r="6" ${s}/><polyline points="${cx-2},${cy} ${cx},${cy+2} ${cx+3},${cy-2}" ${s}/>`;
    case "trend":
      return `<polyline points="${x},${y+11} ${x+4},${y+7} ${x+7},${y+10} ${x+14},${y+3}" ${s}/><polyline points="${x+10},${y+3} ${x+14},${y+3} ${x+14},${y+7}" ${s}/>`;
    case "eye2":
      return `<path d="M${x+1},${cy} C${x+4},${y+2} ${x+10},${y+2} ${x+13},${cy}" ${s}/><circle cx="${cx}" cy="${cy}" r="2.5" ${s}/><path d="M${cx+3},${cy+5} l2,2" ${s}/><polyline points="${cx+4},${cy+7} ${cx+6},${cy+7} ${cx+6},${cy+4}" ${s}/>`;
    case "star":
      return `<polygon points="${cx},${y+1} ${cx+2},${y+6} ${x+14},${y+6} ${cx+3},${y+9} ${cx+5},${y+14} ${cx},${y+11} ${cx-5},${y+14} ${cx-3},${y+9} ${x},${y+6} ${cx-2},${y+6}" ${s}/>`;
    default:
      return `<rect x="${x}" y="${y}" width="14" height="14" rx="2" ${s}/>`;
  }
}

function check(cx, cy, color) {
  return `<polyline points="${cx-4},${cy} ${cx-1},${cy+3} ${cx+4},${cy-4}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function cross(cx, cy) {
  return `<line x1="${cx-3}" y1="${cy-3}" x2="${cx+3}" y2="${cy+3}" stroke="${LGRAY}" stroke-width="1.8" stroke-linecap="round"/><line x1="${cx+3}" y1="${cy-3}" x2="${cx-3}" y2="${cy+3}" stroke="${LGRAY}" stroke-width="1.8" stroke-linecap="round"/>`;
}

function cellValue(val, isPlus, cx, cy, tier) {
  const activeColor = GREEN;
  const inactiveColor = MID;
  const xColor = LGRAY;
  if (val === null || val === false) return cross(cx, cy);
  if (val === true) {
    const color = (tier === "plus" && isPlus) || (tier === "pro" && !isPlus) ? activeColor : (tier === "plus" && !isPlus) ? inactiveColor : inactiveColor;
    const c = tier === "plus" ? (isPlus ? activeColor : inactiveColor) : (!isPlus ? activeColor : inactiveColor);
    return check(cx, cy, c);
  }
  const c = tier === "plus" ? (isPlus ? activeColor : inactiveColor) : (!isPlus ? activeColor : inactiveColor);
  const fw = (c === activeColor) ? "700" : "500";
  return `<text x="${cx}" y="${cy+4}" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="${fw}" fill="${c}">${val}</text>`;
}

function freeCell(val, cx, cy) {
  if (val === null || val === false) return cross(cx, cy);
  if (val === true) return check(cx, cy, LGRAY);
  return `<text x="${cx}" y="${cy+4}" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="500" fill="${MID}">${val}</text>`;
}

function statusBar() {
  return `
  <text x="28" y="22" font-family="${FONT}" font-size="15" font-weight="600" fill="white">9:41</text>
  <rect x="295" y="15" width="4" height="8" rx="1" fill="white"/><rect x="302" y="12" width="4" height="11" rx="1" fill="white"/><rect x="309" y="9" width="4" height="14" rx="1" fill="white"/><rect x="316" y="6" width="4" height="17" rx="1" fill="white"/>
  <path d="M328 20 Q333 15 338 20" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round"/><path d="M325 17 Q333 10 341 17" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round"/><circle cx="333" cy="22" r="2" fill="white"/>
  <rect x="348" y="12" width="26" height="13" rx="3" fill="none" stroke="white" stroke-opacity="0.5" stroke-width="1.2"/><rect x="350" y="14" width="20" height="9" rx="1.5" fill="white"/><rect x="375" y="15.5" width="2" height="6" rx="1" fill="white" fill-opacity="0.5"/>
  <rect x="153" y="9" width="90" height="28" rx="20" fill="black"/>`;
}

function generateSVG(tier) {
  const isPlus = tier === "plus";

  const moPrice = isPlus ? "$2.99" : "$4.99";
  const yrPrice = isPlus ? "$29.99" : "$49.99";
  const yrPerMo = isPlus ? "$2.50 / mo" : "$4.17 / mo";
  const savePct = isPlus ? "Save 16%" : "Save 17%";
  const headline1 = isPlus ? "Connect with everyone" : "The ultimate Met";
  const headline2 = isPlus ? "you cross paths with." : "experience.";
  const subtitle1 = isPlus ? "Unlimited reveals, full history, and your" : "Boost, gold badge, see who viewed you,";
  const subtitle2 = isPlus ? "verified badge." : "and everything in Plus.";
  const tierLabel = isPlus ? "Met Plus" : "Met Pro";
  const ctaPrice = isPlus ? `Start Met Plus — $29.99 / year` : `Start Met Pro — $49.99 / year`;

  // Layout constants
  const TABS_Y = 286;
  const CARDS_Y = 346;
  const CARDS_H = 100;
  const TABLE_HDR_Y = 460;
  const TABLE_HDR_H = 26;
  const ROW_START_Y = TABLE_HDR_Y + TABLE_HDR_H;
  const ROW_H = 26;
  const LONG_ROW_H = 37;
  const SHORT_ROWS = 9;
  const LONG_ROWS = 3;
  const TABLE_END_Y = ROW_START_Y + SHORT_ROWS * ROW_H + LONG_ROWS * LONG_ROW_H;
  const CTA_Y = TABLE_END_Y + 10;

  // Column centers
  const FC = 238; // FREE center
  const PC = 310; // PLUS center
  const RC = 390; // PRO center

  let rows = "";
  let rowY = ROW_START_Y;
  FEATURES.forEach((f, i) => {
    const isLong = i >= 9;
    const rh = isLong ? LONG_ROW_H : ROW_H;
    const midY = rowY + rh / 2;
    const textY = isLong ? rowY + 16 : rowY + rh / 2 + 4.5;
    const rowBg = i % 2 === 0 ? "white" : "#FAFAFA";
    rows += `<rect x="0" y="${rowY}" width="${W}" height="${rh}" fill="${rowBg}"/>`;
    rows += `<g>${icon(f.icon, 14, rowY + (rh - 14) / 2)}</g>`;
    if (isLong) {
      const words = f.label.split(" ");
      const half = Math.ceil(words.length / 2);
      const l1 = words.slice(0, half).join(" ");
      const l2 = words.slice(half).join(" ");
      rows += `<text x="36" y="${rowY + 16}" font-family="${FONT}" font-size="12" fill="${MID}">${l1}</text>`;
      rows += `<text x="36" y="${rowY + 29}" font-family="${FONT}" font-size="12" fill="${MID}">${l2}</text>`;
    } else {
      rows += `<text x="36" y="${textY}" font-family="${FONT}" font-size="12.5" fill="${MID}">${f.label}</text>`;
    }
    rows += freeCell(f.free, FC, midY);
    rows += cellValue(f.plus, true, PC, midY, tier);
    rows += cellValue(f.pro, false, RC, midY, tier);
    rows += `<line x1="0" y1="${rowY + rh}" x2="${W}" y2="${rowY + rh}" stroke="${BORDER}" stroke-width="0.6"/>`;
    rowY += rh;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="white"/>

  <!-- GREEN HEADER -->
  <rect width="${W}" height="${HEADER_H}" fill="${GREEN}"/>

  <!-- Rounded bottom edge of header -->
  <path d="M0,${HEADER_H - 20} Q0,${HEADER_H} 20,${HEADER_H} H${W - 20} Q${W},${HEADER_H} ${W},${HEADER_H - 20} V${HEADER_H} H0 Z" fill="white"/>

  ${statusBar()}

  <!-- tier pill badge -->
  <rect x="18" y="44" width="${isPlus ? 108 : 104}" height="28" rx="14" fill="white" fill-opacity="0.2"/>
  <text x="35" y="63" font-family="${FONT}" font-size="13" font-weight="700" fill="white">⚡ ${tierLabel}</text>

  <!-- X button -->
  <circle cx="404" cy="58" r="15" fill="white" fill-opacity="0.18"/>
  <line x1="397" y1="51" x2="411" y2="65" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
  <line x1="411" y1="51" x2="397" y2="65" stroke="white" stroke-width="2.2" stroke-linecap="round"/>

  <!-- Headline -->
  <text x="22" y="112" font-family="${FONT}" font-size="26" font-weight="800" fill="white">${headline1}</text>
  <text x="22" y="143" font-family="${FONT}" font-size="26" font-weight="800" fill="white">${headline2}</text>
  <text x="22" y="172" font-family="${FONT}" font-size="13.5" fill="white" fill-opacity="0.85">${subtitle1}</text>
  <text x="22" y="190" font-family="${FONT}" font-size="13.5" fill="white" fill-opacity="0.85">${subtitle2}</text>

  <!-- WHITE AREA background -->
  <rect x="0" y="${HEADER_H}" width="${W}" height="${H - HEADER_H}" fill="white"/>

  <!-- TAB SELECTOR -->
  <rect x="12" y="${TABS_Y}" width="${W - 24}" height="46" rx="12" fill="#F3F4F6"/>
  ${isPlus
    ? `<rect x="16" y="${TABS_Y + 4}" width="${(W - 24) / 2 - 2}" height="38" rx="9" fill="${GREEN}"/>
       <text x="${16 + (W - 24) / 4}" y="${TABS_Y + 29}" text-anchor="middle" font-family="${FONT}" font-size="15" font-weight="700" fill="white">⚡ Met Plus</text>
       <text x="${16 + (W - 24) * 3 / 4 + 2}" y="${TABS_Y + 29}" text-anchor="middle" font-family="${FONT}" font-size="15" font-weight="600" fill="${GRAY}">☆ Met Pro</text>`
    : `<rect x="${16 + (W - 24) / 2}" y="${TABS_Y + 4}" width="${(W - 24) / 2 - 2}" height="38" rx="9" fill="${GREEN}"/>
       <text x="${16 + (W - 24) / 4}" y="${TABS_Y + 29}" text-anchor="middle" font-family="${FONT}" font-size="15" font-weight="600" fill="${GRAY}">⚡ Met Plus</text>
       <text x="${16 + (W - 24) * 3 / 4 + 2}" y="${TABS_Y + 29}" text-anchor="middle" font-family="${FONT}" font-size="15" font-weight="700" fill="white">☆ Met Pro</text>`
  }

  <!-- PRICING CARDS -->
  <!-- Monthly card -->
  <rect x="12" y="${CARDS_Y}" width="${(W - 28) / 2}" height="${CARDS_H}" rx="10" fill="white" stroke="${BORDER}" stroke-width="1.5"/>
  <text x="26" y="${CARDS_Y + 20}" font-family="${FONT}" font-size="13" font-weight="600" fill="${MID}">Monthly</text>
  <text x="26" y="${CARDS_Y + 55}" font-family="${FONT}" font-size="30" font-weight="800" fill="${DARK}">${moPrice}</text>
  <text x="26" y="${CARDS_Y + 76}" font-family="${FONT}" font-size="11" fill="${LGRAY}">Billed monthly</text>

  <!-- Yearly card (highlighted) -->
  <rect x="${12 + (W - 28) / 2 + 4}" y="${CARDS_Y}" width="${(W - 28) / 2}" height="${CARDS_H}" rx="10" fill="${GREEN_LIGHT}" stroke="${GREEN}" stroke-width="2"/>
  <text x="${12 + (W - 28) / 2 + 18}" y="${CARDS_Y + 20}" font-family="${FONT}" font-size="13" font-weight="600" fill="${MID}">Yearly</text>
  <!-- Save badge -->
  <rect x="${12 + (W - 28) / 2 + 82}" y="${CARDS_Y + 7}" width="68" height="19" rx="9.5" fill="${GREEN}"/>
  <text x="${12 + (W - 28) / 2 + 116}" y="${CARDS_Y + 20}" text-anchor="middle" font-family="${FONT}" font-size="10.5" font-weight="700" fill="white">${savePct}</text>
  <text x="${12 + (W - 28) / 2 + 18}" y="${CARDS_Y + 55}" font-family="${FONT}" font-size="30" font-weight="800" fill="${DARK}">${yrPrice}</text>
  <text x="${12 + (W - 28) / 2 + 18}" y="${CARDS_Y + 76}" font-family="${FONT}" font-size="11" fill="${LGRAY}">${yrPerMo}</text>

  <!-- TABLE HEADER -->
  <rect x="0" y="${TABLE_HDR_Y}" width="${W}" height="${TABLE_HDR_H}" fill="${BG}"/>
  <text x="14" y="${TABLE_HDR_Y + 17}" font-family="${FONT}" font-size="10" font-weight="600" fill="${LGRAY}" letter-spacing="0.8">WHAT YOU GET</text>
  <text x="${FC}" y="${TABLE_HDR_Y + 17}" text-anchor="middle" font-family="${FONT}" font-size="10" font-weight="600" fill="${LGRAY}" letter-spacing="0.6">FREE</text>
  <text x="${PC}" y="${TABLE_HDR_Y + 17}" text-anchor="middle" font-family="${FONT}" font-size="10" font-weight="700" fill="${isPlus ? GREEN : LGRAY}" letter-spacing="0.6">PLUS</text>
  <text x="${RC}" y="${TABLE_HDR_Y + 17}" text-anchor="middle" font-family="${FONT}" font-size="10" font-weight="700" fill="${!isPlus ? GREEN : LGRAY}" letter-spacing="0.6">PRO</text>
  <line x1="0" y1="${TABLE_HDR_Y + TABLE_HDR_H}" x2="${W}" y2="${TABLE_HDR_Y + TABLE_HDR_H}" stroke="${BORDER}" stroke-width="0.8"/>

  <!-- FEATURE ROWS -->
  ${rows}

  <!-- CTA BUTTON -->
  <rect x="12" y="${CTA_Y}" width="${W - 24}" height="52" rx="14" fill="${GREEN}"/>
  <text x="${W / 2}" y="${CTA_Y + 33}" text-anchor="middle" font-family="${FONT}" font-size="16" font-weight="700" fill="white">${ctaPrice}</text>

  <!-- Restore -->
  <text x="${W / 2}" y="${CTA_Y + 76}" text-anchor="middle" font-family="${FONT}" font-size="13" fill="${LGRAY}">Restore purchases</text>

  <!-- Home indicator -->
  <rect x="${W / 2 - 67}" y="${H - 16}" width="134" height="5" rx="2.5" fill="#D1D5DB"/>
</svg>`;
}

fs.mkdirSync("attached_assets/screenshots", { recursive: true });
fs.writeFileSync("attached_assets/screenshots/plus_view.svg", generateSVG("plus"));
fs.writeFileSync("attached_assets/screenshots/pro_view.svg", generateSVG("pro"));
console.log("SVGs written.");
