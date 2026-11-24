import "./styles/manage-simple.css";
import { colorValueForInput } from "./colorValue";
import { FieldError } from "./EntityFormParts";

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  errorId: string;
  colorAriaLabel: string;
  codeAriaLabel: string;
  placeholder?: string;
  fieldClassName?: string;
}

/**
 * A color picker paired with its hex/code text input. The stored value
 * is whatever the text field holds (hex or a CSS color name); the
 * native picker only ever sees the normalized #rrggbb form.
 */
export function ColorField({
  label,
  value,
  onChange,
  error,
  errorId,
  colorAriaLabel,
  codeAriaLabel,
  placeholder,
  fieldClassName = "ouchi-manage-field",
}: ColorFieldProps) {
  return (
    <label className={fieldClassName}>
      <span>{label}</span>
      <span className="ouchi-manage-color-row">
        <input
          aria-label={colorAriaLabel}
          onChange={(event) => onChange(event.target.value)}
          type="color"
          value={colorValueForInput(value)}
        />
        <input
          aria-label={codeAriaLabel}
          aria-invalid={Boolean(error)}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          value={value}
        />
      </span>
      <FieldError id={errorId}>{error}</FieldError>
    </label>
  );
}
