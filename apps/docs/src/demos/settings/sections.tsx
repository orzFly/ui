import {
  type AccessToken,
  LANGUAGES,
  type Profile,
  sameProfile,
  TIME_ZONES,
} from "@orz/fixtures/account.ts";
import { Avatar, AvatarFallback, AvatarImage } from "@orz/ui/components/avatar";
import { Button } from "@orz/ui/components/button";
import { Checkbox } from "@orz/ui/components/checkbox";
import { ConfirmDialog } from "@orz/ui/components/confirm-dialog";
import { FieldError } from "@orz/ui/components/field";
import { FileDrop, FileDropTrigger } from "@orz/ui/components/file-drop";
import { GroupHeading } from "@orz/ui/components/group-heading";
import { InfoPopover } from "@orz/ui/components/info-popover";
import { Input } from "@orz/ui/components/input";
import { Label } from "@orz/ui/components/label";
import { List, ListItem } from "@orz/ui/components/list";
import { NumberInput } from "@orz/ui/components/number-input";
import { Pane } from "@orz/ui/components/pane";
import { RadioGroup, RadioGroupItem } from "@orz/ui/components/radio-group";
import {
  moveItem,
  Reorder,
  ReorderButtons,
  ReorderHandle,
  ReorderItem,
} from "@orz/ui/components/reorder";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@orz/ui/components/select";
import { Separator } from "@orz/ui/components/separator";
import { Skeleton } from "@orz/ui/components/skeleton";
import { Switch } from "@orz/ui/components/switch";
import { ThemeEditor } from "@orz/ui/components/theme-editor";
import { ThemeMenu } from "@orz/ui/components/theme-menu";
import { cn } from "@orz/ui/lib/utils";
import { useTerminalTheme, useTheme } from "@orz/ui/theme";
import {
  KeyRoundIcon,
  PaletteIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import {
  Children,
  Fragment,
  isValidElement,
  type ReactNode,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { ClientOnly } from "../../hydrated.tsx";

/** The settings that apply as they change; they outlive a visit to another section. */
export interface Preferences {
  wrap: boolean;
  lineNumbers: boolean;
  formatOnSave: boolean;
  /** Pixels. */
  fontSize: number;
  language: string;
  indent: "2" | "4" | "tab";
  notify: "all" | "mentions" | "none";
  email: boolean;
  desktop: boolean;
  push: boolean;
  /** The order the channels are tried in. */
  channels: Channel[];
  weekly: boolean;
}

type Channel = "email" | "desktop" | "push";

const CHANNELS: Record<Channel, string> = {
  email: "Email",
  desktop: "Desktop notifications",
  push: "Push to phone",
};

export const PREFERENCES: Preferences = {
  wrap: true,
  lineNumbers: true,
  formatOnSave: false,
  fontSize: 13,
  language: "markdown",
  indent: "2",
  notify: "mentions",
  email: true,
  desktop: false,
  push: true,
  channels: ["email", "desktop", "push"],
  weekly: true,
};

interface PreferenceProps {
  prefs: Preferences;
  onChange(next: Partial<Preferences>): void;
}

/**
 * A label on the leading edge, its control on the trailing edge, as a phone's settings lay them
 * out. `info` is what the setting does, behind an (i) after the label.
 */
function SettingRow({
  id,
  label,
  info,
  disabled = false,
  children,
}: {
  id: string;
  label: string;
  info?: ReactNode;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 touch:min-h-touch">
      <div className="group flex items-center gap-1" data-disabled={disabled}>
        <Label htmlFor={id}>{label}</Label>
        {info && (
          <InfoPopover label={`About ${label.toLowerCase()}`}>
            {info}
          </InfoPopover>
        )}
      </div>
      {children}
    </div>
  );
}

function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="grid">
      {title && (
        <GroupHeading asChild className="pt-2">
          <h3>{title}</h3>
        </GroupHeading>
      )}
      <div>
        {Children.toArray(children).map((child, index) => (
          <Fragment key={isValidElement(child) ? child.key : index}>
            {index > 0 && <Separator purpose="row" />}
            {child}
          </Fragment>
        ))}
      </div>
    </section>
  );
}

const SAMPLE = [
  "function greet(name) {",
  "\tconst greeting = `Hello, ${name}! This line runs long enough to show what wrapping does to it.`;",
  "\treturn greeting;",
  "}",
];

/** The editor's own look, so a flip shows its effect where it is made. */
function EditorPreview({ prefs }: { prefs: Preferences }) {
  const indent = prefs.indent === "tab" ? "\t" : " ".repeat(+prefs.indent);
  return (
    <figure className="grid gap-1.5">
      <figcaption className="text-muted-foreground text-ui-sm">
        Preview
      </figcaption>
      <Pane purpose="document" frame="inset">
        <pre
          className={cn(
            "p-3 font-mono leading-[1.6] [tab-size:4]",
            prefs.wrap ? "whitespace-pre-wrap break-words" : "overflow-x-auto",
          )}
          style={{ fontSize: prefs.fontSize }}
        >
          {SAMPLE.map((line, index) => (
            <div key={line} className="flex gap-3">
              {prefs.lineNumbers && (
                <span
                  aria-hidden
                  className="w-4 shrink-0 select-none text-right text-muted-foreground"
                >
                  {index + 1}
                </span>
              )}
              <code>{line.replace("\t", indent)}</code>
            </div>
          ))}
        </pre>
      </Pane>
    </figure>
  );
}

export function EditorSection({ prefs, onChange }: PreferenceProps) {
  return (
    <div className="grid gap-4">
      <Group>
        <SettingRow id="settings-wrap" label="Wrap long lines">
          <Switch
            id="settings-wrap"
            checked={prefs.wrap}
            onCheckedChange={(wrap) => onChange({ wrap })}
          />
        </SettingRow>
        <SettingRow id="settings-line-numbers" label="Show line numbers">
          <Switch
            id="settings-line-numbers"
            checked={prefs.lineNumbers}
            onCheckedChange={(lineNumbers) => onChange({ lineNumbers })}
          />
        </SettingRow>
        <SettingRow
          id="settings-format"
          label="Format on save"
          info="Tidies indentation and trailing spaces each time a file is saved."
        >
          <Switch
            id="settings-format"
            checked={prefs.formatOnSave}
            onCheckedChange={(formatOnSave) => onChange({ formatOnSave })}
          />
        </SettingRow>
        <SettingRow id="settings-font-size" label="Font size">
          <div className="flex items-center gap-2">
            <NumberInput
              id="settings-font-size"
              min={11}
              max={20}
              value={prefs.fontSize}
              onValueChange={(fontSize) => onChange({ fontSize })}
              aria-describedby="settings-font-size-unit"
              className="w-20"
            />
            <span
              id="settings-font-size-unit"
              className="text-muted-foreground text-ui"
            >
              px
            </span>
          </div>
        </SettingRow>
        <SettingRow id="settings-language" label="New files open as">
          <Select
            value={prefs.language}
            onValueChange={(language) => onChange({ language })}
          >
            <SelectTrigger id="settings-language" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
      </Group>
      <Group title="Indent with">
        <RadioGroup
          aria-label="Indent with"
          value={prefs.indent}
          onValueChange={(indent) =>
            onChange({ indent: indent as Preferences["indent"] })
          }
          className="py-3"
        >
          {[
            { value: "2", label: "2 spaces" },
            { value: "4", label: "4 spaces" },
            { value: "tab", label: "Tabs" },
          ].map(({ value, label }) => (
            <div key={value} className="flex items-center gap-2">
              <RadioGroupItem value={value} id={`settings-indent-${value}`} />
              <Label htmlFor={`settings-indent-${value}`}>{label}</Label>
            </div>
          ))}
        </RadioGroup>
      </Group>
      <EditorPreview prefs={prefs} />
    </div>
  );
}

const NOTIFY: { value: string; label: string; info?: string }[] = [
  {
    value: "all",
    label: "All activity",
    info: "Every comment, run and review on what you follow.",
  },
  { value: "mentions", label: "Mentions and assignments" },
  { value: "none", label: "Nothing" },
];

export function NotificationsSection({ prefs, onChange }: PreferenceProps) {
  const off = prefs.notify === "none";
  return (
    <div className="grid gap-4">
      <Group title="Notify me about">
        <RadioGroup
          aria-label="Notify me about"
          value={prefs.notify}
          onValueChange={(notify) =>
            onChange({ notify: notify as Preferences["notify"] })
          }
          className="py-3"
        >
          {NOTIFY.map(({ value, label, info }) => (
            <div key={value} className="flex items-center gap-2">
              <RadioGroupItem value={value} id={`settings-notify-${value}`} />
              <div className="flex items-center gap-1">
                <Label htmlFor={`settings-notify-${value}`}>{label}</Label>
                {info && (
                  <InfoPopover label={`About ${label.toLowerCase()}`}>
                    {info}
                  </InfoPopover>
                )}
              </div>
            </div>
          ))}
        </RadioGroup>
      </Group>
      <Group title="Send them by">
        <Reorder
          items={prefs.channels}
          onMove={(move) =>
            onChange({ channels: moveItem(prefs.channels, move) })
          }
          disabled={off}
        >
          {prefs.channels.map((channel, index) => {
            const id = `settings-${channel}`;
            return (
              <Fragment key={channel}>
                {index > 0 && <Separator purpose="row" />}
                <ReorderItem
                  id={channel}
                  name={CHANNELS[channel]}
                  className="flex items-center gap-2 py-3"
                >
                  <ReorderHandle />
                  <div
                    className="group flex min-w-0 flex-1 items-center"
                    data-disabled={off}
                  >
                    <Label htmlFor={id}>{CHANNELS[channel]}</Label>
                  </div>
                  <ReorderButtons />
                  <Switch
                    id={id}
                    checked={prefs[channel] && !off}
                    disabled={off}
                    onCheckedChange={(on) => onChange({ [channel]: on })}
                  />
                </ReorderItem>
              </Fragment>
            );
          })}
        </Reorder>
      </Group>
      <Group>
        <SettingRow
          id="settings-weekly"
          label="Weekly summary"
          info="A Monday email of what changed last week, sent even when notifications are off."
        >
          <Switch
            id="settings-weekly"
            checked={prefs.weekly}
            onCheckedChange={(weekly) => onChange({ weekly })}
          />
        </SettingRow>
      </Group>
    </div>
  );
}

type Editing = { id: string | undefined; slot: "ui" | "terminal" } | null;

/** The theme rows, which read the site's theme store and so render in the browser only. */
function ThemeRows() {
  const { theme, colorScheme, variant } = useTheme();
  const terminal = useTerminalTheme();
  const [editing, setEditing] = useState<Editing>(null);
  const customize = (id: string | undefined, slot: "ui" | "terminal") =>
    setEditing({ id, slot });
  return (
    <>
      <Group>
        <SettingRow
          id="settings-theme"
          label="Theme"
          info="Shared with the menu in this site's top bar: a pick repaints the whole page."
        >
          <ThemeMenu
            onCustomize={customize}
            trigger={({ Icon, label }) => (
              <Button
                id="settings-theme"
                variant="outline"
                aria-label={`${label}: ${theme.label}`}
                className="max-w-48"
              >
                <Icon />
                <span className="truncate">
                  {theme.label}
                  {variant !== "default" && `, ${variant}`}
                </span>
                <span className="sr-only">, {colorScheme}</span>
              </Button>
            )}
          />
        </SettingRow>
        <SettingRow
          id="settings-terminal-theme"
          label="Terminal theme"
          info="For logs and recordings, such as a pull request's test output."
        >
          <ThemeMenu
            slot="terminal"
            onCustomize={customize}
            trigger={({ Icon, label }) => (
              <Button
                id="settings-terminal-theme"
                variant="outline"
                aria-label={`${label}: ${terminal.following ? "follows the theme" : terminal.theme.label}`}
                className="max-w-48"
              >
                <Icon />
                <span className="truncate">
                  {terminal.following
                    ? "Follows the theme"
                    : terminal.theme.label}
                </span>
              </Button>
            )}
          />
        </SettingRow>
      </Group>
      <Group>
        <SettingRow id="settings-custom-themes" label="Custom themes">
          <Button
            id="settings-custom-themes"
            variant="outline"
            onClick={() => setEditing({ id: undefined, slot: "ui" })}
          >
            <PaletteIcon />
            Edit…
          </Button>
        </SettingRow>
      </Group>
      <ThemeEditor
        open={editing !== null}
        themeId={editing?.id}
        kind={editing?.slot}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />
    </>
  );
}

export function AppearanceSection() {
  return (
    <div className="grid gap-4">
      <ClientOnly
        fallback={<Skeleton className="h-48 w-full" aria-hidden="true" />}
      >
        <ThemeRows />
      </ClientOnly>
    </div>
  );
}

export function ProfileSection({
  saved,
  draft,
  onDraft,
  onSave,
}: {
  saved: Profile;
  draft: Profile;
  onDraft(next: Partial<Profile>): void;
  onSave(profile: Profile): void;
}) {
  const [error, setError] = useState<string>();
  const [avatarError, setAvatarError] = useState<string>();
  const emailRef = useRef<HTMLInputElement>(null);
  const check = (email: string) =>
    /^\S+@\S+\.\S+$/.test(email)
      ? undefined
      : "Enter an email address, like alice@example.com.";
  return (
    <form
      className="grid max-w-md gap-5 py-3"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const problem = check(draft.email);
        setError(problem);
        if (problem) {
          emailRef.current?.focus();
          return;
        }
        onSave(draft);
        toast.success("Profile saved");
      }}
      onReset={(event) => {
        event.preventDefault();
        const lost = draft;
        onDraft(saved);
        setError(undefined);
        setAvatarError(undefined);
        if (sameProfile(lost, saved)) return;
        toast("Changes discarded", {
          action: { label: "Undo", onClick: () => onDraft(lost) },
        });
      }}
    >
      <div className="grid gap-2">
        <div className="flex items-center gap-1">
          <Label id="settings-avatar-label">Avatar</Label>
          <InfoPopover label="About the avatar">
            Choose an image, drop one on this row, or paste one.
          </InfoPopover>
        </div>
        <FileDrop
          aria-labelledby="settings-avatar-label"
          aria-describedby={avatarError ? "settings-avatar-error" : undefined}
          accept="image/png,image/jpeg,image/webp,image/gif"
          onFile={(file) => {
            setAvatarError(undefined);
            // Never revoked: the saved profile, the draft and Discard's Undo
            // may each still hold the address.
            onDraft({ avatar: URL.createObjectURL(file) });
          }}
          onReject={() =>
            setAvatarError("Choose a PNG, JPEG, WebP or GIF image.")
          }
          className="flex items-center gap-3"
        >
          <Avatar size="lg">
            <AvatarImage src={draft.avatar ?? undefined} alt="Your avatar" />
            <AvatarFallback>
              {draft.name.trim().charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <FileDropTrigger>
            <UploadIcon />
            Upload…
          </FileDropTrigger>
          <Button
            type="button"
            variant="outline"
            disabled={draft.avatar === null}
            onClick={() => onDraft({ avatar: null })}
          >
            <Trash2Icon />
            Remove
          </Button>
        </FileDrop>
        {avatarError && (
          <FieldError id="settings-avatar-error">{avatarError}</FieldError>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="settings-name">Display name</Label>
        <Input
          id="settings-name"
          autoComplete="nickname"
          value={draft.name}
          onChange={(event) => onDraft({ name: event.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="settings-email-address">Email</Label>
        <Input
          ref={emailRef}
          id="settings-email-address"
          type="email"
          autoComplete="email"
          value={draft.email}
          onChange={(event) => {
            onDraft({ email: event.target.value });
            // Once marked wrong, a field is checked again as it is corrected.
            if (error) setError(check(event.target.value));
          }}
          aria-invalid={error !== undefined}
          aria-describedby={
            error ? "settings-email-error" : "settings-email-hint"
          }
        />
        {error ? (
          <p id="settings-email-error" className="text-destructive text-ui">
            {error}
          </p>
        ) : (
          <p id="settings-email-hint" className="text-muted-foreground text-ui">
            Notifications go here.
          </p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="settings-time-zone">Time zone</Label>
        <Select
          value={draft.timeZone}
          onValueChange={(timeZone) => onDraft({ timeZone })}
        >
          <SelectTrigger id="settings-time-zone" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_ZONES.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="settings-show-email"
          checked={draft.showEmail}
          onCheckedChange={(checked) =>
            onDraft({ showEmail: checked === true })
          }
        />
        <Label htmlFor="settings-show-email">Show my email on my profile</Label>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="reset" variant="outline">
          Discard changes
        </Button>
        <Button type="submit">Save profile</Button>
      </div>
    </form>
  );
}

export function TokensSection({
  tokens,
  onRevoke,
}: {
  tokens: AccessToken[];
  onRevoke(token: AccessToken): void;
}) {
  const [revoking, setRevoking] = useState<AccessToken>();
  // Kept apart from `revoking` so the dialog keeps its title while it fades out.
  const [open, setOpen] = useState(false);
  return (
    <div className="grid gap-4">
      {tokens.length === 0 ? (
        <p className="py-3 text-muted-foreground text-ui">
          No access tokens. Scripts and bots that need one get it from the
          command line.
        </p>
      ) : (
        <List purpose="collection" asChild>
          <ul>
            {tokens.map((token) => (
              <ListItem key={token.id} asChild>
                <li className="flex items-center gap-3 py-3">
                  <KeyRoundIcon className="size-4 shrink-0 text-muted-foreground" />
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <span className="truncate font-medium font-mono text-ui">
                      {token.name}
                    </span>
                    <span className="text-muted-foreground text-ui-sm">
                      {token.scopes} · {token.lastUsed}
                    </span>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    aria-label={`Revoke ${token.name}`}
                    onClick={() => {
                      setRevoking(token);
                      setOpen(true);
                    }}
                  >
                    Revoke…
                  </Button>
                </li>
              </ListItem>
            ))}
          </ul>
        </List>
      )}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Revoke the token for ${revoking?.name}?`}
        description="Anything that signs in with it stops working at once. A revoked token cannot be restored: you would create a new one and update everything that used the old."
        confirmLabel="Revoke"
        destructive
        onConfirm={() => {
          if (revoking) onRevoke(revoking);
          setOpen(false);
          toast(`Revoked the token for ${revoking?.name}`);
        }}
      />
    </div>
  );
}
