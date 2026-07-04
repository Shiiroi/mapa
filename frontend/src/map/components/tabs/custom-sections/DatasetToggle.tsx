// Small toggle button to enable/disable a built-in dataset in the Custom tab.
import { cn } from "../../../../lib/cn";

interface DatasetToggleProps {
    active: boolean;
    disabled?: boolean;
    onChange: (on: boolean) => void;
    label: string;
}

export function DatasetToggle({ active, disabled, onChange, label }: DatasetToggleProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={active}
            aria-label={label}
            disabled={disabled}
            onClick={() => onChange(!active)}
            className={cn(
                "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                active ? "bg-accent" : "bg-border-light",
                disabled && "cursor-not-allowed opacity-50",
            )}
        >
            <span
                className={cn(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition",
                    active ? "translate-x-5" : "translate-x-0",
                )}
            />
        </button>
    );
}
