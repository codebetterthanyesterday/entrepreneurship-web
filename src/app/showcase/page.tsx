"use client";

// TODO: Halaman ini hanya untuk keperluan review visual dan harus dihapus sebelum produksi.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet } from "@/components/ui/sheet";
import { Stepper } from "@/components/ui/stepper";
import { useToast } from "@/components/ui/use-toast";

export default function ShowcasePage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [stepperValue, setStepperValue] = useState(1);
  const { toast } = useToast();

  return (
    <div className="p-8 space-y-12 max-w-4xl mx-auto pb-32">
      <div className="space-y-2">
        <h1 className="text-3xl font-display font-semibold text-pink-deep">UI Components Showcase</h1>
        <p className="text-ink-soft">Halaman ini digunakan untuk memastikan semua token warna, typography, dan border berfungsi dengan baik sebelum merakit layar yang sebenarnya.</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ink border-b-[1.5px] border-line pb-2">1. Buttons</h2>
        <div className="flex flex-wrap gap-4 items-center">
          <Button variant="primary">Primary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="flat">Flat</Button>
          <Button variant="go">Go Action</Button>
          <Button variant="done">Done Action</Button>
        </div>
        <div className="flex flex-wrap gap-4 items-center pt-2">
          <Button size="sm">Small Size</Button>
          <Button isLoading>Loading</Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ink border-b-[1.5px] border-line pb-2">2. Cards & Badges</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <h3 className="font-semibold mb-2">Static Card</h3>
            <p className="text-sm text-ink-soft">Hanya kontainer biasa dengan styling dasar.</p>
          </Card>
          <Card interactive>
            <h3 className="font-semibold mb-2">Interactive Card</h3>
            <p className="text-sm text-ink-soft">Hover untuk melihat efek border berubah.</p>
          </Card>
        </div>
        <div className="flex gap-2 flex-wrap pt-2">
          <Badge variant="info">New Item</Badge>
          <Badge variant="prep">Preparing</Badge>
          <Badge variant="danger">Sold Out</Badge>
          <Badge variant="muted">Draft</Badge>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ink border-b-[1.5px] border-line pb-2">3. Chips & Stepper</h2>
        <div className="flex gap-2">
          <Chip active>Active Filter</Chip>
          <Chip>Inactive Filter</Chip>
        </div>
        <div className="pt-2">
          <Stepper value={stepperValue} onChange={setStepperValue} max={5} />
          <p className="text-xs text-ink-soft mt-2">Max is 5</p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ink border-b-[1.5px] border-line pb-2">4. Inputs</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Input label="Nama Lengkap" placeholder="Masukkan nama..." hint="Nama akan dicetak di struk" />
            <Input label="Username" defaultValue="error_user" error="Username sudah dipakai" />
          </div>
          <div className="space-y-4">
            <Textarea label="Catatan Tambahan" placeholder="Opsional..." />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ink border-b-[1.5px] border-line pb-2">5. Empty State</h2>
        <Card>
          <EmptyState 
            emoji="🛒" 
            title="Keranjang Masih Kosong" 
            description="Yuk, pilih menu favoritmu sekarang sebelum kehabisan!"
            action={<Button size="sm">Lihat Menu</Button>}
          />
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ink border-b-[1.5px] border-line pb-2">6. Overlays (Sheet & Toast)</h2>
        <div className="flex gap-4">
          <Button onClick={() => setSheetOpen(true)} variant="flat">
            Buka Responsive Sheet
          </Button>
          <Button onClick={() => toast("Pesanan berhasil ditambahkan ke keranjang!")} variant="ghost">
            Tampilkan Toast
          </Button>
        </div>
      </section>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Detail Pesanan">
        <div className="py-4 space-y-4">
          <p className="text-ink-soft">Ini adalah konten di dalam sheet. Di layar kecil (mobile), ini akan muncul dari bawah. Di layar besar (desktop &gt;= 1040px), ini akan menjadi modal di tengah.</p>
          <div className="h-40 bg-cream rounded-xl border-[1.5px] border-dashed border-line flex items-center justify-center text-ink-soft">Placeholder area</div>
          <Button fullWidth variant="primary" onClick={() => setSheetOpen(false)}>Tutup</Button>
        </div>
      </Sheet>
    </div>
  );
}
