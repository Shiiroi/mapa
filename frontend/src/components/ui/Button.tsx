import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "ghost";
    children: ReactNode;
}

export function Button({ variant = "primary", children, style, ...props }: ButtonProps) {
    const baseStyle: React.CSSProperties = {
        padding: "8px 16px",
        borderRadius: 6,
        border: "none",
        cursor: "pointer",
        fontWeight: 500,
        fontSize: 14,
        ...style,
    };

    const variants: Record<string, React.CSSProperties> = {
        primary: { background: "#3182ce", color: "white" },
        secondary: { background: "#e2e8f0", color: "#2d3748" },
        ghost: { background: "transparent", color: "#3182ce" },
    };

    return (
        <button style={{ ...baseStyle, ...variants[variant] }} {...props}>
            {children}
        </button>
    );
}
