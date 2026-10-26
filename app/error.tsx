'use client'
import BuilderErrorPage from '@/components/builder/error-page'
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <BuilderErrorPage
      code="500"
      title="Something interrupted the flow."
      message="We couldn’t open this part of your workspace. Please try again."
      retry={reset}
    />
  )
}
