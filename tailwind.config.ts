import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        popover: "hsl(var(--popover))",
        "popover-foreground": "hsl(var(--popover-foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        secondary: "hsl(var(--secondary))",
        "secondary-foreground": "hsl(var(--secondary-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        accent: "hsl(var(--accent))",
        "accent-foreground": "hsl(var(--accent-foreground))",
        destructive: "hsl(var(--destructive))",
        "destructive-foreground": "hsl(var(--destructive-foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        virio: {
          offwhite: "var(--virio-offwhite)",
          white: "var(--virio-white)",
          black: "var(--virio-black)",
          yellow: "var(--virio-yellow)",
          red: "var(--virio-red)",
          blue: "var(--virio-blue)",
          darkgreen: "var(--virio-darkgreen)",
          vividgreen: "var(--virio-vividgreen)",
          lightgray: "var(--virio-lightgray)"
        }
      },
      borderRadius: {
        xl: "1rem",
        lg: "0.875rem",
        md: "0.625rem",
        sm: "0.375rem"
      },
      boxShadow: {
        glass:
          "0 0 0 1px rgba(255,255,255,0.08), 0 24px 64px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.2)",
        hover:
          "0 0 0 1px rgba(220,178,104,0.35), 0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.28)"
      },
      transitionTimingFunction: {
        virio: "cubic-bezier(0.785, 0.135, 0.15, 0.86)",
        reveal: "cubic-bezier(0.5, 0, 0, 1)",
        float: "cubic-bezier(0.215, 0.61, 0.355, 1)"
      },
      keyframes: {
        revealUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        pulseGlow: {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "0.9" }
        }
      },
      animation: {
        revealUp: "revealUp 0.8s cubic-bezier(0.5, 0, 0, 1) forwards",
        pulseGlow: "pulseGlow 4s ease-in-out infinite"
      },
      fontFamily: {
        sans: ["Haffer", "Inter", "Arial", "sans-serif"],
        mono: ["Haffer Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"]
      }
    }
  },
  plugins: []
};

export default config;
