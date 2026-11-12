import type { BrickSet, BuildStep, InstructionPage, Part, PartPlacement, Region } from "./types";
import { emptyProgress } from "./player";

export const DEMO_SET_ID = "demo-harbor-tug";

const VB_W = 900;
const VB_H = 1280;
const HEADER = 120;
const FOOTER = 40;
const INK = "#241910";
const PAPER = "#fbf6ee";
const RED = "#e23b2f";
const BLACK = "#2b2b2b";
const YELLOW = "#f0c445";
const WHITE = "#f7f4ee";
const PALE = "#c5d4f2";

export function panelRegion(index: number, count: number): Region {
  const inner = VB_H - HEADER - FOOTER;
  const band = inner / count;
  const y = HEADER + index * band + 8;
  const height = band - 16;
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return {
    x: round(48 / VB_W),
    y: round(y / VB_H),
    width: round(804 / VB_W),
    height: round(height / VB_H),
  };
}

export function buildDemoSet(now = Date.now()): BrickSet {
  const pages: InstructionPage[] = [
    pageRecord("demo-page-1", 0, "page-1.svg", instructionPage(1, 3, [draw(0, 3, 1, "2×  2x4", hull())])),
    pageRecord("demo-page-2", 1, "page-2.svg", instructionPage(2, 3, [
      draw(0, 3, 4, "4×  1x4", walls()),
      draw(1, 3, 5, "2×  1x2 ?", windows()),
      draw(2, 3, 6, "1×  4x6", roof()),
    ])),
    pageRecord("demo-page-3", 2, "page-3.svg", instructionPage(3, 3, [
      draw(0, 2, 7, "funnel", funnel()),
      draw(1, 2, 8, "flag", flag()),
    ])),
    {
      id: "demo-page-4",
      order: 3,
      fileName: "blurry-page.jpg",
      imageDataUrl: blurryPage(),
      status: "retake",
      retake: { needed: true, reasons: ["too blurry", "step 9 cut off"] },
    },
  ];
  // Page 1 drawing only included step 1 in the array above — rebuild page 1 with three panels.
  pages[0] = pageRecord(
    "demo-page-1",
    0,
    "page-1.svg",
    instructionPage(1, 3, [
      draw(0, 3, 1, "2×  2x4", hull()),
      draw(1, 3, 2, "2×  plate", plates()),
      draw(2, 3, 3, "4×  1x2", cabinBase()),
    ]),
  );

  const steps: BuildStep[] = [
    step("demo-step-1", "demo-page-1", 1, 0, 3, "Lay two red 2x4 bricks side by side. This is the bottom of the hull.", [
      piece("demo-step-1-p1", "Red", "brick", "2x4", 2, known({
        along: 3,
        row: 2,
        point: [0.36, 0.4],
        callout: [0.8, 0.2],
        poses: [[3, 1, 0, 0], [5, 1, 0, 0]],
      })),
    ]),
    step("demo-step-2", "demo-page-1", 2, 1, 3, "Press a black 2x4 plate onto each end of the hull.", [
      piece("demo-step-2-p1", "Black", "plate", "2x4", 2, known({
        along: 3,
        row: 2,
        onto: "red 2x4",
        relation: "on top of",
        point: [0.4, 0.58],
        callout: [0.78, 0.22],
        poses: [[3, 1, 3, 0], [5, 1, 3, 0]],
      })),
    ]),
    step("demo-step-3", "demo-page-1", 3, 2, 3, "Stack four yellow 1x2 bricks in the middle for the cabin base.", [
      piece("demo-step-3-p1", "Yellow", "brick", "1x2", 4, known({
        along: 4,
        row: 3,
        onto: "black 2x4",
        relation: "on top of",
        point: [0.48, 0.5],
        callout: [0.76, 0.2],
        poses: [[4, 2, 4, 0], [5, 2, 4, 0], [4, 2, 7, 0], [5, 2, 7, 0]],
      })),
    ]),
    step("demo-step-4", "demo-page-2", 4, 0, 3, "Build the cabin walls with white 1x4 bricks, leaving the front open.", [
      piece("demo-step-4-p1", "White", "brick", "1x4", 4, known({
        along: 3,
        row: 2,
        onto: "yellow 1x2",
        relation: "on top of",
        point: [0.36, 0.46],
        callout: [0.78, 0.22],
        poses: [[3, 1, 10, 0], [6, 1, 10, 0], [3, 4, 10, 90], [3, 4, 13, 90]],
      })),
    ]),
    step(
      "demo-step-5",
      "demo-page-2",
      5,
      1,
      3,
      "Set two small tiles into the cabin wall as windows.",
      [
        {
          id: "demo-step-5-p1",
          color: "Unclear",
          shape: "tile",
          size: "1x2",
          quantity: 2,
          certainty: "uncertain",
          uncertainFields: ["color"],
          uncertaintyNote: "The ink is pale, so the color may be blue or light gray.",
          placement: {
            point: null,
            callout: null,
            studs: { along: null, fromEdge: null, row: null, onto: null, relation: null },
            poses: [{ x: null, y: null, layer: null, rotation: null }],
            certainty: "uncertain",
            uncertainFields: ["point", "studs", "orientation", "layer"],
            note: "can't count studs, photo angle",
            needsRetake: true,
            corrected: false,
          },
        },
      ],
      "uncertain",
      "Can't tell whether these face the bow or the stern.",
    ),
    step("demo-step-6", "demo-page-2", 6, 2, 3, "Cap the cabin with one red 4x6 plate.", [
      piece("demo-step-6-p1", "Red", "plate", "4x6", 1, known({
        along: 3,
        row: 1,
        onto: "white 1x4",
        relation: "on top of",
        point: [0.46, 0.42],
        callout: [0.78, 0.24],
        poses: [[3, 0, 16, 0]],
      })),
    ]),
    step("demo-step-7", "demo-page-3", 7, 0, 2, "Stack a black 2x2 brick and a red round brick as the funnel.", [
      piece("demo-step-7-p1", "Black", "brick", "2x2", 1, known({
        along: 4,
        row: 3,
        onto: "red 4x6",
        relation: "on top of",
        point: [0.46, 0.48],
        callout: [0.74, 0.22],
        poses: [[4, 2, 17, 0]],
      })),
      piece("demo-step-7-p2", "Red", "round", "2x2", 1, known({
        along: 4,
        row: 3,
        onto: "black 2x2",
        relation: "on top of",
        point: [0.46, 0.34],
        callout: [0.74, 0.18],
        poses: [[4, 2, 20, 0]],
      })),
    ]),
    step("demo-step-8", "demo-page-3", 8, 1, 2, "Add a yellow 1x1 tile at the stern and a white 1x2 slope as the flag.", [
      piece("demo-step-8-p1", "Yellow", "tile", "1x1", 1, known({
        along: 3,
        row: 2,
        onto: "red 4x6",
        relation: "on top of",
        point: [0.32, 0.62],
        callout: [0.72, 0.28],
        poses: [[3, 1, 17, 0]],
      })),
      piece("demo-step-8-p2", "White", "slope", "1x2", 1, known({
        along: 6,
        row: 2,
        onto: "red 4x6",
        relation: "on top of",
        point: [0.62, 0.58],
        callout: [0.8, 0.24],
        poses: [[6, 1, 17, 0]],
      })),
    ]),
  ];

  return {
    id: DEMO_SET_ID,
    name: "Harbor Tug 214",
    coverDataUrl: coverArt(),
    createdAt: now,
    updatedAt: now,
    pages,
    steps,
    progress: emptyProgress(),
    sample: true,
  };
}

function step(
  id: string,
  pageId: string,
  stepNumber: number,
  index: number,
  count: number,
  description: string,
  parts: Part[],
  placementCertainty: BuildStep["placementCertainty"] = "certain",
  placementNote: string | null = null,
): BuildStep {
  return {
    id,
    pageId,
    stepNumber,
    description,
    parts,
    region: panelRegion(index, count),
    placementCertainty,
    placementNote,
  };
}

function piece(
  id: string,
  color: string,
  shape: string,
  size: string,
  quantity: number,
  placement: PartPlacement,
): Part {
  return {
    id,
    color,
    shape,
    size,
    quantity,
    certainty: "certain",
    uncertainFields: [],
    uncertaintyNote: null,
    placement,
  };
}

function known(options: {
  along: number;
  row: number;
  onto?: string;
  relation?: string;
  point: [number, number];
  callout: [number, number];
  poses: Array<[number, number, number, number]>;
}): PartPlacement {
  return {
    point: { x: options.point[0], y: options.point[1] },
    callout: { x: options.callout[0], y: options.callout[1] },
    studs: {
      along: options.along,
      fromEdge: "left edge",
      row: options.row,
      onto: options.onto ?? null,
      relation: options.relation ?? null,
    },
    poses: options.poses.map(([x, y, layer, rotation]) => ({ x, y, layer, rotation })),
    certainty: "certain",
    uncertainFields: [],
    note: null,
    needsRetake: false,
    corrected: false,
  };
}

function pageRecord(id: string, order: number, fileName: string, svg: string): InstructionPage {
  return {
    id,
    order,
    fileName,
    imageDataUrl: svgUrl(svg),
    status: "ready",
    retake: { needed: false, reasons: [] },
  };
}

function svgUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function instructionPage(pageNo: number, total: number, body: string[]): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB_W} ${VB_H}">
    <rect width="${VB_W}" height="${VB_H}" fill="${PAPER}"/>
    <rect x="28" y="24" width="844" height="1232" rx="18" fill="none" stroke="#e4d7c4" stroke-width="3"/>
    <rect x="48" y="44" width="804" height="64" rx="14" fill="#e23d2b"/>
    <text x="72" y="86" fill="#fffdf8" font-family="Georgia, serif" font-size="32">Harbor Tug</text>
    <text x="820" y="86" text-anchor="end" fill="${YELLOW}" font-family="Georgia, serif" font-size="24">${pageNo}/${total}</text>
    ${body.join("")}
  </svg>`;
}

function draw(index: number, count: number, stepNumber: number, callout: string, drawing: string): string {
  const inner = VB_H - HEADER - FOOTER;
  const band = inner / count;
  const y = HEADER + index * band;
  return `<rect x="48" y="${y + 8}" width="804" height="${band - 16}" rx="16" fill="#fff" stroke="#eadfce" stroke-width="2"/>
    <circle cx="100" cy="${y + 56}" r="24" fill="${INK}"/>
    <text x="100" y="${y + 64}" text-anchor="middle" fill="${YELLOW}" font-family="Georgia, serif" font-size="22">${stepNumber}</text>
    <g transform="translate(150 ${y + 28})">${drawing}</g>
    <rect x="630" y="${y + 36}" width="190" height="64" rx="12" fill="#fffdf8" stroke="${INK}" stroke-width="2"/>
    <text x="725" y="${y + 76}" text-anchor="middle" fill="${INK}" font-family="Georgia, serif" font-size="20">${escapeXml(callout)}</text>`;
}

function stud(cx: number, cy: number, fill: string): string {
  return `<circle cx="${cx}" cy="${cy}" r="8" fill="${fill}" stroke="${INK}" stroke-width="1.4"/>
    <circle cx="${cx}" cy="${cy - 2}" r="3" fill="rgba(255,255,255,.55)"/>`;
}

function brick(x: number, y: number, cols: number, rows: number, fill: string): string {
  const pitch = 22;
  const width = cols * pitch + 10;
  const height = rows * pitch + 10;
  let marks = `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="5" fill="${fill}" stroke="${INK}" stroke-width="2"/>`;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      marks += stud(x + 5 + pitch / 2 + col * pitch, y + 5 + pitch / 2 + row * pitch, fill);
    }
  }
  return marks;
}

function hull(): string {
  return `${brick(0, 70, 4, 2, RED)}${brick(120, 70, 4, 2, RED)}`;
}

function plates(): string {
  return `${brick(0, 80, 4, 1, BLACK)}<rect x="110" y="92" width="80" height="22" rx="4" fill="${RED}" stroke="${INK}"/>${brick(200, 80, 4, 1, BLACK)}`;
}

function cabinBase(): string {
  return [0, 1, 2, 3].map((row) => brick(70, 20 + row * 40, 2, 1, YELLOW)).join("");
}

function walls(): string {
  return `${brick(10, 40, 4, 1, WHITE)}${brick(10, 100, 1, 3, WHITE)}${brick(80, 100, 1, 3, WHITE)}`;
}

function windows(): string {
  return `${brick(20, 50, 4, 2, WHITE)}${brick(40, 70, 2, 1, PALE)}${brick(110, 70, 2, 1, PALE)}`;
}

function roof(): string {
  return brick(10, 60, 6, 2, RED);
}

function funnel(): string {
  return `${brick(80, 90, 2, 2, BLACK)}<circle cx="113" cy="70" r="28" fill="${RED}" stroke="${INK}" stroke-width="2"/>${stud(113, 70, RED)}`;
}

function flag(): string {
  return `${brick(20, 80, 1, 1, YELLOW)}<polygon points="70,40 150,70 70,100" fill="${WHITE}" stroke="${INK}" stroke-width="2"/>`;
}

function blurryPage(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB_W} ${VB_H}">
    <defs><filter id="soft"><feGaussianBlur stdDeviation="8"/></filter></defs>
    <rect width="${VB_W}" height="${VB_H}" fill="#1a1612"/>
    <g filter="url(#soft)" opacity="0.85">
      <rect x="70" y="160" width="520" height="280" rx="20" fill="#5c4636"/>
      <rect x="120" y="520" width="360" height="90" fill="#7a3030"/>
      <rect x="180" y="700" width="420" height="160" fill="#3d342c"/>
    </g>
    <text x="70" y="1240" fill="${YELLOW}" font-family="Georgia, serif" font-size="72" opacity="0.8">9</text>
  </svg>`;
  return svgUrl(svg);
}

function coverArt(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 480">
    <rect width="800" height="480" fill="#d7ecf6"/>
    <rect y="300" width="800" height="180" fill="#7eb6d6"/>
    <path d="M80 300 L180 230 H520 L680 300 Z" fill="${RED}" stroke="${INK}" stroke-width="4"/>
    <rect x="300" y="150" width="180" height="90" fill="${WHITE}" stroke="${INK}" stroke-width="4"/>
    <rect x="330" y="170" width="40" height="28" fill="${PALE}" stroke="${INK}"/>
    <rect x="430" y="80" width="36" height="80" fill="${BLACK}"/>
    <circle cx="448" cy="70" r="22" fill="${RED}" stroke="${INK}" stroke-width="3"/>
    <polygon points="500,170 560,190 500,210" fill="${YELLOW}" stroke="${INK}" stroke-width="3"/>
    <text x="40" y="56" fill="${INK}" font-family="Georgia, serif" font-size="42">Harbor Tug</text>
  </svg>`;
  return svgUrl(svg);
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
