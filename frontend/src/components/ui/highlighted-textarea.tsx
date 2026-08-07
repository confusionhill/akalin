import * as React from "react"
import { cn } from "@/lib/utils"

export interface HighlightedTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  allowedVariables?: string[];
}

const HighlightedTextarea = React.forwardRef<HTMLTextAreaElement, HighlightedTextareaProps>(
  ({ className, value = "", onChange, onScroll, placeholder, rows = 4, allowedVariables, ...props }, ref) => {
    const internalRef = React.useRef<HTMLTextAreaElement>(null);
    const backdropRef = React.useRef<HTMLDivElement>(null);

    // Combine refs
    const resolvedRef = (ref || internalRef) as React.RefObject<HTMLTextAreaElement>;

    // Sync scroll
    const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
      if (backdropRef.current) {
        backdropRef.current.scrollTop = e.currentTarget.scrollTop;
        backdropRef.current.scrollLeft = e.currentTarget.scrollLeft;
      }
      if (onScroll) onScroll(e);
    };

    React.useEffect(() => {
      if (backdropRef.current && resolvedRef.current) {
        backdropRef.current.scrollTop = resolvedRef.current.scrollTop;
        backdropRef.current.scrollLeft = resolvedRef.current.scrollLeft;
      }
    }, [value, resolvedRef]);

    const textValue = typeof value === "string" ? value : String(value);

    // Function to highlight {{...}}
    const renderHighlightedText = (text: string) => {
      if (!text && placeholder) {
        return <span className="text-muted-foreground/50">{placeholder}</span>;
      }

      // Split text by {{...}}
      const parts = text.split(/(\{\{[^{}]*\}\})/g);
      const varSet = new Set(allowedVariables || []);

      return parts.map((part, index) => {
        if (part.startsWith("{{") && part.endsWith("}}")) {
          const varName = part.slice(2, -2).trim();
          if (varSet.has(varName)) {
            return (
              <span
                key={index}
                className="bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40 rounded px-1 py-0.5 mx-0.5 font-mono text-[11px] font-medium"
              >
                {part}
              </span>
            );
          }
        }
        return <span key={index}>{part}</span>;
      });
    };

    return (
      <div className="relative w-full">
        {/* Backdrop for highlighting */}
        <div
          ref={backdropRef}
          className={cn(
            "absolute inset-0 w-full h-full pointer-events-none select-none overflow-auto whitespace-pre-wrap break-words font-mono text-xs px-3 py-2 border border-transparent text-foreground",
            className
          )}
          style={{
            // Sync with textarea scrollbars
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {renderHighlightedText(textValue)}
        </div>

        {/* Actual textarea */}
        <textarea
          ref={resolvedRef}
          value={value}
          onChange={onChange}
          onScroll={handleScroll}
          placeholder={placeholder}
          rows={rows}
          className={cn(
            "flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:ring-[3px] focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50",
            "font-mono relative z-10",
            "text-transparent caret-foreground selection:bg-blue-200/50 dark:selection:bg-blue-800/50",
            className
          )}
          style={{
            WebkitTextFillColor: "transparent",
          }}
          {...props}
        />
      </div>
    );
  }
)

HighlightedTextarea.displayName = "HighlightedTextarea"

export { HighlightedTextarea }
