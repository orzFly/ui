import { Button } from "@orz/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@orz/ui/components/card";
import { Checkbox } from "@orz/ui/components/checkbox";
import { Input } from "@orz/ui/components/input";
import { Label } from "@orz/ui/components/label";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@orz/ui/components/segmented-control";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@orz/ui/components/tabs";
import { useStyle } from "@orz/ui/theme";
import { FilterIcon } from "lucide-react";

export function StyleSwitch() {
  const { committed, styles, setStyle } = useStyle();
  return (
    <div className="grid gap-4">
      <SegmentedControl
        aria-label="Style"
        value={committed}
        onValueChange={setStyle}
        className="justify-self-start"
      >
        {styles.map(({ id, label }) => (
          <SegmentedControlItem key={id} value={id}>
            {label}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
      <Card className="max-w-md">
        <CardHeader icon={<FilterIcon />}>
          <CardTitle>New filter</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Tabs defaultValue="match">
            <TabsList>
              <TabsTrigger value="match">Match</TabsTrigger>
              <TabsTrigger value="action">Action</TabsTrigger>
            </TabsList>
            <TabsContent value="match" className="grid gap-2">
              <Label htmlFor="style-switch-from">From</Label>
              <Input id="style-switch-from" defaultValue="bot-one" />
            </TabsContent>
            <TabsContent value="action" className="flex items-center gap-2">
              <Checkbox id="style-switch-archive" defaultChecked />
              <Label htmlFor="style-switch-archive">Skip the Inbox</Label>
            </TabsContent>
          </Tabs>
          <div className="flex justify-end gap-2">
            <Button variant="outline">Cancel</Button>
            <Button>Create filter</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
