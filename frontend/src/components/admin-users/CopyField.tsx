/** A read-only link with a Copy button, for invite and reset links an admin sends by hand. */
import React, { useState } from 'react';

export const CopyField: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (e.g. no HTTPS); the text is still selectable.
      setCopied(false);
    }
  };

  return (
    <div className='flex items-center gap-2'>
      <input
        className='field flex-1 font-code text-[13px]'
        aria-label={label}
        value={value}
        readOnly
        onFocus={(event) => event.target.select()}
      />
      <button type='button' className='btn btn-secondary btn-sm' onClick={copy}>
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
};

export default CopyField;
