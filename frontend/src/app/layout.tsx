import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GarmentCode 3D Visualizer',
  description:
    'Interactive 3D sewing pattern viewer powered by the GarmentCode parametric pattern generation engine.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
