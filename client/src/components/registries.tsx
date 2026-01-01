// client/src/components/registries.tsx

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, ExternalLink, Trash2, Gift } from "lucide-react";
import {
  getRegistries,
  addRegistry,
  deleteRegistry,
  isValidUrl,
  getDomainFromUrl,
  type Registry,
} from "@/lib/registryStorage";

export function Registries() {
  const [registries, setRegistries] = useState<Registry[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRegistries(getRegistries());
  }, []);

  function handleAdd() {
    setError(null);

    if (!name.trim()) {
      setError("Please enter a name for your registry.");
      return;
    }

    if (!url.trim()) {
      setError("Please enter a URL.");
      return;
    }

    if (!isValidUrl(url)) {
      setError("URL must start with http:// or https://");
      return;
    }

    addRegistry(name, url);
    setRegistries(getRegistries());
    setName("");
    setUrl("");
    setIsAddOpen(false);
  }

  function handleDelete() {
    if (deleteId) {
      deleteRegistry(deleteId);
      setRegistries(getRegistries());
      setDeleteId(null);
    }
  }

  function openLink(registryUrl: string) {
    window.open(registryUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="bg-card rounded-3xl border border-border shadow-sm px-6 py-6 md:px-10 md:py-8">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Gift className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-serif text-xl md:text-2xl font-semibold">
              Registries
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Keep your baby registries in one place.
            </p>
          </div>
        </div>

        <Sheet open={isAddOpen} onOpenChange={setIsAddOpen}>
          <SheetTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5">
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader className="text-left pb-4">
              <SheetTitle>Add Registry</SheetTitle>
            </SheetHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Registry Name</label>
                <Input
                  placeholder="e.g., Amazon, Target, Babylist"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">URL</label>
                <Input
                  placeholder="https://..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  type="url"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button onClick={handleAdd} className="w-full">
                Add Registry
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {registries.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <p className="text-sm">No registries added yet.</p>
          <p className="text-xs mt-1">Tap "Add" to save your first registry link.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {registries.map((registry) => (
            <div
              key={registry.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/50 group"
            >
              <button
                type="button"
                onClick={() => openLink(registry.url)}
                className="flex-1 flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
              >
                <div className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center shrink-0">
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{registry.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {getDomainFromUrl(registry.url)}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDeleteId(registry.id)}
                className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                title="Delete registry"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Registry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the registry link from your list. You can always add it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
