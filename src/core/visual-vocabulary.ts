                                                                              
                                                                          
import { ICON_PATHS } from "./icon-paths";
export const SHAPES = {
  rect: "Process / action",
  rounded: "Event / rounded process",
  stadium: "Start or end",
  diam: "Decision",
  "fr-rect": "Subprocess",
  "lean-r": "Data input/output",
  "lean-l": "Data output/input",
  cyl: "Database",
  "h-cyl": "Direct-access storage",
  "lin-cyl": "Disk storage",
  doc: "Document",
  docs: "Multiple documents",
  "lin-doc": "Lined document",
  "tag-doc": "Tagged document",
  "notch-rect": "Card",
  "st-rect": "Multiple processes",
  "lin-rect": "Lined process",
  "div-rect": "Divided process",
  "tag-rect": "Tagged process",
  "win-pane": "Internal storage",
  "bow-rect": "Stored data",
  hex: "Preparation",
  "trap-t": "Manual operation",
  "trap-b": "Priority action",
  "notch-pent": "Loop limit",
  "sl-rect": "Manual input",
  "curv-trap": "Display",
  delay: "Delay",
  tri: "Extract",
  "flip-tri": "Manual file",
  hourglass: "Collate",
  circle: "Start / connector",
  "dbl-circ": "Stop / double circle",
  "fr-circ": "Stop / framed circle",
  "cross-circ": "Summary",
  "sm-circ": "Small start",
  "f-circ": "Junction",
  fork: "Fork or join",
  brace: "Comment on left",
  "brace-r": "Comment on right",
  braces: "Comment on both sides",
  bolt: "Communication link",
  flag: "Paper tape",
  cloud: "Cloud",
  bang: "Attention",
  odd: "Asymmetric process",
  text: "Text block",
  browser: "Browser window",
  console: "Console window",
  bucket: "Object storage",
  datastore: "Data store",
  folder: "Folder",
  person: "Person",
  icon: "Icon with caption",
  image: "Custom vector with caption",
                                                                      
  queue: "Message queue",
  timer: "Timer / scheduled event",
  cache: "Cache",
  api: "API endpoint",
} as const;
export type NodeShape = keyof typeof SHAPES;
export const SHAPE_NAMES = Object.keys(SHAPES) as NodeShape[];

                                                                                                  
                                                           
export const ICONS = {
  user: { description: "Person / operator", paths: ICON_PATHS.user },
  users: { description: "Team", paths: ICON_PATHS.users },
  settings: { description: "Configuration", paths: ICON_PATHS.settings },
  gear: { description: "Processing / mechanism", paths: ICON_PATHS.gear },
  database: { description: "Database / persistence", paths: ICON_PATHS.database },
  file: { description: "File / document", paths: ICON_PATHS.file },
  folder: { description: "Directory / collection", paths: ICON_PATHS.folder },
  queue: { description: "Queue / inbox / outbox", paths: ICON_PATHS.queue },
  clock: { description: "Time / timeout", paths: ICON_PATHS.clock },
  timer: { description: "Scheduled event", paths: ICON_PATHS.timer },
  calendar: { description: "Date / schedule", paths: ICON_PATHS.calendar },
  cloud: { description: "Cloud / remote service", paths: ICON_PATHS.cloud },
  server: { description: "Server / host", paths: ICON_PATHS.server },
  network: { description: "Network / topology", paths: ICON_PATHS.network },
  api: { description: "API / integration", paths: ICON_PATHS.api },
  code: { description: "Code / function", paths: ICON_PATHS.code },
  terminal: { description: "Command / console", paths: ICON_PATHS.terminal },
  mail: { description: "Message / email", paths: ICON_PATHS.mail },
  message: { description: "Conversation / notification", paths: ICON_PATHS.message },
  send: { description: "Send / dispatch", paths: ICON_PATHS.send },
  download: { description: "Receive / download", paths: ICON_PATHS.download },
  upload: { description: "Publish / upload", paths: ICON_PATHS.upload },
  search: { description: "Search / lookup", paths: ICON_PATHS.search },
  filter: { description: "Filter / selection", paths: ICON_PATHS.filter },
  check: { description: "Validation / completion", paths: ICON_PATHS.check },
  error: { description: "Failure / rejection", paths: ICON_PATHS.error },
  warning: { description: "Warning / attention", paths: ICON_PATHS.warning },
  info: { description: "Information / explanation", paths: ICON_PATHS.info },
  lock: { description: "Lock / access control", paths: ICON_PATHS.lock },
  shield: { description: "Security / policy", paths: ICON_PATHS.shield },
  key: { description: "Credentials / identity", paths: ICON_PATHS.key },
  branch: { description: "Conditional branching", paths: ICON_PATHS.branch },
  merge: { description: "Merge / join", paths: ICON_PATHS.merge },
  loop: { description: "Loop / retry", paths: ICON_PATHS.loop },
  link: { description: "Reference / connection", paths: ICON_PATHS.link },
  globe: { description: "Internet / global system", paths: ICON_PATHS.globe },
  browser: { description: "Web UI / browser", paths: ICON_PATHS.browser },
  cache: { description: "Cache / fast storage", paths: ICON_PATHS.cache },
  memory: { description: "Memory / hardware", paths: ICON_PATHS.memory },
  archive: { description: "Archive / retained data", paths: ICON_PATHS.archive },
  trash: { description: "Delete / discard", paths: ICON_PATHS.trash },
  edit: { description: "Edit / update", paths: ICON_PATHS.edit },
  play: { description: "Start / execute", paths: ICON_PATHS.play },
  pause: { description: "Pause / wait", paths: ICON_PATHS.pause },
  stop: { description: "Stop / finish", paths: ICON_PATHS.stop },
  eye: { description: "Observe / inspect", paths: ICON_PATHS.eye },
  chart: { description: "Metrics / analysis", paths: ICON_PATHS.chart },
  package: { description: "Package / artifact", paths: ICON_PATHS.package },
  bolt: { description: "Signal / trigger / energy", paths: ICON_PATHS.bolt },
  heart: { description: "Health / heartbeat", paths: ICON_PATHS.heart },
} as const;
export type BuiltinIcon = keyof typeof ICONS;
export const ICON_NAMES = Object.keys(ICONS) as BuiltinIcon[];
export const LINE_STYLES = [
  "solid",
  "dashed",
  "dotted",
  "dash-dot",
  "double",
  "invisible",
] as const;
export const END_MARKERS = ["arrow", "none", "circle", "cross"] as const;

export type NodeIcon =
  | { kind: "builtin"; name: BuiltinIcon }
  | { kind: "emoji"; text: string }
  | {
      kind: "svg";
      viewBox: [number, number, number, number];
      paths: {
        d: string;
        fill?: string;
        stroke?: string;
        strokeWidth?: number;
      }[];
    };
export interface EdgeStyle {
  line?: (typeof LINE_STYLES)[number];
  width?: "normal" | "thick";
  start?: (typeof END_MARKERS)[number];
  end?: (typeof END_MARKERS)[number];
}
