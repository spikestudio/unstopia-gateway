"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/app/providers";
import { DocumentTitle, SettingsProvider } from "@/app/settings-provider";
import { EmojiFavicon } from "@/components/emoji-favicon";
import { NotificationProvider } from "@/components/notifications/notification-provider";
import { BreadcrumbProvider } from "@/context/breadcrumb-context";
import { useQueryInvalidation } from "@/hooks/use-query-invalidation";
import { queryClient } from "@/lib/query-client";

function QueryInvalidationBridge() {
  useQueryInvalidation();
  return null;
}

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BreadcrumbProvider>
          <SettingsProvider>
            <NotificationProvider>
              {children}
              <DocumentTitle />
              <EmojiFavicon />
              <QueryInvalidationBridge />
            </NotificationProvider>
          </SettingsProvider>
        </BreadcrumbProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
