import { Suspense } from "react"
import { SessionInvite } from "@/components/session-invite"

function SessionInviteWrapper() {
  return (
    <SessionInvite
      sessionId="demo"
      initialEditMode={false}
      initialPreviewMode={true}
      initialSport="Badminton"
      initialCoverUrl="/ghibli style/bird-badminton.png"
      initialTitle="Chickie Land Morning Smash"
      initialDate="Sat, Jan 25 • 9:00 AM - 11:00 AM"
      initialLocation="Chickie Land Badminton Meadow, Court 3"
      initialPrice={15}
      initialCapacity={12}
      initialHostName="Chickie Nuggets"
      initialDescription={`Welcome to Chickie Land — a sunlit meadow where shuttlecocks float like dandelion seeds.

We'll play friendly doubles, rotate every few points, and cheer for every silly miss.

Bring your racket (or borrow one from the Chickie Nuggets basket).

Beginners totally welcome — the fluffier the swing, the better.`}
      demoMode={true}
      demoParticipants={[
        { name: "Chickie Nuggets", avatar: null },
        { name: "Fluffy Wing", avatar: null },
        { name: "Captain Drumstick", avatar: null },
        { name: "Mochi Chick", avatar: null },
        { name: "Sunny Feather", avatar: null },
        { name: "Matcha Puff", avatar: null },
      ]}
    />
  )
}

export default function DemoInvitePage() {
  return (
    <main className="min-h-screen sporty-bg">
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
        <SessionInviteWrapper />
      </Suspense>
    </main>
  )
}
