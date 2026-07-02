import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED_ROUTES = ['/agent', '/audit', '/analytics', '/settings']

export default function middleware(request: NextRequest) {
  const isProtected = PROTECTED_ROUTES.some((r) =>
    request.nextUrl.pathname.startsWith(r)
  )
  const token = request.cookies.get('sentinel-auth')

  if (isProtected && !token) {
    const next = encodeURIComponent(request.nextUrl.pathname)
    return NextResponse.redirect(
      new URL(`/?login=1&next=${next}`, request.url)
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/agent/:path*', '/audit/:path*', '/analytics/:path*', '/settings/:path*'],
}
