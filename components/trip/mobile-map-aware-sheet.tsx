"use client";

import { motion, useDragControls, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { useState } from "react";

type MobileMapAwareSheetProps = {
  bottomBar: ReactNode;
  children: ReactNode;
};

const collapsedHeight = "58svh";
const expandedHeight = "88svh";

export function MobileMapAwareSheet({ bottomBar, children }: MobileMapAwareSheetProps) {
  const [expanded, setExpanded] = useState(false);
  const dragControls = useDragControls();
  const reduceMotion = useReducedMotion();

  function handleDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: { offset: { y: number }; velocity: { y: number } }) {
    if (info.offset.y < -40 || info.velocity.y < -320) {
      setExpanded(true);
      return;
    }

    if (info.offset.y > 40 || info.velocity.y > 320) {
      setExpanded(false);
    }
  }

  return (
    <motion.div
      animate={{ height: expanded ? expandedHeight : collapsedHeight }}
      aria-label="Itinerary timeline sheet"
      className="absolute inset-x-0 bottom-0 z-20 flex flex-col overflow-hidden rounded-t-[1.75rem] border-t border-white/10 bg-[#202022]/96 shadow-[0_-22px_55px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
      data-map-bottom-sheet="true"
      data-sheet-state={expanded ? "expanded" : "collapsed"}
      data-testid="map-aware-sheet"
      drag="y"
      dragControls={dragControls}
      dragConstraints={{ bottom: 0, top: 0 }}
      dragElastic={0.06}
      dragListener={false}
      onDragEnd={handleDragEnd}
      transition={reduceMotion ? { duration: 0 } : { type: "spring", damping: 26, stiffness: 230 }}
    >
      <button
        aria-label={expanded ? "Collapse itinerary sheet" : "Expand itinerary sheet"}
        className="mx-auto mt-3 grid h-6 w-20 shrink-0 touch-none place-items-center rounded-full focus:outline-none focus:ring-4 focus:ring-orange-300/20"
        onClick={() => setExpanded((current) => !current)}
        onPointerDown={(event) => dragControls.start(event)}
        type="button"
      >
        <span className="h-1.5 w-12 rounded-full bg-white/35" />
      </button>
      <div
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 pb-4 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        data-testid="map-aware-sheet-scroll"
      >
        {children}
      </div>
      {bottomBar}
    </motion.div>
  );
}
