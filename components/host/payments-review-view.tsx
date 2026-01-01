"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Check, Clock, Image as ImageIcon, X } from "lucide-react"
import { formatDistanceToNow, parseISO } from "date-fns"
import Image from "next/image"

interface PaymentUpload {
  id: string
  participantId: string
  participantName: string
  proofImageUrl: string | null
  paymentStatus: "pending_review" | "approved" | "rejected"
  createdAt: string
  amount: number | null
  currency: string | null
}

interface PaymentsReviewViewProps {
  sessionId: string
  uiMode: "dark" | "light"
  onBack: () => void
}

export function PaymentsReviewView({ sessionId, uiMode, onBack }: PaymentsReviewViewProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [uploads, setUploads] = useState<PaymentUpload[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  const glassCard = uiMode === "dark"
    ? "bg-black/30 border-white/20 text-white backdrop-blur-sm"
    : "bg-white/70 border-black/10 text-black backdrop-blur-sm"

  useEffect(() => {
    const fetchUploads = async () => {
      try {
        const { getPaymentUploadsForSession } = await import("@/app/host/sessions/[id]/actions")
        const result = await getPaymentUploadsForSession(sessionId)

        if (!result.ok) {
          toast({
            title: "Failed to load payments",
            description: result.error || "Please try again.",
            variant: "destructive",
          })
          return
        }

        setUploads(result.uploads)
      } catch (error: any) {
        console.error("[PaymentsReviewView] Error:", error)
        toast({
          title: "Failed to load payments",
          description: error?.message || "Please try again.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchUploads()
  }, [sessionId, toast])

  const handleConfirmPaid = async (uploadId: string) => {
    setConfirmingId(uploadId)
    try {
      const { confirmParticipantPaid } = await import("@/app/host/sessions/[id]/actions")
      const result = await confirmParticipantPaid(sessionId, uploadId)

      if (!result.ok) {
        toast({
          title: "Failed to confirm payment",
          description: result.error || "Please try again.",
          variant: "destructive",
        })
        return
      }

      // Optimistically update local state
      setUploads((prev) =>
        prev.map((upload) =>
          upload.id === uploadId ? { ...upload, paymentStatus: "approved" as const } : upload
        )
      )

      toast({
        title: "Payment confirmed",
        description: "Marked as paid successfully.",
      })

      // Refresh analytics data
      router.refresh()
    } catch (error: any) {
      console.error("[PaymentsReviewView] Error confirming payment:", error)
      toast({
        title: "Failed to confirm payment",
        description: error?.message || "Please try again.",
        variant: "destructive",
      })
    } finally {
      setConfirmingId(null)
    }
  }

  const getInitial = (name: string) => {
    return name.charAt(0).toUpperCase() || "?"
  }

  const formatTimeAgo = (dateString: string) => {
    try {
      return formatDistanceToNow(parseISO(dateString), { addSuffix: true })
    } catch {
      return "Recently"
    }
  }

  const getStatusBadge = (status: "pending_review" | "approved" | "rejected") => {
    switch (status) {
      case "approved":
        return {
          label: "Confirmed",
          color: "bg-green-500/20 text-green-400 border-green-500/30",
        }
      case "rejected":
        return {
          label: "Rejected",
          color: "bg-red-500/20 text-red-400 border-red-500/30",
        }
      default:
        return {
          label: "Pending",
          color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
        }
    }
  }

  if (loading) {
    return (
      <div className={cn("min-h-screen", uiMode === "dark" ? "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" : "bg-white")}>
        <div className="p-4">
          {/* Header skeleton */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse" />
            <div className="flex-1 h-8 bg-white/10 rounded animate-pulse" />
          </div>
          {/* Cards skeleton */}
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className={cn("p-4", glassCard)}>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-white/10 animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 bg-white/10 rounded animate-pulse" />
                      <div className="h-3 w-24 bg-white/10 rounded animate-pulse" />
                    </div>
                  </div>
                  <div className="h-48 bg-white/10 rounded-lg animate-pulse" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("min-h-screen pb-24", uiMode === "dark" ? "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" : "bg-white")}>
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            onClick={onBack}
            variant="ghost"
            size="icon"
            className={cn(
              "shrink-0",
              uiMode === "dark"
                ? "text-white hover:bg-white/10"
                : "text-black hover:bg-black/10"
            )}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className={cn("text-2xl font-semibold", uiMode === "dark" ? "text-white" : "text-black")}>
              Payment uploads
            </h1>
            {uploads.length > 0 && (
              <p className={cn("text-sm mt-1", uiMode === "dark" ? "text-white/60" : "text-black/60")}>
                {uploads.length} upload{uploads.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>

        {/* Empty state */}
        {!loading && uploads.length === 0 && (
          <Card className={cn("p-8 text-center", glassCard)}>
            <ImageIcon className={cn("w-12 h-12 mx-auto mb-4", uiMode === "dark" ? "text-white/40" : "text-black/40")} />
            <h3 className={cn("text-lg font-semibold mb-2", uiMode === "dark" ? "text-white" : "text-black")}>
              No payment uploads yet
            </h3>
            <p className={cn("text-sm", uiMode === "dark" ? "text-white/60" : "text-black/60")}>
              When participants upload proof, it'll appear here.
            </p>
          </Card>
        )}

        {/* Upload list */}
        {uploads.length > 0 && (
          <div className="space-y-4">
            {uploads.map((upload) => {
              const statusBadge = getStatusBadge(upload.paymentStatus)
              const isConfirming = confirmingId === upload.id
              const isConfirmed = upload.paymentStatus === "approved"

              return (
                <motion.div
                  key={upload.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className={cn("p-4", glassCard)}>
                    <div className="space-y-4">
                      {/* Participant info */}
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div
                          className={cn(
                            "w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold border shrink-0",
                            uiMode === "dark"
                              ? "bg-white/10 border-white/20 text-white"
                              : "bg-black/10 border-black/20 text-black"
                          )}
                        >
                          {getInitial(upload.participantName)}
                        </div>

                        {/* Name and time */}
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm font-medium truncate", uiMode === "dark" ? "text-white" : "text-black")}>
                            {upload.participantName}
                          </p>
                          <p className={cn("text-xs flex items-center gap-1", uiMode === "dark" ? "text-white/60" : "text-black/60")}>
                            <Clock className="w-3 h-3" />
                            {formatTimeAgo(upload.createdAt)}
                          </p>
                        </div>

                        {/* Status badge */}
                        <Badge className={cn("shrink-0 text-xs border", statusBadge.color)}>
                          {statusBadge.label}
                        </Badge>
                      </div>

                      {/* Amount (if available) */}
                      {upload.amount && (
                        <div className={cn("text-sm font-medium", uiMode === "dark" ? "text-white/90" : "text-black/90")}>
                          {upload.currency || "RM"} {upload.amount.toFixed(2)}
                        </div>
                      )}

                      {/* Image preview */}
                      {upload.proofImageUrl && (
                        <div
                          onClick={() => setSelectedImage(upload.proofImageUrl!)}
                          className="relative w-full h-48 rounded-lg overflow-hidden bg-slate-800 cursor-pointer group"
                        >
                          <Image
                            src={upload.proofImageUrl}
                            alt={`Payment proof from ${upload.participantName}`}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-200"
                            sizes="(max-width: 768px) 100vw, 400px"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200" />
                        </div>
                      )}

                      {/* Confirm button */}
                      {!isConfirmed && (
                        <Button
                          onClick={() => handleConfirmPaid(upload.id)}
                          disabled={isConfirming}
                          className={cn(
                            "w-full rounded-full font-medium",
                            "bg-gradient-to-r from-lime-500 to-emerald-500 hover:from-lime-400 hover:to-emerald-400 text-black",
                            isConfirming && "opacity-50"
                          )}
                        >
                          <AnimatePresence mode="wait">
                            {isConfirming ? (
                              <motion.div
                                key="loading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex items-center gap-2"
                              >
                                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                Confirming...
                              </motion.div>
                            ) : (
                              <motion.div
                                key="confirm"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex items-center gap-2"
                              >
                                Confirm paid
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </Button>
                      )}

                      {/* Confirmed state */}
                      {isConfirmed && (
                        <motion.div
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 300, damping: 25 }}
                          className={cn(
                            "flex items-center justify-center gap-2 py-2 rounded-full",
                            "bg-green-500/20 border border-green-500/30"
                          )}
                        >
                          <Check className="w-4 h-4 text-green-400" />
                          <span className="text-sm font-medium text-green-400">Payment confirmed</span>
                        </motion.div>
                      )}
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* Image lightbox dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl p-0 bg-black/90 border-white/20">
          <DialogHeader className="sr-only">
            <DialogTitle>Payment proof image</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="relative w-full aspect-auto max-h-[80vh]">
              <Image
                src={selectedImage}
                alt="Payment proof"
                width={1200}
                height={1600}
                className="w-full h-full object-contain"
                unoptimized
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedImage(null)}
                className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white border-white/20"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

