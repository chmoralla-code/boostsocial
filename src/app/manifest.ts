import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CYNETWORK Admin Dashboard',
    short_name: 'CYNETWORK Admin',
    description: 'Premium standalone admin control panel for CYNETWORK.',
    start_url: '/admin',
    display: 'standalone',
    background_color: '#121212',
    theme_color: '#1DB954',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
