import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  			sans: ['var(--font-geist-sans)', '-apple-system', 'sans-serif'],
  			mono: ['var(--font-geist-mono)', 'Fira Code', 'monospace'],
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			brand: {
  				50: '#E9F3ED',
  				100: '#D3E7DC',
  				200: '#A7CFBA',
  				300: '#7BB698',
  				400: '#4F9D77',
  				500: '#2D7A5D',
  				600: '#215C49',
  				700: '#1A4A3B',
  				800: '#133829',
  				900: '#0C261B',
  			},
  			success: { DEFAULT: '#10B981', bg: '#ECFDF5' },
  			warning: { DEFAULT: '#F59E0B', bg: '#FFFBEB' },
  			danger: { DEFAULT: '#EF4444', bg: '#FEF2F2' },
  			info: { DEFAULT: '#3B82F6', bg: '#EFF6FF' },
  		},
  		fontSize: {
  			'e8.5': 'calc(8.5px / .875)',
  			'e9': 'calc(9px / .875)',
  			'e9.5': 'calc(9.5px / .875)',
  			'e10': 'calc(10px / .875)',
  			'e10.5': 'calc(10.5px / .875)',
  			'e11': 'calc(11px / .875)',
  			'e11.5': 'calc(11.5px / .875)',
  			'e12': 'calc(12px / .875)',
  			'e12.5': 'calc(12.5px / .875)',
  			'e13': 'calc(13px / .875)',
  			'e13.5': 'calc(13.5px / .875)',
  			'e15': 'calc(15px / .875)',
  			'e16': 'calc(16px / .875)',
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			'fade-in': {
  				'0%': { opacity: '0', transform: 'translateY(4px)' },
  				'100%': { opacity: '1', transform: 'translateY(0)' },
  			},
  			'slide-right': {
  				'0%': { transform: 'translateX(100%)' },
  				'100%': { transform: 'translateX(0)' },
  			},
  			rise: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
  			fade: { from: { opacity: '0' }, to: { opacity: '1' } },
  			'pulse-dot': { '0%, 100%': { boxShadow: '0 0 0 0 rgba(77,124,15,.4)' }, '50%': { boxShadow: '0 0 0 5px rgba(77,124,15,0)' } },
  		},
  		animation: {
  			'fade-in': 'fade-in 200ms ease-out',
  			'slide-right': 'slide-right 250ms ease-out',
  			rise: 'rise .5s cubic-bezier(.22,1,.36,1) both',
  			fade: 'fade .4s ease both',
  			'pulse-dot': 'pulse-dot 2s ease-in-out infinite',
  		},
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
