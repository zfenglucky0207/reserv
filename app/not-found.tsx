import { redirect } from "next/navigation"

export default function NotFound() {
  // Redirect all 404 errors to home page
  redirect("/")
}

