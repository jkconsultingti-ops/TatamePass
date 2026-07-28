import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: {
      ...minimal2023Preset.maskable,
      resizeOptions: { fit: 'contain', background: '#14171f' },
    },
    apple: {
      ...minimal2023Preset.apple,
      resizeOptions: { fit: 'contain', background: '#14171f' },
    },
  },
  images: ['public/pwa-icon-source.svg'],
})
