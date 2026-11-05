import createIntlMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from './i18n/config';

const intl = createIntlMiddleware({ locales, defaultLocale, localeDetection: true, localePrefix: 'always' });

export default function middleware(request: NextRequest) {
  const username = process.env.BUSINESS_RADAR_USERNAME;
  const password = process.env.BUSINESS_RADAR_PASSWORD;
  if (!username || !password) {
    if (process.env.NODE_ENV === 'production') {
      return new NextResponse('Set BUSINESS_RADAR_USERNAME and BUSINESS_RADAR_PASSWORD before starting the server.', { status: 503 });
    }
  } else {
    const header = request.headers.get('authorization') || '';
    let valid = false;
    if (header.startsWith('Basic ')) {
      try {
        const decoded = atob(header.slice(6));
        const separator = decoded.indexOf(':');
        valid = separator > 0 && decoded.slice(0, separator) === username && decoded.slice(separator + 1) === password;
      } catch { valid = false; }
    }
    if (!valid) {
      return new NextResponse('Authentication required', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Business Radar", charset="UTF-8"', 'Cache-Control': 'no-store' } });
    }
  }
  if (request.nextUrl.pathname.startsWith('/api/')) return NextResponse.next();
  return intl(request);
}

export const config = { matcher: ['/((?!_next|_vercel|favicon.ico).*)'] };
