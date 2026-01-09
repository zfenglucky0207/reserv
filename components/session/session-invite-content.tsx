"use client"

import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { MapPin, Upload, X, Check, AlertTriangle, Download, Maximize2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { getValidGoogleMapsUrl, getMapEmbedSrc } from "@/utils/session-invite-helpers"
import { PullOutButton } from "@/components/session/pull-out-button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useState } from "react"

interface DemoParticipant {
  name: string
  avatar: string | null
}

interface SessionInviteContentProps {
  // State
  isEditMode: boolean
  isPreviewMode: boolean
  uiMode: "dark" | "light"
  eventDescription: string
  eventLocation: string
  eventMapUrl: string
  demoMode: boolean
  demoParticipants: DemoParticipant[]
  waitlist: Array<{ id: string; display_name: string }>
  joinedCount: number
  eventCapacity: number | null
  isFull: boolean
  actualSessionId?: string
  rsvpState: "none" | "joined" | "waitlisted"
  participantId?: string | null
  proofImage: string | null
  proofImageFile: File | null
  isSubmittingProof: boolean
  proofSubmitted: boolean
  payingForParticipantId: string | null
  payingForParticipantNames: string[]
  bankName: string
  accountNumber: string
  accountName: string
  paymentNotes: string
  paymentQrImage: string | null
  
  // Refs
  textareaRef: React.RefObject<HTMLTextAreaElement>
  
  // Handlers
  onDescriptionChange: (value: string) => void
  onProofImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onProofImageRemove: () => void
  onSubmitPaymentProof: () => void
  onPaymentQrImageRemove: () => void
  onPaymentQrImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onBankNameChange: (value: string) => void
  onAccountNumberChange: (value: string) => void
  onAccountNameChange: (value: string) => void
  onPaymentNotesChange: (value: string) => void
  
  // Style helpers
  glassCard: string
  mutedText: string
  strongText: string
  inputBg: string
  inputBorder: string
  inputPlaceholder: string
}

export function SessionInviteContent({
  isEditMode,
  isPreviewMode,
  uiMode,
  eventDescription,
  eventLocation,
  eventMapUrl,
  demoMode,
  demoParticipants,
  waitlist,
  joinedCount,
  eventCapacity,
  isFull,
  actualSessionId,
  rsvpState,
  participantId,
  proofImage,
  proofImageFile,
  isSubmittingProof,
  proofSubmitted,
  payingForParticipantId,
  payingForParticipantNames,
  bankName,
  accountNumber,
  accountName,
  paymentNotes,
  paymentQrImage,
  textareaRef,
  onDescriptionChange,
  onProofImageUpload,
  onProofImageRemove,
  onSubmitPaymentProof,
  onPaymentQrImageRemove,
  onPaymentQrImageUpload,
  onBankNameChange,
  onAccountNumberChange,
  onAccountNameChange,
  onPaymentNotesChange,
  glassCard,
  mutedText,
  strongText,
  inputBg,
  inputBorder,
  inputPlaceholder,
}: SessionInviteContentProps) {
  const validMapUrl = getValidGoogleMapsUrl(eventMapUrl, eventLocation)
  const [qrImageModalOpen, setQrImageModalOpen] = useState(false)

  // Download QR image function
  const handleDownloadQrImage = () => {
    if (!paymentQrImage) return

    try {
      // Convert base64 to blob
      const base64Data = paymentQrImage.split(',')[1] || paymentQrImage
      const byteCharacters = atob(base64Data)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: 'image/png' })

      // Create download link
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'payment-qr-code.png'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download QR image:', error)
    }
  }

  return (
    <motion.div
      layout
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="px-6 pt-8 pb-[200px] space-y-4"
    >
      {/* Content Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className={`${glassCard} p-6`}>
          <h2 className={`text-lg font-semibold ${strongText} mb-2`}>About this session</h2>
          {isEditMode && !isPreviewMode ? (
            <Textarea
              ref={textareaRef}
              value={eventDescription}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Add a short description for participants"
              className={`${inputBg} ${inputBorder} ${inputPlaceholder} rounded-lg p-3 ${strongText} text-sm leading-relaxed w-full focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]/50 resize-none overflow-hidden`}
              rows={1}
            />
          ) : (
            <p className={`${mutedText} ${!eventDescription ? "italic opacity-60" : ""} text-sm leading-relaxed whitespace-pre-wrap`}>
              {eventDescription || "Add a short description for participants"}
            </p>
          )}
        </Card>
      </motion.div>

      {(!isEditMode || isPreviewMode) && eventLocation && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className={`${glassCard} p-6`}>
            <h2 className={`text-lg font-semibold ${strongText} mb-4`}>Location</h2>
            <p className={`${mutedText} text-sm mb-4`}>{eventLocation}</p>
            {(() => {
              // Demo mode
              if (demoMode) {
                return (
                  <div className="w-full h-48 rounded-lg overflow-hidden bg-gradient-to-br from-lime-100 to-emerald-100 flex items-center justify-center">
                    <div className="text-center">
                      <MapPin className="w-12 h-12 mx-auto mb-2 text-lime-600" />
                      <p className="text-sm text-black font-medium">Map preview (demo)</p>
                    </div>
                  </div>
                )
              }
              
              // Only show map iframe if we have a valid Google Maps URL
              if (validMapUrl) {
                return (
                  <div className="relative w-full h-48 rounded-2xl overflow-hidden">
                    <iframe
                      src={getMapEmbedSrc(validMapUrl)}
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      title="Session location"
                    />
                  </div>
                )
              }
              
              // No valid map URL - don't show map embed at all
              return null
            })()}
          </Card>
        </motion.div>
      )}

      {(!isEditMode || isPreviewMode) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card className={`${glassCard} p-6`}>
            <div className="flex items-center justify-between mb-2">
              <h2 className={`text-lg font-semibold ${strongText}`}>Going</h2>
              <div className="flex items-center gap-2">
                <Badge className="bg-[var(--theme-accent)]/20 text-[var(--theme-accent-light)] border-[var(--theme-accent)]/30">
                  {joinedCount > 0 ? joinedCount : demoParticipants.length} / {eventCapacity || "∞"}
                </Badge>
                {isFull && eventCapacity && eventCapacity > 0 && (
                  <Badge className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-red-500/20 text-red-200 border border-red-500/30 backdrop-blur">
                    <AlertTriangle className="w-3 h-3" />
                    Full
                  </Badge>
                )}
              </div>
            </div>
            {demoParticipants.length === 0 ? (
              <p className={`text-sm ${mutedText} px-1`}>No one has joined so far.</p>
            ) : (
              <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
                {demoParticipants.map((participant, i) => {
                  const initial = (participant.name?.trim()?.[0] ?? "?").toUpperCase()
                  return (
                    <motion.div
                      key={participant.name || i}
                      whileHover={{ scale: 1.05, y: -2 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col items-center gap-2 min-w-[80px]"
                    >
                      <div className="relative">
                        {participant.avatar ? (
                          <img
                            src={participant.avatar}
                            alt={participant.name}
                            className="w-16 h-16 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--theme-accent-light)] to-[var(--theme-accent-dark)] p-0.5">
                            <div className={`w-full h-full rounded-full ${uiMode === "dark" ? "bg-slate-100" : "bg-white"} flex items-center justify-center border border-white/10`}>
                              <span className={`text-lg font-semibold ${uiMode === "dark" ? "text-black" : "text-black"}`}>
                                {initial}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                      <p className={`mt-1 w-14 truncate text-center text-[11px] ${mutedText}`}>
                        {participant.name}
                      </p>
                    </motion.div>
                  )
                })}
              </div>
            )}

            {/* Waitlist section - shown below joined participants */}
            {!isEditMode && !isPreviewMode && waitlist && waitlist.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <h3 className={cn("text-xs font-medium uppercase tracking-wide", mutedText)}>Waitlist</h3>
                  <Badge className={cn(
                    "text-[10px] px-1.5 py-0.5",
                    uiMode === "dark" 
                      ? "bg-amber-500/10 text-amber-400/60 border-amber-500/20" 
                      : "bg-amber-500/10 text-amber-600/70 border-amber-500/20"
                  )}>
                    {waitlist.length}
                  </Badge>
                </div>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
                  {waitlist.map((participant) => (
                    <div
                      key={participant.id}
                      className={cn(
                        "px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0",
                        "text-xs font-medium",
                        uiMode === "dark"
                          ? "bg-white/5 border border-white/10 text-white/60"
                          : "bg-black/5 border border-black/10 text-black/60"
                      )}
                    >
                      {participant.display_name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </motion.div>
      )}

      {isEditMode && !isPreviewMode && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className={`${glassCard} p-6`}>
            <h2 className={`text-lg font-semibold ${strongText} mb-4`}>Payment details</h2>

            {/* Upload QR Section */}
            <div className="mb-6">
              <label className={`text-sm ${mutedText} mb-2 block`}>Upload QR Code</label>
              {paymentQrImage ? (
                <div className="relative">
                  <img
                    src={paymentQrImage || "/placeholder.svg"}
                    alt="Payment QR"
                    className="w-full max-w-[200px] rounded-lg"
                  />
                  <button
                    onClick={onPaymentQrImageRemove}
                    className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className={`border-2 border-dashed rounded-lg p-8 text-center hover:border-[var(--theme-accent)]/50 transition-colors cursor-pointer block ${
                  uiMode === "dark" ? "border-white/20" : "border-black/30"
                }`}>
                  <input type="file" accept="image/*" onChange={onPaymentQrImageUpload} className="hidden" />
                  <Upload className={`w-8 h-8 mx-auto mb-2 ${
                    uiMode === "dark" ? "text-white/40" : "text-black/50"
                  }`} />
                  <p className={`text-sm ${
                    uiMode === "dark" ? "text-white/60" : "text-black/70"
                  }`}>Upload Touch 'n Go / Maybank QR</p>
                  <p className={`text-xs mt-1 ${
                    uiMode === "dark" ? "text-white/40" : "text-black/50"
                  }`}>or bank transfer screenshot</p>
                </label>
              )}
            </div>

            {/* Bank Details */}
            <div className="space-y-3">
              <div>
                <label className={`text-sm ${mutedText} mb-1.5 block`}>Bank Name</label>
                <Input
                  value={bankName}
                  onChange={(e) => onBankNameChange(e.target.value)}
                  placeholder="e.g. Maybank"
                  className={`${inputBg} ${inputBorder} ${strongText} ${inputPlaceholder} focus:ring-[var(--theme-accent)]/50`}
                />
              </div>
              <div>
                <label className={`text-sm ${mutedText} mb-1.5 block`}>Account Number</label>
                <Input
                  value={accountNumber}
                  onChange={(e) => onAccountNumberChange(e.target.value)}
                  placeholder="1234567890"
                  className={`${inputBg} ${inputBorder} ${strongText} ${inputPlaceholder} focus:ring-[var(--theme-accent)]/50`}
                />
              </div>
              <div>
                <label className={`text-sm ${mutedText} mb-1.5 block`}>Account Name</label>
                <Input
                  value={accountName}
                  onChange={(e) => onAccountNameChange(e.target.value)}
                  placeholder="Your name"
                  className={`${inputBg} ${inputBorder} ${strongText} ${inputPlaceholder} focus:ring-[var(--theme-accent)]/50`}
                />
              </div>
              <div>
                <label className={`text-sm ${mutedText} mb-1.5 block`}>Instructions (optional)</label>
                <Textarea
                  value={paymentNotes}
                  onChange={(e) => onPaymentNotesChange(e.target.value)}
                  placeholder="e.g. Please include your name in the transfer notes"
                  className={`${inputBg} ${inputBorder} ${strongText} ${inputPlaceholder} focus:ring-[var(--theme-accent)]/50 min-h-[80px]`}
                />
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {(!isEditMode || isPreviewMode) && (bankName || accountNumber || accountName || paymentQrImage) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <Card className={`${glassCard} p-6`}>
            <h2 className={`text-lg font-semibold ${strongText} mb-4`}>Payment details</h2>

            {paymentQrImage && (
              <div className="mb-4">
                <div
                  onClick={() => setQrImageModalOpen(true)}
                  className="relative w-full max-w-[200px] mx-auto cursor-pointer group"
                >
                  <img
                    src={paymentQrImage || "/placeholder.svg"}
                    alt="Payment QR"
                    className="w-full rounded-lg transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-lg transition-colors flex items-center justify-center">
                    <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                  </div>
                </div>
              </div>
            )}

            {/* QR Image Modal */}
            <Dialog open={qrImageModalOpen} onOpenChange={setQrImageModalOpen}>
              <DialogContent className={cn(
                "sm:max-w-[90vw] max-w-[95vw] p-0 gap-0 overflow-hidden",
                uiMode === "dark" ? "bg-slate-900 border-white/10" : "bg-white border-black/10"
              )}>
                <DialogHeader className="sr-only">
                  <DialogTitle>Payment QR Code</DialogTitle>
                </DialogHeader>
                <div className="relative w-full h-auto flex items-center justify-center bg-black/5 p-4">
                  {/* Download button at top right */}
                  <button
                    onClick={handleDownloadQrImage}
                    className={cn(
                      "absolute top-4 right-4 z-10 p-3 rounded-full shadow-lg backdrop-blur-sm transition-transform hover:scale-110 active:scale-95",
                      uiMode === "dark"
                        ? "bg-white/90 text-black hover:bg-white"
                        : "bg-black/90 text-white hover:bg-black"
                    )}
                    aria-label="Download QR code"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  
                  {/* Close button */}
                  <button
                    onClick={() => setQrImageModalOpen(false)}
                    className={cn(
                      "absolute top-4 left-4 z-10 p-3 rounded-full shadow-lg backdrop-blur-sm transition-transform hover:scale-110 active:scale-95",
                      uiMode === "dark"
                        ? "bg-white/90 text-black hover:bg-white"
                        : "bg-black/90 text-white hover:bg-black"
                    )}
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  {/* QR Image */}
                  <img
                    src={paymentQrImage || "/placeholder.svg"}
                    alt="Payment QR Code"
                    className="max-w-full max-h-[70vh] w-auto h-auto rounded-lg"
                  />
                </div>
              </DialogContent>
            </Dialog>

            <div className="space-y-3">
              {bankName && (
                <div>
                  <p className={`text-xs ${mutedText} uppercase tracking-wide`}>Bank Name</p>
                  <p className={`${strongText} font-medium`}>{bankName}</p>
                </div>
              )}
              {accountNumber && (
                <div>
                  <p className={`text-xs ${mutedText} uppercase tracking-wide`}>Account Number</p>
                  <p className={`${strongText} font-medium`}>{accountNumber}</p>
                </div>
              )}
              {accountName && (
                <div>
                  <p className={`text-xs ${mutedText} uppercase tracking-wide`}>Account Name</p>
                  <p className={`${strongText} font-medium`}>{accountName}</p>
                </div>
              )}
              {paymentNotes && (
                <div>
                  <p className={`text-xs ${mutedText} uppercase tracking-wide`}>Instructions</p>
                  <p className={`${mutedText} text-sm`}>{paymentNotes}</p>
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      )}

      {(!isEditMode || isPreviewMode) && actualSessionId && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          data-payment-section
        >
          <Card className={`${glassCard} p-6`}>
            <h2 className={`text-lg font-semibold ${strongText} mb-2`}>Upload payment proof</h2>
            {proofSubmitted ? (
              <div className="text-center py-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20 mb-3">
                  <Check className="w-6 h-6 text-green-500" />
                </div>
                <p className={`text-sm font-medium ${strongText} mb-1`}>Payment proof submitted</p>
                <p className={`text-xs ${mutedText}`}>Your payment proof is being reviewed by the host.</p>
              </div>
            ) : (
              <>
                {/* Payment upload - available to anyone (not in host preview mode) */}
                {(() => {
                  // Host preview: in preview mode AND no actual session ID (means it's a draft/new session being previewed)
                  const isHostPreview = isPreviewMode && !actualSessionId
                  
                  return (
                    <>
                      {/* Show selected participants as pills */}
                      {payingForParticipantNames.length > 0 && (
                        <div className="mb-4">
                          <p className={`text-xs ${mutedText} mb-2`}>Paying for:</p>
                          <div className="flex flex-wrap gap-2">
                            {payingForParticipantNames.map((name, index) => (
                              <div
                                key={index}
                                className={cn(
                                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium",
                                  uiMode === "dark"
                                    ? "bg-lime-500/20 text-lime-300 border border-lime-500/30"
                                    : "bg-lime-500/20 text-lime-700 border border-lime-500/30"
                                )}
                              >
                                <span>{name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <p className={`text-sm ${mutedText} mb-4`}>
                        Please upload your payment confirmation to secure your spot.
                      </p>
                      {proofImage ? (
                        <div className="space-y-4">
                          <div className="relative">
                            <img src={proofImage || "/placeholder.svg"} alt="Payment proof" className="w-full rounded-lg" />
                            <button
                              onClick={onProofImageRemove}
                              className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-2"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          {!isHostPreview && (
                            <Button
                              onClick={onSubmitPaymentProof}
                              disabled={isSubmittingProof || !proofImageFile}
                              className="w-full rounded-full h-11 bg-gradient-to-r from-lime-500 to-emerald-500 hover:from-lime-400 hover:to-emerald-400 text-black font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isSubmittingProof ? "Submitting..." : "Submit payment proof"}
                            </Button>
                          )}
                        </div>
                      ) : (
                        <label className={`border-2 border-dashed rounded-lg p-8 text-center hover:border-[var(--theme-accent)]/50 transition-colors cursor-pointer block ${
                          uiMode === "dark" ? "border-white/20" : "border-black/30"
                        } ${isHostPreview ? "opacity-50 cursor-not-allowed" : ""}`}>
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={onProofImageUpload} 
                            className="hidden"
                            disabled={isHostPreview}
                          />
                          <Upload className={`w-8 h-8 mx-auto mb-2 ${
                            uiMode === "dark" ? "text-white/40" : "text-black/50"
                          }`} />
                          <p className={`text-sm ${
                            uiMode === "dark" ? "text-white/60" : "text-black/70"
                          }`}>Click to upload or drag and drop</p>
                          <p className={`text-xs mt-1 ${
                            uiMode === "dark" ? "text-white/40" : "text-black/50"
                          }`}>Screenshot or photo</p>
                        </label>
                      )}
                    </>
                  )
                })()}
              </>
            )}
          </Card>
        </motion.div>
      )}
    </motion.div>
  )
}

