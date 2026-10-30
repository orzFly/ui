import {
  PROFILE,
  type Profile,
  sameProfile,
  TOKENS,
} from "@orz/fixtures/account.ts";
import { Button } from "@orz/ui/components/button";
import { UnsavedChangesDialog } from "@orz/ui/components/unsaved-changes-dialog";
import { cn } from "@orz/ui/lib/utils";
import {
  BellIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  KeyRoundIcon,
  type LucideIcon,
  PaletteIcon,
  SquarePenIcon,
  UserIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  AppearanceSection,
  EditorSection,
  NotificationsSection,
  PREFERENCES,
  type Preferences,
  ProfileSection,
  TokensSection,
} from "./sections.tsx";

type SectionId =
  | "editor"
  | "notifications"
  | "appearance"
  | "profile"
  | "tokens";

const SECTIONS: {
  id: SectionId;
  title: string;
  description: string;
  Icon: LucideIcon;
}[] = [
  {
    id: "editor",
    title: "Editor",
    description: "How files look while you edit them. Changes apply at once.",
    Icon: SquarePenIcon,
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "What reaches you, and where. Changes apply at once.",
    Icon: BellIcon,
  },
  {
    id: "appearance",
    title: "Appearance",
    description: "The colours of every screen, yours to pick.",
    Icon: PaletteIcon,
  },
  {
    id: "profile",
    title: "Profile",
    description: "What others see of you. Saved when you press Save profile.",
    Icon: UserIcon,
  },
  {
    id: "tokens",
    title: "Access tokens",
    description: "Tokens that scripts and bots sign in with.",
    Icon: KeyRoundIcon,
  },
];

/**
 * Where the screen is. On a phone `open` says whether a section is pushed over the list of
 * sections; a wide screen shows both and ignores it.
 */
interface View {
  section: SectionId;
  open: boolean;
}

/**
 * A settings screen as an app would write one: Switches that apply as they flip, a profile form
 * that saves and guards its unsaved edits, the user's theme, and a destructive step that asks
 * first. A sidebar beside the section on a wide screen; on a phone, a list that pushes each
 * section, as the phone's own settings do.
 */
export function Settings() {
  const [view, setView] = useState<View>({ section: "editor", open: false });
  const [prefs, setPrefs] = useState(PREFERENCES);
  const [saved, setSaved] = useState(PROFILE);
  const [draft, setDraft] = useState(PROFILE);
  const [tokens, setTokens] = useState(TOKENS);
  // Bumped on a discard, so the form forgets an error it showed for the edits it lost.
  const [revision, setRevision] = useState(0);
  const [leavingTo, setLeavingTo] = useState<View | null>(null);
  const dirty = !sameProfile(draft, saved);

  useEffect(() => {
    if (!dirty) return;
    const onUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    addEventListener("beforeunload", onUnload);
    return () => removeEventListener("beforeunload", onUnload);
  }, [dirty]);

  const go = (next: View) => {
    const staying = next.section === "profile" && next.open;
    if (dirty && view.section === "profile" && !staying) setLeavingTo(next);
    else setView(next);
  };

  const current = SECTIONS.find(({ id }) => id === view.section) ?? SECTIONS[0];
  const onPrefs = (next: Partial<Preferences>) =>
    setPrefs((was) => ({ ...was, ...next }));

  return (
    <div className="h-full overflow-y-auto md:grid md:grid-cols-[14rem_1fr] md:overflow-hidden">
      <nav
        aria-label="Settings"
        className={cn(
          "p-2 md:overflow-y-auto md:border-r md:bg-sidebar md:p-3",
          view.open && "max-md:hidden",
        )}
      >
        <ul className="grid gap-0.5">
          {SECTIONS.map(({ id, title, Icon }) => (
            <li key={id}>
              <button
                type="button"
                aria-current={id === view.section ? "page" : undefined}
                onClick={() => go({ section: id, open: true })}
                className={cn(
                  "flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-ui transition-colors hover:bg-accent md:min-h-8 md:px-2.5 touch:md:min-h-11",
                  id === view.section && "md:bg-accent md:font-medium",
                )}
              >
                <Icon className="size-4 text-muted-foreground" />
                <span className="flex-1">{title}</span>
                <ChevronRightIcon className="size-4 text-muted-foreground md:hidden" />
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <section
        aria-labelledby="settings-section-title"
        className={cn(
          "min-w-0 p-4 md:overflow-y-auto md:p-6",
          !view.open && "max-md:hidden",
        )}
      >
        <Button
          variant="ghost"
          className="-ml-2 mb-2 md:hidden"
          onClick={() => go({ section: view.section, open: false })}
        >
          <ChevronLeftIcon />
          Settings
        </Button>
        <h2
          id="settings-section-title"
          className="font-semibold text-lg leading-snug"
        >
          {current.title}
        </h2>
        <p className="mt-1 text-muted-foreground text-ui">
          {current.description}
        </p>
        <div className="mt-2 max-w-2xl">
          {view.section === "editor" && (
            <EditorSection prefs={prefs} onChange={onPrefs} />
          )}
          {view.section === "notifications" && (
            <NotificationsSection prefs={prefs} onChange={onPrefs} />
          )}
          {view.section === "appearance" && <AppearanceSection />}
          {view.section === "profile" && (
            <ProfileSection
              key={revision}
              saved={saved}
              draft={draft}
              onDraft={(next) => setDraft((was) => ({ ...was, ...next }))}
              onSave={(profile: Profile) => {
                setSaved(profile);
                setDraft(profile);
              }}
            />
          )}
          {view.section === "tokens" && (
            <TokensSection
              tokens={tokens}
              onRevoke={(token) =>
                setTokens((list) => list.filter((each) => each !== token))
              }
            />
          )}
        </div>
      </section>
      <UnsavedChangesDialog
        open={leavingTo !== null}
        onStay={() => setLeavingTo(null)}
        onProceed={() => {
          setDraft(saved);
          setRevision((count) => count + 1);
          if (leavingTo) setView(leavingTo);
          setLeavingTo(null);
        }}
      />
    </div>
  );
}
