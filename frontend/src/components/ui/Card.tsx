import type { ReactNode } from "react";

interface CardProps {
    children: ReactNode;
    style?: React.CSSProperties;
}

export function Card({ children, style }: CardProps) {
    return (
        <div
            style={{
                padding: 24,
                borderRadius: 12,
                background: "white",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                border: "1px solid #e2e8f0",
                ...style,
            }}
        >
            {children}
        </div>
    );
}
