import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ClaudeAuthCard } from "@/components/settings/ClaudeAuthCard";

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 py-8">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" render={<Link href="/" />} nativeButton={false}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="font-heading text-lg font-semibold">Settings</h1>
      </div>

      <ClaudeAuthCard />
    </div>
  );
}
