'use client'

import { useToast } from '@/hooks/use-toast'
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast'
import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider swipeDirection="right">
      {toasts.map(function ({ id, title, description, action, variant, duration, ...props }) {
        const isSuccess = variant === 'success'
        return (
          <Toast key={id} variant={variant} duration={duration || (isSuccess ? 3000 : undefined)} {...props}>
            <div className={cn('flex items-start gap-2.5', isSuccess && 'flex-1 min-w-0')}>
              {isSuccess && (
                <CheckCircle2 className="h-4 w-4 text-lime-400 mt-0.5 shrink-0" />
              )}
              <div className={cn('grid min-w-0', isSuccess ? 'gap-0.5' : 'gap-1', 'flex-1')}>
                {title && (
                  <ToastTitle className={isSuccess ? 'text-[13px] font-medium' : undefined}>
                    {title}
                  </ToastTitle>
                )}
              {description && (
                  <ToastDescription className={isSuccess ? 'text-[13px]' : undefined}>
                    {description}
                  </ToastDescription>
              )}
              </div>
            </div>
            {action}
            {!isSuccess && <ToastClose />}
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
