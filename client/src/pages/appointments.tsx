// client/src/pages/appointments.tsx

import { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { usePregnancyState } from "@/hooks/usePregnancyState";
import { usePartnerAccess } from "@/contexts/PartnerContext";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Calendar as CalendarIcon,
  CalendarPlus,
  MapPin,
  Clock,
  Trash2,
  Plus,
  Eye,
  MoreVertical,
} from "lucide-react";
import { addToCalendar } from "@/lib/calendarExport";

type Appointment = {
  id: string;
  title: string;
  starts_at: string;
  location: string | null;
  notes: string | null;
};

export default function AppointmentsPage() {
  const { user } = useAuth();
  const { dueDate, setDueDate } = usePregnancyState();
  const { isPartnerView, momName } = usePartnerAccess();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!user) {
        setAppointments([]);
        setErrorMsg(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMsg(null);

      // For partners, the RLS policy will return appointments they have access to
      const { data, error } = await supabase
        .from("pregnancy_appointments")
        .select("id, title, starts_at, location, notes")
        .order("starts_at", { ascending: true });

      setLoading(false);

      if (error) {
        console.error(error);
        setErrorMsg("Couldn't load appointments. Please try again.");
        return;
      }

      setAppointments((data || []) as Appointment[]);
    }

    load();
  }, [user]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!user || isPartnerView) return;

    if (!title.trim() || !startsAt) {
      setErrorMsg("Please add a title and date/time.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    const { error } = await supabase
      .from("pregnancy_appointments")
      .insert([
        {
          user_id: user.id,
          title: title.trim(),
          starts_at: new Date(startsAt).toISOString(),
          location: location.trim() || null,
          notes: notes.trim() || null,
        },
      ])
      .select("id, title, starts_at, location, notes");

    setSaving(false);

    if (error) {
      console.error(error);
      setErrorMsg("Couldn't save your appointment. Please try again.");
      return;
    }

    // Reload list
    const { data: refreshed, error: refreshError } = await supabase
      .from("pregnancy_appointments")
      .select("id, title, starts_at, location, notes")
      .order("starts_at", { ascending: true });

    if (refreshError) {
      console.error(refreshError);
      setErrorMsg("Saved, but couldn't refresh the list.");
      return;
    }

    setAppointments((refreshed || []) as Appointment[]);
    setTitle("");
    setStartsAt("");
    setLocation("");
    setNotes("");
  }

  async function handleDelete(id: string) {
    if (!user || isPartnerView) return;
    if (!window.confirm("Remove this appointment?")) return;

    const { error } = await supabase
      .from("pregnancy_appointments")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error(error);
      setErrorMsg("Couldn't delete that appointment.");
      return;
    }

    setAppointments((prev) => prev.filter((a) => a.id !== id));
  }

  const upcoming = appointments.filter(
    (a) => new Date(a.starts_at).getTime() >= Date.now(),
  );
  const past = appointments.filter(
    (a) => new Date(a.starts_at).getTime() < Date.now(),
  );

  return (
    <Layout dueDate={dueDate} setDueDate={setDueDate}>
      <div className="max-w-3xl mx-auto space-y-8 pb-10">
        <header className="space-y-2">
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-3xl font-bold tracking-tight">
              Appointments
            </h1>
            {isPartnerView && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground">
                <Eye className="w-3 h-3" />
                View only
              </span>
            )}
          </div>
          <p className="text-muted-foreground">
            {isPartnerView 
              ? `View ${momName ? `${momName}'s` : "upcoming"} prenatal visits and important dates.`
              : "Keep track of your prenatal visits and important check-ins."
            }
          </p>
        </header>

        {/* Add form - hidden for partners */}
        {!isPartnerView && (
          <section className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="bg-muted/30 px-6 py-4 border-b border-border flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              <div>
                <h2 className="text-lg font-semibold">Add appointment</h2>
                <p className="text-sm text-muted-foreground">
                  Add upcoming dates and notes for your visits.
                </p>
              </div>
            </div>

            <form onSubmit={handleAdd} className="p-6 grid gap-4">
              {errorMsg && (
                <div className="text-sm text-destructive">{errorMsg}</div>
              )}

              <div className="grid gap-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Ultrasound"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Date & time</label>
                <Input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Location (optional)
                </label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Clinic / hospital"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Notes (optional)</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Questions to ask, what to bring, etc."
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={isSaving}>
                  <Plus className="mr-2 h-4 w-4" />
                  {isSaving ? "Saving..." : "Add"}
                </Button>
              </div>
            </form>
          </section>
        )}

        {/* Upcoming appointments */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Upcoming
          </h2>

          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : upcoming.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No upcoming appointments.
            </div>
          ) : (
            <div className="grid gap-3">
              {upcoming.map((a) => (
                <div
                  key={a.id}
                  className={cn(
                    "bg-card border border-border rounded-xl p-4 flex items-start justify-between gap-4",
                  )}
                >
                  <div className="space-y-1 flex-1">
                    <div className="font-medium">{a.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(a.starts_at), "PPP 'at' p")}
                    </div>
                    {a.location && (
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {a.location}
                      </div>
                    )}
                    {/* Notes hidden for partners (may contain private medical info) */}
                    {!isPartnerView && a.notes && (
                      <div className="text-sm text-muted-foreground">
                        {a.notes}
                      </div>
                    )}
                  </div>

                  {/* Options menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Appointment options"
                      >
                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => addToCalendar({
                          id: a.id,
                          title: a.title,
                          starts_at: a.starts_at,
                          location: a.location,
                        })}
                      >
                        <CalendarPlus className="mr-2 h-4 w-4" />
                        Add to Calendar
                      </DropdownMenuItem>
                      {!isPartnerView && (
                        <DropdownMenuItem
                          onClick={() => handleDelete(a.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Past appointments */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Past</h2>

          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : past.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No past appointments.
            </div>
          ) : (
            <div className="grid gap-3">
              {past.map((a) => (
                <div
                  key={a.id}
                  className="bg-card border border-border rounded-xl p-4 flex items-start justify-between gap-4 opacity-70"
                >
                  <div className="space-y-1 flex-1">
                    <div className="font-medium">{a.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(a.starts_at), "PPP 'at' p")}
                    </div>
                    {a.location && (
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {a.location}
                      </div>
                    )}
                    {/* Notes hidden for partners */}
                    {!isPartnerView && a.notes && (
                      <div className="text-sm text-muted-foreground">
                        {a.notes}
                      </div>
                    )}
                  </div>

                  {/* Options menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Appointment options"
                      >
                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => addToCalendar({
                          id: a.id,
                          title: a.title,
                          starts_at: a.starts_at,
                          location: a.location,
                        })}
                      >
                        <CalendarPlus className="mr-2 h-4 w-4" />
                        Add to Calendar
                      </DropdownMenuItem>
                      {!isPartnerView && (
                        <DropdownMenuItem
                          onClick={() => handleDelete(a.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}