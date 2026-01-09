'use client'

import * as React from 'react'
import { Button, ButtonProps } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface ActionButtonProps extends Omit<ButtonProps, 'onClick'> {
  onClick?: () => Promise<void> | void
  showSpinner?: boolean
}

export function ActionButton({
  onClick,
  showSpinner = true,
  disabled,
  children,
  className,
  ...props
}: ActionButtonProps) {
  const [isPending, setIsPending] = React.useState(false)

  const handleClick = async () => {
    if (isPending || disabled) return

    // 🔥 IMMEDIATE FEEDBACK
    setIsPending(true)

    try {
      await onClick?.()
    } finally {
      // Allow parent navigation / dialog logic to finish
      setTimeout(() => setIsPending(false), 300)
    }
  }

  return (
    <Button
      {...props}
      disabled={disabled || isPending}
      onClick={handleClick}
      className={cn(
        'transition-all active:scale-[0.97]',
        isPending && 'opacity-80 cursor-wait',
        className
      )}
    >
      {isPending && showSpinner && (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      )}
      {children}
    </Button>
  )
}

