// client/src/contexts/ThemeContext.tsx
//
// Manages gender-based theme switching with per-user preference support
// Applies theme-girl or theme-boy class to document root based on:
// - User's theme_preference (auto|neutral) from profiles table
// - Baby sex from pregnancy_profiles (own or mom's for partners)
//
// NOTE: This context is self-contained and does NOT depend on PartnerContext
// to avoid provider ordering issues. It fetches partner relationship directly.

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export type ThemeVariant = "neutral" | "girl" | "boy";
export type ThemePreference = "auto" | "neutral";

interface ThemeContextValue {
  theme: ThemeVariant;
  themePreference: ThemePreference;
  setTheme: (theme: ThemeVariant) => void;
  setThemePreference: (pref: ThemePreference) => void;
  refetchTheme: () => Promise<void>;
  // Expose the derived baby sex for settings preview logic
  babySexSource: "boy" | "girl" | "unknown" | null;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
}

// Helper to convert baby_sex to theme variant
function sexToTheme(sex: string | null | undefined): ThemeVariant {
  if (sex === "girl") return "girl";
  if (sex === "boy") return "boy";
  return "neutral";
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { user } = useAuth();
  
  // Internal state for partner relationship (fetched directly, not from PartnerContext)
  const [isPartnerView, setIsPartnerView] = useState(false);
  const [momUserId, setMomUserId] = useState<string | null>(null);
  const [partnerDataLoaded, setPartnerDataLoaded] = useState(false);
  
  const [theme, setThemeState] = useState<ThemeVariant>("neutral");
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>("auto");
  const [babySexSource, setBabySexSource] = useState<"boy" | "girl" | "unknown" | null>(null);

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

  // Compute and apply theme based on preference and baby sex
  const applyTheme = useCallback((preference: ThemePreference, babySex: string | null | undefined) => {
    if (preference === "neutral") {
      setThemeState("neutral");
    } else {
      // Auto mode - derive from baby sex
      setThemeState(sexToTheme(babySex));
    }
  }, []);

  // Fetch partner relationship data directly (to avoid PartnerContext dependency)
  useEffect(() => {
    async function fetchPartnerRelationship() {
      if (!user?.id) {
        setIsPartnerView(false);
        setMomUserId(null);
        setPartnerDataLoaded(true);
        return;
      }

      try {
        // Check if user has their own pregnancy profile (they're a mom)
        const { data: ownProfile } = await supabase
          .from("pregnancy_profiles")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (ownProfile) {
          // User is a mom
          setIsPartnerView(false);
          setMomUserId(null);
        } else {
          // Check if user is a partner
          const { data: partnerAccess } = await supabase
            .from("partner_access")
            .select("mom_user_id")
            .eq("partner_user_id", user.id)
            .not("accepted_at", "is", null)
            .is("revoked_at", null)
            .maybeSingle();

          if (partnerAccess) {
            setIsPartnerView(true);
            setMomUserId(partnerAccess.mom_user_id);
          } else {
            setIsPartnerView(false);
            setMomUserId(null);
          }
        }
      } catch (err) {
        console.error("[Theme] Error fetching partner relationship:", err);
        setIsPartnerView(false);
        setMomUserId(null);
      } finally {
        setPartnerDataLoaded(true);
      }
    }

    fetchPartnerRelationship();
  }, [user?.id]);

  // Fetch theme preference and baby sex, then apply
  const fetchThemeData = useCallback(async () => {
    if (!user?.id) {
      setThemeState("neutral");
      setThemePreferenceState("auto");
      setBabySexSource(null);
      return;
    }

    // Wait for partner data to be loaded
    if (!partnerDataLoaded) {
      return;
    }

    try {
      // 1. Fetch current user's theme preference from profiles
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("theme_preference")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("[Theme] Error fetching theme_preference:", profileError);
      }

      const preference: ThemePreference = 
        (profileData?.theme_preference === "neutral" || profileData?.theme_preference === "auto")
          ? profileData.theme_preference
          : "auto";
      
      setThemePreferenceState(preference);

      // 2. Fetch baby_sex from the appropriate source
      // Partner uses mom's pregnancy_profiles, Mom uses own
      const targetUserId = isPartnerView && momUserId ? momUserId : user.id;

      const { data: pregnancyData, error: pregnancyError } = await supabase
        .from("pregnancy_profiles")
        .select("baby_sex")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (pregnancyError) {
        console.error("[Theme] Error fetching baby_sex:", pregnancyError);
      }

      const babySex = pregnancyData?.baby_sex ?? null;
      setBabySexSource(babySex as "boy" | "girl" | "unknown" | null);

      console.log("[Theme] Fetched - preference:", preference, "babySex:", babySex, "isPartner:", isPartnerView);

      // 3. Apply the computed theme
      applyTheme(preference, babySex);

    } catch (err) {
      console.error("[Theme] Error:", err);
      setThemeState("neutral");
    }
  }, [user?.id, isPartnerView, momUserId, partnerDataLoaded, applyTheme]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    if (!user?.id || !partnerDataLoaded) {
      if (!user?.id) {
        setThemeState("neutral");
        setThemePreferenceState("auto");
        setBabySexSource(null);
      }
      return;
    }

    fetchThemeData();

    // Subscribe to changes in profiles (theme_preference) for current user
    const profilesChannel = supabase
      .channel("theme-profiles-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload: { new?: { theme_preference?: string } }) => {
          const newPref = payload.new?.theme_preference;
          console.log("[Theme] Realtime profiles update, theme_preference:", newPref);
          if (newPref === "auto" || newPref === "neutral") {
            setThemePreferenceState(newPref);
            // Re-apply theme with current baby sex
            applyTheme(newPref, babySexSource);
          }
        }
      )
      .subscribe((status: string) => {
        console.log("[Theme] Profiles subscription status:", status);
      });

    // Subscribe to changes in pregnancy_profiles (baby_sex) for the relevant user
    const targetUserId = isPartnerView && momUserId ? momUserId : user.id;
    
    const pregnancyChannel = supabase
      .channel("theme-pregnancy-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pregnancy_profiles",
          filter: `user_id=eq.${targetUserId}`,
        },
        (payload: { new?: { baby_sex?: string } }) => {
          const newSex = payload.new?.baby_sex;
          console.log("[Theme] Realtime pregnancy update, baby_sex:", newSex);
          setBabySexSource(newSex as "boy" | "girl" | "unknown" | null);
          // Re-apply theme with current preference
          applyTheme(themePreference, newSex);
        }
      )
      .subscribe((status: string) => {
        console.log("[Theme] Pregnancy subscription status:", status);
      });

    return () => {
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(pregnancyChannel);
    };
  }, [user?.id, isPartnerView, momUserId, partnerDataLoaded, fetchThemeData, applyTheme, babySexSource, themePreference]);

  // Manual setTheme for draft preview (bypasses preference logic)
  const setTheme = useCallback((newTheme: ThemeVariant) => {
    console.log("[Theme] Manual setTheme called:", newTheme);
    setThemeState(newTheme);
  }, []);

  // Manual setThemePreference for draft preview
  const setThemePreference = useCallback((newPref: ThemePreference) => {
    console.log("[Theme] Manual setThemePreference called:", newPref);
    setThemePreferenceState(newPref);
    // Immediately apply the theme based on new preference
    if (newPref === "neutral") {
      setThemeState("neutral");
    } else {
      // Auto - derive from current baby sex source
      setThemeState(sexToTheme(babySexSource));
    }
  }, [babySexSource]);

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      themePreference,
      setTheme, 
      setThemePreference,
      refetchTheme: fetchThemeData,
      babySexSource,
    }}>
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