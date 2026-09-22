"use client";

import * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const loginSchema = z.object({
  email: z.string().email("Format email tidak valid").min(1, "Email harus diisi"),
  password: z.string().min(1, "Password harus diisi"),
});

export function LoginForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset error state
    setError(null);
    
    // Validation
    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      // Sesuai permintaan, pesan error gagal login diseragamkan
      setError("Email atau password-nya salah nih");
      return;
    }

    setIsLoading(true);

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (res?.error) {
        setError("Email atau password-nya salah nih");
      } else {
        // Refresh router agar server component membaca sesi baru 
        // dan melakukan redirect sesuai peran secara otomatis
        router.refresh();
      }
    } catch {
      setError("Terjadi kesalahan sistem, coba lagi nanti.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-hot-soft text-hot text-sm font-medium p-3 rounded-[12px] border border-hot/20">
          {error}
        </div>
      )}
      
      <Input
        label="Email"
        type="email"
        placeholder="nama@contoh.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={isLoading}
      />
      
      <Input
        label="Password"
        type="password"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={isLoading}
      />
      
      <div className="pt-2">
        <Button 
          type="submit" 
          variant="primary" 
          fullWidth 
          isLoading={isLoading}
          disabled={isLoading}
        >
          Masuk
        </Button>
      </div>
    </form>
  );
}
