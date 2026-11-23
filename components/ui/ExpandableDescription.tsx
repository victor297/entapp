"use client";

import { useState } from "react";

export default function ExpandableDescription({ text }: { text?: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const description = text?.trim();

  if (!description) return null;

  const canExpand = description.length > 200;

  return (
    <div>
      <p className={`text-gray-600 text-xs ${canExpand && !expanded ? "line-clamp-3" : ""}`}>
        {description}
      </p>
      {canExpand && (
        <button
          type="button"
          className="text-blue-600 text-xs mt-2"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "Read less" : "Read more"}
        </button>
      )}
    </div>
  );
}
