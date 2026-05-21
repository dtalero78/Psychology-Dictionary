/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Academic Intelligence — see docs/PRD.md §design system
        navy: {
          DEFAULT: '#1a2b48',
          deep: '#031632',
          light: '#374765',
          fixed: '#d7e2ff',
          'fixed-dim': '#b6c7eb',
        },
        purple: {
          DEFAULT: '#6f518e',
          container: '#dcb8fd',
          on: '#634581',
          fixed: '#f0dbff',
        },
        gold: {
          DEFAULT: '#cca730',
          deep: '#735c00',
          on: '#4f3d00',
          fixed: '#ffe088',
        },
        teal: {
          DEFAULT: '#0d7866',
          deep: '#075a4c',
        },
        surface: {
          DEFAULT: '#f8f9fa',
          dim: '#d9dadb',
          lowest: '#ffffff',
          low: '#f3f4f5',
          container: '#edeeef',
          high: '#e7e8e9',
          highest: '#e1e3e4',
        },
        ink: {
          DEFAULT: '#191c1d',
          muted: '#44474d',
          subtle: '#75777e',
          inverse: '#f0f1f2',
        },
        outline: {
          DEFAULT: '#75777e',
          soft: '#c5c6ce',
        },
        danger: {
          DEFAULT: '#ba1a1a',
          container: '#ffdad6',
          on: '#93000a',
        },
      },
      fontFamily: {
        serif: ['SourceSerif4_600SemiBold', 'serif'],
        'serif-bold': ['SourceSerif4_700Bold', 'serif'],
        sans: ['Inter_400Regular', 'sans-serif'],
        'sans-medium': ['Inter_500Medium', 'sans-serif'],
        'sans-semibold': ['Inter_600SemiBold', 'sans-serif'],
      },
      fontSize: {
        // Academic Intelligence type scale
        'display-lg': ['34px', { lineHeight: '42px', letterSpacing: '-0.02em' }],
        'headline-lg': ['28px', { lineHeight: '34px' }],
        'headline-md': ['20px', { lineHeight: '28px' }],
        'body-lg': ['17px', { lineHeight: '26px' }],
        'body-md': ['15px', { lineHeight: '22px' }],
        'label-caps': ['12px', { lineHeight: '16px', letterSpacing: '0.05em' }],
        'label-sm': ['13px', { lineHeight: '18px' }],
      },
      borderRadius: {
        DEFAULT: '8px',
        sm: '4px',
        md: '12px',
        lg: '16px',
        xl: '24px',
      },
    },
  },
  plugins: [],
};
