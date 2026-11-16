"use client";

import Image from "next/image";

interface ConnectWithStravaButtonProps {
  className?: string;
}

export function ConnectWithStravaButton({
  className = "",
}: ConnectWithStravaButtonProps) {
  return (
    <a
      href="/api/strava/auth?flow=athlete"
      aria-label="Connect with STRAVA"
      className={`inline-flex h-12 w-fit max-w-full items-center justify-center ${className}`}
    >
      <Image
        src="/strava/connect-with-strava-orange.svg"
        alt="Connect with STRAVA"
        width={237}
        height={48}
        priority
        className="h-12 w-auto max-w-full"
      />
    </a>
  );
}

export function PoweredByStravaLogo({
  className = "",
}: {
  className?: string;
}) {
  return (
    <a
      href="https://www.strava.com"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Powered by Strava"
      className={`inline-flex items-center ${className}`}
    >
      <Image
        src="/strava/powered-by-strava-white.svg"
        alt="Powered by Strava"
        width={365}
        height={37}
        className="h-auto w-36"
      />
    </a>
  );
}

export function StravaIcon({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/strava/strava-favicon.ico"
      alt=""
      aria-hidden="true"
      width={18}
      height={18}
      unoptimized
      className={className}
    />
  );
}
