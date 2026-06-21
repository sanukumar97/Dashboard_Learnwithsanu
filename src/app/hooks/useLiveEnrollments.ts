import { useEffect, useState } from "react";
import { fetchEnrollmentsAdmin } from "../../services/enrollmentService";
import { supabase } from "../../lib/supabase";
import { toStudent, type Student } from "../data/liveDashboard";

export function useLiveEnrollments() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      const rows = await fetchEnrollmentsAdmin();
      setStudents(rows.map(toStudent));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load enrollments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    load().catch(() => {
      // handled in load
    });

    const channel = supabase
      .channel("dashboard-enrollments")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "enrollments" },
        () => {
          load().catch(() => {
            // handled in load
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return {
    students,
    loading,
    error,
    refresh: load,
    setStudents,
  };
}
