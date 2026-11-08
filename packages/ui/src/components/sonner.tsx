"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useTheme } from "../theme/index.ts";

/** sonner's own gaps from the edge, 24px and 16px under 600px wide, plus the safe area. */
function safeOffset(gap: string) {
  return {
    top: `calc(${gap} + env(safe-area-inset-top))`,
    right: `calc(${gap} + env(safe-area-inset-right))`,
    bottom: `calc(${gap} + env(safe-area-inset-bottom))`,
    left: `calc(${gap} + env(safe-area-inset-left))`,
  };
}

const offset = safeOffset("24px");
const mobileOffset = safeOffset("16px");

const Toaster = ({ ...props }: ToasterProps) => {
  const { colorScheme } = useTheme();

  return (
    <Sonner
      theme={colorScheme}
      className="toaster group"
      offset={offset}
      mobileOffset={mobileOffset}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        // Under raymond a toast is the period's info balloon, info yellow in
        // a black frame, and its action a push button with the default
        // button's frame.
        classNames: {
          toast:
            "cn-toast raymond:gap-2! raymond:rounded-none! raymond:border! raymond:border-(--info-foreground)! raymond:bg-(--info)! raymond:px-2! raymond:py-1.5! raymond:text-(--info-foreground)! raymond:shadow-none!",
          actionButton:
            "raymond:rounded-none! raymond:bg-(--3d-face)! raymond:text-foreground! raymond:shadow-[inset_0_0_0_1px_var(--foreground),inset_-2px_-2px_var(--3d-dark-shadow),inset_2px_2px_var(--3d-highlight),inset_-3px_-3px_var(--3d-shadow),inset_3px_3px_var(--3d-light)]! raymond:active:shadow-pressed!",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
