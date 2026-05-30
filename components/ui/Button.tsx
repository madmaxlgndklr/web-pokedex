// components/ui/Button.tsx
interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
}

export function Button({ variant = 'primary', children, style, ...rest }: Props) {
  const bg = variant === 'primary' ? 'var(--header)' : 'var(--surface)'
  const color = variant === 'primary' ? '#fff' : 'var(--text)'
  return (
    <button
      style={{
        background: bg,
        color,
        border: `1px solid ${variant === 'secondary' ? 'var(--border)' : 'transparent'}`,
        fontFamily: 'var(--font-pixel)',
        fontSize: '7px',
        padding: '6px 12px',
        borderRadius: '3px',
        cursor: 'pointer',
        letterSpacing: '1px',
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  )
}
