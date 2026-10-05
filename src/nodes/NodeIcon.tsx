import { ICONS, type NodeIcon as Icon } from "../core/visual-vocabulary";
import { useLayoutEffect, useRef, useState } from "react";

                                                                             
                                                                                                       
export function NodeIcon({ icon, size = 28, strokeWidth = 1.7 }: { icon: Icon; size?: number; strokeWidth?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const [fitted, setFitted] = useState<string>();
  useLayoutEffect(() => {
    setFitted(undefined);
    if (icon.kind !== "svg" || !ref.current) return;
                                                                                  
                                                                                  
    try {
      const bounds = ref.current.getBBox();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const pad =
        Math.max(strokeWidth, ...icon.paths.map((p) => p.strokeWidth ?? strokeWidth)) / 2;
      setFitted(
        [
          bounds.x - pad,
          bounds.y - pad,
          bounds.width + pad * 2,
          bounds.height + pad * 2,
        ].join(" "),
      );
    } catch {
                                                                     
    }
  }, [icon, strokeWidth]);
  if (icon.kind === "emoji")
    return (
      <span
        aria-hidden="true"
        style={{
          fontSize: size - 2,
          lineHeight: 1,
          display: "grid",
          placeItems: "center",
          width: size,
          height: size,
          flex: "0 0 auto",
        }}
      >
        {icon.text}
      </span>
    );
  const viewBox =
    icon.kind === "svg" ? (fitted ?? icon.viewBox.join(" ")) : "-1 -1 26 26";
  const paths =
    icon.kind === "builtin"
      ? ICONS[icon.name].paths.map((d) => ({ d }))
      : icon.paths;
  return (
    <svg
      ref={ref}
      aria-hidden="true"
      width={size}
      height={size}
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: "0 0 auto", display: "block", overflow: "hidden" }}
    >
      {paths.map((path, i) => (
        <path key={i} {...path} />
      ))}
    </svg>
  );
}
