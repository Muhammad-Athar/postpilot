"use client";
import * as Dlg from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

export function Dialog({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: ReactNode; description?: ReactNode; children: ReactNode }) {
  return (
    <Dlg.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dlg.Portal forceMount>
            <Dlg.Overlay asChild>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="fixed inset-0 z-50 bg-fg/40 backdrop-blur-[2px]" />
            </Dlg.Overlay>
            <Dlg.Content asChild>
              <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius)] border border-line bg-elev p-6 shadow-lift focus:outline-none">
                <Dlg.Title className="font-serif text-2xl">{title}</Dlg.Title>
                {description && <Dlg.Description className="mt-1 text-sm text-fg-muted">{description}</Dlg.Description>}
                <div className="mt-5">{children}</div>
              </motion.div>
            </Dlg.Content>
          </Dlg.Portal>
        )}
      </AnimatePresence>
    </Dlg.Root>
  );
}
