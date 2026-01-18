// client/src/contexts/ThemeContext.tsx
//
// Manages gender-based theme switching
// Applies theme-girl or theme-boy class to document root based on pregnancy profile

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

type ThemeVariant = "neutral" | "girl" | "boy";

interface ThemeContextValue {
  theme: ThemeVariant;
  setTheme: (theme: ThemeVariant) => void;
  refetchTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<ThemeVariant>("neutral");

  // Apply theme class to document root
  useEffect(() => {
    const root = document.documentElement;
    
    // Remove existing theme classes
    root.classList.remove("theme-girl", "theme-boy");
    
    // Add new theme class if not neutral
    if (theme === "girl") {
      root.classList.add("theme-girl");
    } else if (theme === "boy") {
      root.classList.add("theme-boy");
    }
    
    console.log("[Theme] Applied theme:", theme, "Classes:", root.classList.toString());
  }, [theme]);

  // Function to fetch and set theme from database
  const fetchBabySex = useCallback(async () => {
    if (!user?.id) {
      setThemeState("neutral");
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from("pregnancy_profiles")
        .select("baby_sex")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("[Theme] Error fetching baby_sex:", error);
        return;
      }

      console.log("[Theme] Fetched baby_sex from DB:", data?.baby_sex);

      if (data?.baby_sex === "girl") {
        setThemeState("girl");
      } else if (data?.baby_sex === "boy") {
        setThemeState("boy");
      } else {
        setThemeState("neutral");
      }
    } catch (err) {
      console.error("[Theme] Error:", err);
    }
  }, [user?.id]);

  // Fetch on mount and user change
  useEffect(() => {
    if (!user?.id) {
      setThemeState("neutral");
      return;
    }

    fetchBabySex();

    // Subscribe to changes in pregnancy_profiles
    const channel = supabase
      .channel("theme-baby-sex-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pregnancy_profiles",
          filter: `user_id=eq.${user.id}`,
        },
        (payload: { new?: { baby_sex?: string } }) => {
          const newSex = payload.new?.baby_sex;
          console.log("[Theme] Realtime update received, baby_sex:", newSex);
          if (newSex === "girl") {
            setThemeState("girl");
          } else if (newSex === "boy") {
            setThemeState("boy");
          } else {
            setThemeState("neutral");
          }
        }
      )
      .subscribe((status: string) => {
        console.log("[Theme] Realtime subscription status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchBabySex]);

  const setTheme = (newTheme: ThemeVariant) => {
    console.log("[Theme] Manual setTheme called:", newTheme);
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, refetchTheme: fetchBabySex }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Export with distinct name to avoid conflicts with light/dark theme hook
export function useGenderTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  
  if (!context) {
    throw new Error("useGenderTheme must be used within a ThemeProvider");
  }
  
  return context;
}

// Keep old name for backward compatibility
export const useTheme = useGenderTheme;