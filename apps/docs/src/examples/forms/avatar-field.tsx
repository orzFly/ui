import { Avatar, AvatarFallback, AvatarImage } from "@orz/ui/components/avatar";
import { Button } from "@orz/ui/components/button";
import { FieldError } from "@orz/ui/components/field";
import { FileDrop, FileDropTrigger } from "@orz/ui/components/file-drop";
import { InfoPopover } from "@orz/ui/components/info-popover";
import { Label } from "@orz/ui/components/label";
import { Trash2Icon, UploadIcon } from "lucide-react";
import { useEffect, useState } from "react";

export function AvatarField() {
  // A preview of the chosen file, read where it lies; nothing is uploaded.
  const [src, setSrc] = useState<string>();
  const [error, setError] = useState<string>();
  // The address holds the file in memory until it is let go.
  useEffect(
    () => () => {
      if (src) URL.revokeObjectURL(src);
    },
    [src],
  );
  return (
    <div className="grid max-w-md gap-2">
      <div className="flex items-center gap-1">
        <Label id="avatar-field-label">Avatar</Label>
        <InfoPopover label="About the avatar">
          Choose an image, drop one on this row, or paste one.
        </InfoPopover>
      </div>
      <FileDrop
        aria-labelledby="avatar-field-label"
        aria-describedby={error ? "avatar-field-error" : undefined}
        accept="image/png,image/jpeg,image/webp"
        onFile={(file) => {
          setError(undefined);
          setSrc(URL.createObjectURL(file));
        }}
        onReject={() => setError("Choose a PNG, JPEG or WebP image.")}
        className="flex items-center gap-3"
      >
        <Avatar size="lg">
          <AvatarImage src={src} alt="Your avatar" />
          <AvatarFallback>AL</AvatarFallback>
        </Avatar>
        <FileDropTrigger>
          <UploadIcon />
          Upload…
        </FileDropTrigger>
        <Button
          variant="outline"
          disabled={!src}
          onClick={() => setSrc(undefined)}
        >
          <Trash2Icon />
          Remove
        </Button>
      </FileDrop>
      {error && <FieldError id="avatar-field-error">{error}</FieldError>}
    </div>
  );
}
