import { ButtonHTMLAttributes, forwardRef } from 'react';

/*
 * Tactile "key" buttons from the redesign (DESIGN.md section 4.3, 7).
 * The look lives in index.css (`.btn`, `.btn-primary`, ...) inside
 * `@layer components`, so Tailwind utilities passed in `className` still win
 * (for example `className='mt-4'`).
 */

export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonStyle {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
}

/** The class string on its own, for when the thing that looks like a button is really a link. */
export const buttonClass = ({ variant = 'primary', size = 'md', block = false, className = '' }: ButtonStyle) =>
  ['btn', `btn-${variant}`, size === 'md' ? '' : `btn-${size}`, block ? 'btn-block' : '', className]
    .filter(Boolean)
    .join(' ');

type ButtonProps = ButtonStyle & ButtonHTMLAttributes<HTMLButtonElement>;

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, block, className, type = 'button', ...rest }, ref) => (
    <button ref={ref} type={type} className={buttonClass({ variant, size, block, className })} {...rest} />
  )
);
Button.displayName = 'Button';

export default Button;
