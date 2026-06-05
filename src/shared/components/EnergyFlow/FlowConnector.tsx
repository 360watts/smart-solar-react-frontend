import React from 'react';
import { motion } from 'framer-motion';

interface FlowConnectorProps {
  isActive: boolean;   // if false, renders nothing
  d: string;           // SVG path data string (e.g. "M 100 200 L 300 200")
  stroke: string;      // color string (e.g. "#20B835")
  duration?: number;   // animation duration in seconds, default 1.5
  uid: string;         // unique ID for the glow filter reference (e.g. "flow-abc123")
}

/**
 * FlowConnector — Animated SVG beam between two points.
 * Renders null when inactive, otherwise returns a <g> with base + animated paths.
 * Intended to be rendered INSIDE an <svg> element by the parent.
 */
const FlowConnector: React.FC<FlowConnectorProps> = ({
  isActive,
  d,
  stroke,
  duration = 1.5,
  uid,
}) => {
  if (!isActive) return null;

  return (
    <g>
      {/* Base colored line */}
      <path
        d={d}
        stroke={stroke}
        strokeWidth={2}
        strokeOpacity={0.25}
        fill="none"
        strokeLinecap="round"
      />
     {/* Animated Energy Beam */}
      <motion.path
        d={d}
        stroke={stroke}
        strokeWidth={4}
        strokeLinecap="round"        // Changed from square
        strokeLinejoin="round"
        fill="none"
        filter={`url(#glow-${uid})`}
        strokeDasharray="0.2 0.8"     // Slightly tighter dashes = better flow look
        pathLength={1}
        initial={{ strokeDashoffset: 0 }}
        animate={{ 
          strokeDashoffset: -1 
        }}
        transition={{
          duration: duration ?? 1.5,   // default fallback
          repeat: Infinity,
          ease: "linear",
          repeatDelay: 0,
        }}
      />
    </g>
  );
};

export default FlowConnector;
