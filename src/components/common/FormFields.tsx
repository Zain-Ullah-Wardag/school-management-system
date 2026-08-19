import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

export function Field({ label, error, children, required }: { label: string; error?: unknown; children: ReactNode; required?: boolean }) {
  const text = typeof error === 'string' ? error : (error as { message?: string } | undefined)?.message;
  return <label className="block"><span className="form-label">{label}{required && <span className="ml-1 text-rose-500">*</span>}</span>{children}{text && <span className="form-error">{text}</span>}</label>;
}

/**
 * These primitives deliberately forward the DOM ref. React Hook Form's register()
 * uses that ref to initialise default values and read browser-autofilled values.
 */
export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...props }, ref) => <input ref={ref} className={`form-control ${className}`} {...props} />
);
TextInput.displayName = 'TextInput';

export const SelectInput = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = '', children, ...props }, ref) => <select ref={ref} className={`form-control ${className}`} {...props}>{children}</select>
);
SelectInput.displayName = 'SelectInput';

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = '', ...props }, ref) => <textarea ref={ref} className={`form-control min-h-24 resize-y ${className}`} {...props} />
);
TextArea.displayName = 'TextArea';
