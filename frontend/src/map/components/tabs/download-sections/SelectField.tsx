interface SelectFieldProps {
    label: string;
    value: string | null;
    onChange: (value: string | null) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
    allowEmpty?: boolean;
    disabled?: boolean;
}

export function SelectField({
    label,
    value,
    onChange,
    options,
    placeholder,
    allowEmpty,
    disabled,
}: SelectFieldProps) {
    return (
        <div>
            <label className="mb-1 block text-sm text-primary">{label}</label>
            <select
                value={value ?? ""}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value || null)}
                className="w-full rounded-md border border-border-light bg-white px-3 py-2 text-sm text-primary disabled:opacity-50"
            >
                {(allowEmpty || !value) && <option value="">{placeholder ?? "Select…"}</option>}
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
        </div>
    );
}
