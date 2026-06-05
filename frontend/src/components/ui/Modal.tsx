import type { ReactNode } from "react";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: ReactNode;
    title?: string;
}

export function Modal({ isOpen, onClose, children, title }: ModalProps) {
    if (!isOpen) return null;

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0,0,0,0.5)",
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: "white",
                    borderRadius: 12,
                    padding: 24,
                    minWidth: 400,
                    maxWidth: "90vw",
                    maxHeight: "90vh",
                    overflow: "auto",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {title && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <h2 style={{ margin: 0, fontSize: 20 }}>{title}</h2>
                        <button
                            onClick={onClose}
                            style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                fontSize: 20,
                                color: "#666",
                            }}
                        >
                            ✕
                        </button>
                    </div>
                )}
                {children}
            </div>
        </div>
    );
}
