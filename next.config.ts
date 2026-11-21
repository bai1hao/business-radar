import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // 隐藏左下角的 Next.js 开发指示器
  devIndicators: false,
};

const configForPhase = (phase: string) => withNextIntl({
  ...nextConfig,
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
});

export default configForPhase;
