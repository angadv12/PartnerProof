import { ImageIcon, Link2, Monitor, Paperclip, StickyNote } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Evidence, EvidenceType } from "@/lib/types";

const TYPE_ICON: Record<EvidenceType, LucideIcon> = {
  Image: ImageIcon,
  Screenshot: Monitor,
  URL: Link2,
  "Text Note": StickyNote,
  File: Paperclip,
};

const TYPE_TINT: Record<EvidenceType, string> = {
  Image: "bg-fuchsia-50 text-fuchsia-500",
  Screenshot: "bg-brand-50 text-brand-500",
  URL: "bg-cyan-50 text-cyan-500",
  "Text Note": "bg-amber-50 text-amber-500",
  File: "bg-ink-100 text-ink-500",
};

/**
 * Renders a real uploaded image when present, otherwise a typed placeholder tile.
 * Seed evidence has no binary files, so placeholders keep the UI consistent.
 */
export function EvidenceThumb({
  evidence,
  className,
}: {
  evidence: Pick<Evidence, "type" | "filePath" | "title">;
  className?: string;
}) {
  const Icon = TYPE_ICON[evidence.type];
  const isImage = evidence.filePath && (evidence.type === "Image" || evidence.type === "Screenshot");

  if (isImage) {
    return (
      <img
        src={evidence.filePath}
        alt={evidence.title}
        className={cn("h-full w-full rounded-lg object-cover", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center rounded-lg",
        TYPE_TINT[evidence.type],
        className
      )}
    >
      <Icon className="h-5 w-5" />
    </div>
  );
}
