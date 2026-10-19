/**
 * A password input with a Show/Hide button, and (for new passwords) the rules
 * checked live as you type.
 */
import React, { useId, useState } from 'react';

const MIN_LENGTH = 12;
const MAX_LENGTH = 128;

export interface PasswordRule {
  label: string;
  met: boolean;
}

/** The same rules the server enforces (backend/src/local_auth/passwords.py),
 * minus the common-password list, which only the server checks. */
export function passwordRules(password: string, email = ''): PasswordRule[] {
  const rules = [
    { label: `At least ${MIN_LENGTH} characters`, met: password.length >= MIN_LENGTH && password.length <= MAX_LENGTH },
  ];
  if (email) {
    rules.push({
      label: 'Not your email address',
      met: password.trim().toLowerCase() !== email.trim().toLowerCase(),
    });
  }
  return rules;
}

export const allRulesMet = (password: string, email = '') => passwordRules(password, email).every((rule) => rule.met);

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  /** Show the live rules list under the field (for choosing a new password). */
  rulesFor?: { email: string };
  invalid?: boolean;
  labelAside?: React.ReactNode;
}

export const PasswordField: React.FC<PasswordFieldProps> = ({
  label,
  value,
  onChange,
  autoComplete,
  rulesFor,
  invalid = false,
  labelAside,
}) => {
  const id = useId();
  const rulesId = `${id}-rules`;
  const [shown, setShown] = useState(false);

  return (
    <div>
      <div className='flex items-baseline justify-between'>
        <label className='label' htmlFor={id}>
          {label}
        </label>
        {labelAside}
      </div>
      <div className='relative'>
        <input
          className='field pr-16'
          id={id}
          type={shown ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={invalid || undefined}
          aria-describedby={rulesFor ? rulesId : undefined}
          maxLength={1024}
          required
        />
        <button
          type='button'
          className='absolute right-1.5 top-1/2 -translate-y-1/2 rounded-[8px] px-2.5 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-100'
          aria-controls={id}
          aria-pressed={shown}
          aria-label={shown ? 'Hide password' : 'Show password'}
          onClick={() => setShown(!shown)}
        >
          {shown ? 'Hide' : 'Show'}
        </button>
      </div>
      {rulesFor && (
        // aria-live="polite": screen readers hear the rules update without being interrupted.
        <ul id={rulesId} className='mt-2 space-y-1 text-[13.5px]' aria-live='polite'>
          {passwordRules(value, rulesFor.email).map((rule) => (
            <li key={rule.label} data-met={rule.met} className={rule.met ? 'text-emerald-700' : 'text-slate-500'}>
              {rule.met ? '✓' : '○'} {rule.label}
            </li>
          ))}
          <li className='text-slate-500'>Not a common password (checked when you submit)</li>
        </ul>
      )}
    </div>
  );
};

export default PasswordField;
