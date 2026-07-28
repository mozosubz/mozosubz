'use client'

import { useState } from 'react'
import { useConfirm, useToast } from '@/components/app-dialog'

export default function DialogCheck() {
  const confirm = useConfirm()
  const toast = useToast()
  const [result, setResult] = useState('none')

  return (
    <main style={{ minHeight: '260vh', padding: 24 }}>
      <button
        type="button"
        id="danger"
        onClick={async () => {
          window.scrollTo(0, 900)
          const p = confirm({
            title: 'Grant admin privileges?',
            message:
              'This user will get full access to the admin panel, including wallets and pricing.',
            confirmLabel: 'Grant access',
          })
          // Measure while open and stash it in the DOM, since each browser
          // eval runs in a fresh context and can't observe the open state.
          setTimeout(() => {
            const d = document.querySelector('[role=dialog]') as HTMLElement | null
            const el = document.getElementById('measure')
            if (d && el) {
              const r = d.getBoundingClientRect()
              el.textContent = JSON.stringify({
                htmlClass: document.documentElement.className || '(none)',
                cardBg: getComputedStyle(d).backgroundColor,
                scrollY: window.scrollY,
                dialogTop: Math.round(r.top),
                dialogBottom: Math.round(r.bottom),
                fullyVisible: r.top >= 0 && r.bottom <= window.innerHeight,
                overlayParentIsBody: d.parentElement?.parentElement === document.body,
                ariaModal: d.getAttribute('aria-modal'),
                bodyOverflow: getComputedStyle(document.body).overflow,
                docH: document.body.scrollHeight,
              })
            }
          }, 400)
          const ok = await p
          setResult(ok ? 'confirmed' : 'cancelled')
        }}
      >
        Open confirm
      </button>
      <button type="button" id="toastbtn" onClick={() => toast('Admin privileges granted', 'success')}>
        Toast
      </button>
      <p id="result">{result}</p>
      <pre id="measure" style={{ fontSize: 11, whiteSpace: 'pre-wrap' }} />
    </main>
  )
}
