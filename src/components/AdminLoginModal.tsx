"use client";

import React, { FormEvent, useState } from "react";
import { X } from "lucide-react";

interface AdminLoginModalProps {
  onClose: () => void;
  onLogin: () => void;
}

export function AdminLoginModal({ onClose, onLogin }: AdminLoginModalProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "ไม่สามารถเข้าสู่ระบบได้");
      }
      onLogin();
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "เกิดข้อผิดพลาดขณะเข้าสู่ระบบ"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-login-title"
        className="w-full max-w-sm rounded-2xl border border-kmutt-border bg-kmutt-card p-5 shadow-2xl"
      >
        <header className="mb-5 flex items-center justify-between">
          <h2 id="admin-login-title" className="text-lg font-bold text-white">
            Admin login
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close login"
            className="rounded-lg p-2 text-gray-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm text-gray-300">
            Username
            <input
              autoComplete="username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-1 w-full rounded-lg border border-kmutt-border bg-[#111619] px-3 py-2 text-white outline-none focus:border-kmutt-orange"
            />
          </label>
          <label className="block text-sm text-gray-300">
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-lg border border-kmutt-border bg-[#111619] px-3 py-2 text-white outline-none focus:border-kmutt-orange"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-300">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-kmutt-orange px-4 py-2 font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </div>
  );
}
