import { cn } from "@/lib/utils";

/** Philippine peso (₱) as a compact icon, sized like Lucide icons. */
export function PesoIcon({
  className,
  size,
}: {
  className?: string;
  /** Pixel size (matches Lucide `size` prop). */
  size?: number;
}) {
  return (
    <span
      role="img"
      aria-label="Philippine peso"
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-semibold leading-none text-current select-none",
        className
      )}
      style={
        size != null
          ? {
              fontSize: Math.max(10, Math.round(size * 0.88)),
              width: size,
              height: size,
            }
          : undefined
      }
    >
      ₱
    </span>
  );
}
