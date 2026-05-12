import React, { useState, useMemo, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";

/**
 * ComboBox component that acts as a searchable dropdown.
 * @param {Array} options - Array of objects { value: string|number, label: string }
 * @param {string|number} value - The currently selected value
 * @param {function} onChange - Callback when value changes
 * @param {string} placeholder - Placeholder text
 * @param {boolean} allowCustom - If true, allows typing and saving a value that is not in the options
 * @param {React.ReactNode} icon - Optional icon to show on the left
 * @param {string} label - Optional label above the input
 * @param {boolean} required - If true, adds required attribute
 */
export default function ComboBox({
  options = [],
  value = "",
  onChange,
  placeholder = "Buscar o seleccionar...",
  allowCustom = false,
  icon,
  label,
  required = false,
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Sync query with value
  useEffect(() => {
    if (value !== "" && value !== null && value !== undefined) {
      const opt = options.find((o) => String(o.value) === String(value));
      if (opt) {
        setQuery(opt.label);
      } else if (allowCustom) {
        setQuery(String(value));
      }
    } else {
      setQuery("");
    }
  }, [value, options, allowCustom]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        // If not allowCustom, revert query to selected value label if it didn't match
        if (!allowCustom) {
          const opt = options.find((o) => String(o.value) === String(value));
          setQuery(opt ? opt.label : "");
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef, value, options, allowCustom]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return options;
    return options.filter((o) => String(o.label).toLowerCase().includes(q) || String(o.value).toLowerCase().includes(q));
  }, [query, options]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
      {label && <label style={labelStyle}>{label}</label>}
      <div ref={wrapperRef} style={comboWrapperStyle}>
        {icon && <span style={iconStyle}>{icon}</span>}
        <input
          type="text"
          value={query}
          placeholder={placeholder}
          required={required && !value}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            if (allowCustom) {
              onChange(e.target.value);
            } else {
              // clear selection if they type and it's not custom
              if (value) onChange("");
            }
          }}
          onFocus={() => setIsOpen(true)}
          style={comboInputStyle}
        />
        <ChevronDown 
          size={18} 
          color="#9ca3af" 
          onClick={() => setIsOpen(!isOpen)} 
          style={{ cursor: "pointer", flexShrink: 0 }} 
        />

        {isOpen && (
          <div style={comboDropdownStyle}>
            {filtered.length === 0 ? (
              <div style={comboEmptyStyle}>No hay coincidencias.</div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  style={comboOptionStyle}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(opt.value);
                    setQuery(opt.label);
                    setIsOpen(false);
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={comboOptionTitleStyle}>{opt.label}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle = {
  fontSize: "13px",
  fontWeight: "600",
  color: "#4b5563",
  marginLeft: "4px",
};

const comboWrapperStyle = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  background: "#f9fafb",
  border: "1.5px solid #e5e7eb",
  borderRadius: "12px",
  padding: "0 16px",
  width: "100%",
  boxSizing: "border-box",
};

const iconStyle = {
  marginRight: "10px",
  display: "flex",
  alignItems: "center",
  flexShrink: 0,
};

const comboInputStyle = {
  flex: 1,
  border: "none",
  background: "transparent",
  padding: "14px 0",
  fontSize: "14px",
  color: "#111827",
  outline: "none",
  fontFamily: "'Poppins', sans-serif",
  minWidth: 0,
};

const comboDropdownStyle = {
  position: "absolute",
  left: 0,
  right: 0,
  top: "calc(100% + 6px)",
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  overflow: "hidden",
  maxHeight: "240px",
  overflowY: "auto",
  zIndex: 50,
  boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
};

const comboEmptyStyle = {
  padding: "12px 14px",
  fontSize: "13px",
  color: "#6b7280",
};

const comboOptionStyle = {
  width: "100%",
  textAlign: "left",
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  padding: "10px 14px",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  transition: "background 0.1s ease",
};

const comboOptionTitleStyle = {
  fontSize: "13px",
  fontWeight: "600",
  color: "#111827",
};
