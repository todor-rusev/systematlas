import { tokens } from "../tokens";
import { BRAND } from "../brand";
import type { VisualMode } from "../visual-geometry";
import type { PresetName } from "../visual-tokens";
import type { FlowDirection, LineStyle } from "../layout";
import {
  IconChevronRight,
  IconDiagonalAdjust,
  IconFlowKind,
  IconHeightAdjust,
  IconLayoutLR,
  IconLayoutTB,
  IconLinesCurved,
  IconLinesRounded,
  IconReset,
  IconSeqKind,
  IconWidthAdjust,
  Logo,
} from "./icons";

export type Tab = "flow" | "sequence";

export interface Crumb {
  id: string;
  title: string;
}

                                                                                    
export interface SeqControls {
  laneGap: number;
  rowH: number;
                                                                          
  width: number;
  bounds: { lane: [number, number]; row: [number, number] };
  onLaneGap: (v: number) => void;
  onRowH: (v: number) => void;
  onReset: () => void;
}

                                                                                                
export interface FlowControls {
  gap: number;
  bounds: [number, number];
  onGap: (v: number) => void;
  onReset: () => void;
  direction: FlowDirection;
  onDirection: (direction: FlowDirection) => void;
  lines: LineStyle;
  onLines: (lines: LineStyle) => void;
}

const DIRECTIONS: { value: FlowDirection; title: string; icon: React.ReactNode }[] = [
  { value: "TB", title: "Lay out top to bottom", icon: <IconLayoutTB size={15} /> },
  { value: "LR", title: "Lay out left to right", icon: <IconLayoutLR size={15} /> },
];

const LINES: { value: LineStyle; title: string; icon: React.ReactNode }[] = [
  { value: "rounded", title: "Lines with rounded corners", icon: <IconLinesRounded size={15} /> },
  { value: "curved", title: "Smooth curved lines", icon: <IconLinesCurved size={15} /> },
];

                                                                         
function Segmented<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: { value: T; title: string; icon: React.ReactNode }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} style={{ display: "flex", gap: 2, padding: 2, background: "#ECE5D7", borderRadius: 9 }}>
      {options.map((option) => (
        <button
          key={option.value}
          role="radio"
          aria-checked={value === option.value}
          className="ft-quiet"
          title={option.title}
          onClick={() => onChange(option.value)}
          style={{
            width: 28,
            height: 26,
            borderRadius: 7,
            background: value === option.value ? "#FFFFFF" : "transparent",
            boxShadow: value === option.value ? "0 1px 2px rgba(74,60,30,0.12)" : "none",
          }}
        >
          {option.icon}
        </button>
      ))}
    </div>
  );
}

interface TopBarProps {
                                                                           
  trail: Crumb[];
  onCrumb: (index: number) => void;
                                                                                      
  tab: Tab;
                                                                                   
                                                                         
  twin?: { onSwitch: () => void };
                                             
  seq?: SeqControls;
                                         
  flow?: FlowControls;
  visual?: { mode: VisualMode; preset: PresetName; onChange: (mode: VisualMode) => void; onPreset: (preset: PresetName) => void };
}

const divider = (
  <div style={{ width: 1, height: 20, background: tokens.color.border }} />
);

function SizeSlider({
  icon,
  title,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }} title={title}>
      <span style={{ color: tokens.color.muted, display: "flex", flex: "0 0 auto" }}>{icon}</span>
      <input
        className="ft-range"
        type="range"
        min={min}
        max={max}
        value={Math.round(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: 84 }}
      />
      {suffix ? (
        <span
          style={{
            fontSize: 11,
            fontVariantNumeric: "tabular-nums",
            color: tokens.color.muted,
            minWidth: 38,
          }}
        >
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

export function TopBar({
  trail,
  onCrumb,
  tab,
  twin,
  seq,
  flow,
  visual,
}: TopBarProps) {
  return (
    <header
      style={{
        flex: "0 0 auto",
        height: tokens.size.topbar,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 14px 0 16px",
        background: tokens.color.topbar,
        borderBottom: `1px solid ${tokens.color.border}`,
        gap: 16,
      }}
    >
      {          }
      <div
        style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Logo size={24} />
          <span
            style={{
              fontFamily: tokens.font.mono,
              fontSize: 13.5,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: tokens.color.text,
            }}
          >
            {BRAND.display}
          </span>
        </div>
        {divider}
        {                                                                          }
        <nav
          style={{ display: "flex", alignItems: "center", gap: 2, minWidth: 0 }}
        >
          {trail.map((c, i) => {
            const isLast = i === trail.length - 1;
            return (
              <div
                key={c.id + i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  minWidth: 0,
                }}
              >
                {i > 0 ? (
                  <span
                    style={{
                      color: tokens.color.faint,
                      display: "flex",
                      flex: "0 0 auto",
                    }}
                  >
                    <IconChevronRight size={13} />
                  </span>
                ) : null}
                <button
                  className="ft-quiet"
                  onClick={() => (isLast ? undefined : onCrumb(i))}
                  disabled={isLast}
                  title={c.title}
                  style={{
                    height: 30,
                    padding: "0 8px",
                    borderRadius: 8,
                    minWidth: 0,
                    cursor: isLast ? "default" : "pointer",
                  }}
                >
                  <span
                    style={{
                      fontSize: 13.5,
                      fontWeight: isLast ? 600 : 500,
                      color: isLast
                        ? tokens.color.text
                        : tokens.color.textSecondary,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: 220,
                    }}
                  >
                    {c.title}
                  </span>
                </button>
              </div>
            );
          })}
        </nav>
      </div>

      {           }
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {tab === "flow" && visual ? (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: tokens.color.textSecondary,
            }}
          >
            View{" "}
            <select
              aria-label="Flow appearance"
              value={visual.mode === "classic" ? "classic" : visual.preset}
              onChange={(e) => {
                if (e.target.value === "classic") visual.onChange("classic");
                else { visual.onPreset(e.target.value as PresetName); visual.onChange("actors"); }
              }}
              style={{
                fontFamily: "inherit",
                fontSize: 12,
                padding: "5px 7px",
                border: `1px solid ${tokens.color.border}`,
                borderRadius: 8,
                background: "#fffdf8",
                color: tokens.color.text,
              }}
            >
              <option value="outline">Soft outline</option>
              <option value="whiteboard">Whiteboard</option>
              <option value="cards">Soft cards</option>
              <option value="classic">Classic</option>
            </select>
          </label>
        ) : null}
        {tab === "sequence" && seq ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <SizeSlider
                icon={<IconWidthAdjust size={15} />}
                title="Diagram width — actor spacing"
                value={seq.laneGap}
                min={seq.bounds.lane[0]}
                max={seq.bounds.lane[1]}
                suffix={`${Math.round(seq.width)}px`}
                onChange={seq.onLaneGap}
              />
              <SizeSlider
                icon={<IconHeightAdjust size={15} />}
                title="Diagram height — row spacing"
                value={seq.rowH}
                min={seq.bounds.row[0]}
                max={seq.bounds.row[1]}
                onChange={seq.onRowH}
              />
              <button
                className="ft-quiet"
                style={{ width: 30, height: 30, borderRadius: 8 }}
                title="Reset size to fit"
                onClick={seq.onReset}
              >
                <IconReset size={15} />
              </button>
            </div>
            {divider}
          </>
        ) : null}
        {tab === "flow" && flow ? (
          <>
            <Segmented label="Layout direction" value={flow.direction} options={DIRECTIONS} onChange={flow.onDirection} />
            <Segmented label="Line style" value={flow.lines} options={LINES} onChange={flow.onLines} />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <SizeSlider
                icon={<IconDiagonalAdjust size={15} />}
                title="Node spacing — drag to compact the layout"
                value={flow.gap}
                min={flow.bounds[0]}
                max={flow.bounds[1]}
                suffix={`${Math.round(flow.gap)}px`}
                onChange={flow.onGap}
              />
              <button
                className="ft-quiet"
                style={{ width: 30, height: 30, borderRadius: 8 }}
                title="Reset spacing"
                onClick={flow.onReset}
              >
                <IconReset size={15} />
              </button>
            </div>
            {divider}
          </>
        ) : null}
        {twin ? (
                                                                                 
                                                                                      
                                   
          <div
            title="Switch between this scenario's Flow and Sequence (twins)"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              padding: 2,
              background: "#ECE5D7",
              borderRadius: 9,
              userSelect: "none",
            }}
          >
            {(["flow", "sequence"] as const).map((t) => {
              const active = tab === t;
              return (
                <button
                  key={t}
                  className="nodrag"
                  onClick={active ? undefined : twin.onSwitch}
                  disabled={active}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    border: "none",
                    borderRadius: 7,
                    background: active ? "#fff" : "transparent",
                    boxShadow: active ? "0 1px 2px rgba(74,60,30,.14)" : "none",
                    color: active
                      ? tokens.color.text
                      : tokens.color.textSecondary,
                    cursor: active ? "default" : "pointer",
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      color: active ? tokens.color.violet : tokens.color.muted,
                    }}
                  >
                    {t === "sequence" ? (
                      <IconSeqKind size={15} />
                    ) : (
                      <IconFlowKind size={15} />
                    )}
                  </span>
                  {t === "sequence" ? "Sequence" : "Flow"}
                </button>
              );
            })}
          </div>
        ) : (
                                                                                     
                                                                                                 
          <div
            title={
              tab === "sequence"
                ? "Sequence altitude (low level)"
                : "Flow altitude (high level)"
            }
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "5px 11px",
              background: "#ECE5D7",
              borderRadius: 9,
              fontSize: 13,
              fontWeight: 600,
              color: tokens.color.text,
              userSelect: "none",
            }}
          >
            <span style={{ display: "flex", color: tokens.color.muted }}>
              {tab === "sequence" ? (
                <IconSeqKind size={15} />
              ) : (
                <IconFlowKind size={15} />
              )}
            </span>
            {tab === "sequence" ? "Sequence" : "Flow"}
          </div>
        )}
      </div>
    </header>
  );
}
