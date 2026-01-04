// client/src/components/breathing-moment.tsx

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";

type SessionState = "idle" | "transitioning" | "countdown" | "breathing" | "ending";

interface BreathingMomentProps {
  mood?: "happy" | "neutral" | "sad" | null;
  duration?: 15 | 30;
}

// Easing functions
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutQuad = (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export function BreathingMoment({ mood, duration = 30 }: BreathingMomentProps) {
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [phase, setPhase] = useState<"inhale" | "exhale">("inhale");
  const [countdown, setCountdown] = useState(3);
  const [timeRemaining, setTimeRemaining] = useState(duration);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  
  // Continuous animation parameters (these smoothly interpolate)
  const waveIntensityRef = useRef(1); // 1 = full waves, 0 = flat line
  const expansionRef = useRef(1); // 1 = full width, 0 = contracted to center
  const targetWaveIntensityRef = useRef(1);
  const targetExpansionRef = useRef(1);
  
  // Timing refs
  const breathingStartRef = useRef(0);
  const stateStartRef = useRef(0);

  const getPrimaryColor = useCallback(() => {
    if (typeof window === "undefined") return "rgba(90, 143, 123, 1)";
    const style = getComputedStyle(document.documentElement);
    const hsl = style.getPropertyValue("--primary").trim();
    return hsl ? `hsl(${hsl})` : "rgba(90, 143, 123, 1)";
  }, []);

  // Wave configuration
  const waves = [
    { baseOpacity: 0.7, amplitude: 8, frequency: 0.02, speed: 1, phaseOffset: 0 },
    { baseOpacity: 0.5, amplitude: 10, frequency: 0.025, speed: 1.2, phaseOffset: 0.5 },
    { baseOpacity: 0.6, amplitude: 6, frequency: 0.018, speed: 0.8, phaseOffset: 1 },
    { baseOpacity: 0.4, amplitude: 12, frequency: 0.022, speed: 1.1, phaseOffset: 1.5 },
    { baseOpacity: 0.5, amplitude: 7, frequency: 0.028, speed: 0.9, phaseOffset: 2 },
    { baseOpacity: 0.35, amplitude: 9, frequency: 0.02, speed: 1.3, phaseOffset: 2.5 },
    { baseOpacity: 0.45, amplitude: 5, frequency: 0.024, speed: 1, phaseOffset: 3 },
  ];

  // Unified drawing function - always draws flowing waves, just with variable intensity
  const draw = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      time: number,
      waveIntensity: number,
      expansion: number
    ) => {
      ctx.clearRect(0, 0, width, height);

      const centerY = height / 2;
      const centerX = width / 2;
      const baseColor = getPrimaryColor();

      // Calculate the visible width based on expansion
      const minHalfWidth = 30;
      const maxHalfWidth = (width / 2) - 10;
      const currentHalfWidth = minHalfWidth + (maxHalfWidth - minHalfWidth) * expansion;

      waves.forEach((wave) => {
        ctx.beginPath();
        ctx.strokeStyle = baseColor;
        
        // Opacity increases slightly as waves flatten (line becomes more solid)
        const flatnessBonus = (1 - waveIntensity) * 0.2;
        ctx.globalAlpha = Math.min(wave.baseOpacity + flatnessBonus, 0.9);
        
        // Line gets slightly thicker as it flattens
        ctx.lineWidth = 1.5 + (1 - waveIntensity) * 0.5;
        ctx.lineCap = "round";

        // Draw from left edge to right edge of current expansion
        const startX = centerX - currentHalfWidth;
        const endX = centerX + currentHalfWidth;

        for (let px = 0; px <= currentHalfWidth * 2; px++) {
          const x = startX + px;
          
          // Normalize x position for wave calculation (0 to 1 across visible width)
          const normalizedX = px / (currentHalfWidth * 2);
          
          // Use normalized position for smooth wave across any width
          const waveX = normalizedX * width;
          
          // Calculate wave Y with dampened amplitude
          const dampedAmplitude = wave.amplitude * waveIntensity;
          const waveY =
            Math.sin(waveX * wave.frequency + time * wave.speed + wave.phaseOffset) * dampedAmplitude +
            Math.sin(waveX * wave.frequency * 0.5 + time * wave.speed * 0.7 + wave.phaseOffset * 2) * (dampedAmplitude * 0.5);

          const y = centerY + waveY;

          if (px === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.stroke();
      });

      ctx.globalAlpha = 1;
    },
    [getPrimaryColor]
  );

  // Countdown timer
  useEffect(() => {
    if (sessionState !== "countdown") return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setSessionState("breathing");
          breathingStartRef.current = performance.now();
          stateStartRef.current = performance.now();
          return 3;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionState]);

  // Session timer
  useEffect(() => {
    if (sessionState !== "breathing") return;

    setTimeRemaining(duration);
    
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          stateStartRef.current = performance.now();
          setSessionState("ending");
          return duration;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionState, duration]);

  // Main animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const transitionDuration = 1200; // Slower, smoother transition
    const breathDuration = 4000;
    const lerpSpeed = 0.08; // How fast parameters interpolate (lower = smoother)

    const animate = (timestamp: number) => {
      const time = timestamp * 0.001; // Convert to seconds for wave motion

      // Determine target values based on state
      switch (sessionState) {
        case "idle": {
          targetWaveIntensityRef.current = 1;
          targetExpansionRef.current = 1;
          break;
        }

        case "transitioning": {
          const elapsed = timestamp - stateStartRef.current;
          const progress = Math.min(elapsed / transitionDuration, 1);
          const easedProgress = easeOutCubic(progress);
          
          // Smoothly reduce wave intensity and contract
          targetWaveIntensityRef.current = 1 - easedProgress;
          targetExpansionRef.current = 1 - (easedProgress * 0.7); // Contract to 30%

          if (progress >= 1) {
            setSessionState("countdown");
            stateStartRef.current = timestamp;
          }
          break;
        }

        case "countdown": {
          // Hold at flat, contracted state
          targetWaveIntensityRef.current = 0;
          targetExpansionRef.current = 0.3;
          break;
        }

        case "breathing": {
          const breathElapsed = timestamp - breathingStartRef.current;
          const cycleTime = breathElapsed % (breathDuration * 2);
          const isInhaling = cycleTime < breathDuration;
          const phaseTime = isInhaling ? cycleTime : cycleTime - breathDuration;
          
          let breathProgress = easeInOutQuad(phaseTime / breathDuration);
          if (!isInhaling) breathProgress = 1 - breathProgress;

          setPhase(isInhaling ? "inhale" : "exhale");
          
          // Wave stays flat, expansion follows breath
          targetWaveIntensityRef.current = 0;
          targetExpansionRef.current = breathProgress;
          break;
        }

        case "ending": {
          const elapsed = timestamp - stateStartRef.current;
          const progress = Math.min(elapsed / transitionDuration, 1);
          const easedProgress = easeOutCubic(progress);
          
          // Smoothly restore wave intensity and expand
          targetWaveIntensityRef.current = easedProgress;
          targetExpansionRef.current = 0.3 + (easedProgress * 0.7); // Expand back to 100%

          if (progress >= 1) {
            setSessionState("idle");
          }
          break;
        }
      }

      // Smoothly interpolate current values toward targets (lerp)
      waveIntensityRef.current += (targetWaveIntensityRef.current - waveIntensityRef.current) * lerpSpeed;
      expansionRef.current += (targetExpansionRef.current - expansionRef.current) * lerpSpeed;

      // Draw with current interpolated values
      draw(ctx, rect.width, rect.height, time, waveIntensityRef.current, expansionRef.current);

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [sessionState, draw]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function startSession() {
    stateStartRef.current = performance.now();
    setSessionState("transitioning");
    setCountdown(3);
  }

  function stopSession() {
    // Trigger ending transition instead of abrupt stop
    stateStartRef.current = performance.now();
    setSessionState("ending");
    setTimeRemaining(duration);
  }

  const isActive = sessionState !== "idle";
  const showButton = sessionState === "idle" || sessionState === "breathing" || sessionState === "countdown";

  return (
    <div className="flex flex-col items-center py-6">
      {/* Canvas container */}
      <div className="relative w-64 h-12 mb-3">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ display: "block" }}
        />
      </div>

      {/* Status text */}
      <div className="h-8 flex items-center justify-center mb-3">
        {sessionState === "countdown" && (
          <p className="text-2xl font-light text-muted-foreground animate-pulse">
            {countdown}
          </p>
        )}
        
        {sessionState === "breathing" && (
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm font-medium text-muted-foreground transition-opacity duration-300">
              {phase === "inhale" ? "Inhale" : "Exhale"}
            </p>
            <p className="text-xs text-muted-foreground/60">
              {timeRemaining}s
            </p>
          </div>
        )}

        {sessionState === "ending" && (
          <p className="text-sm font-medium text-muted-foreground/70">
            Well done
          </p>
        )}
      </div>

      {/* CTA Button */}
      {showButton && (
        <Button
          variant="outline"
          size="sm"
          onClick={isActive ? stopSession : startSession}
          className="text-muted-foreground hover:text-foreground border-muted-foreground/30 hover:border-muted-foreground/50 bg-transparent"
        >
          {isActive ? "I'm done" : "Would you like to take a breath?"}
        </Button>
      )}
    </div>
  );
}