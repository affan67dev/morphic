'use client'
import Link from 'next/link'

import { NovaMark } from './dashboard'

import './builder.css'
export default function BuilderErrorPage({
  code = '404',
  title = 'A small detour.',
  message = 'This page may have moved, or this project is not available to you.',
  retry
}: {
  code?: string
  title?: string
  message?: string
  retry?: () => void
}) {
  return (
    <main className="builder-app builder-error-page">
      <Link className="builder-brand" href="/">
        <NovaMark />
        <span>NOVA</span>
      </Link>
      <section>
        <div className="error-illustration">
          <NovaMark />
          <span>{code}</span>
        </div>
        <small>LET’S GET YOU BACK TO BUILDING</small>
        <h1>{title}</h1>
        <p>{message} Your saved projects have not been removed.</p>
        <div>
          {retry && (
            <button className="secondary-button" onClick={retry}>
              Try again
            </button>
          )}
          <Link className="primary-button" href="/">
            Back to dashboard ↗
          </Link>
        </div>
      </section>
    </main>
  )
}
