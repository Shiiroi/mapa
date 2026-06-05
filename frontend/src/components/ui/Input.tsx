import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
}

export function Input({ label, style, ...props }: InputProps) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {label && <label style={{ fontSize: 13, fontWeight: 500, color: "#4a5568" }}>{label}</label>}
            <input
                style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #e2e8f0",
                    fontSize: 14,
                    outline: "none",
                    transition: "border-color 0.2s",
                    ...style,
                }}
                {...props}
            />
        </div>
    );
}
