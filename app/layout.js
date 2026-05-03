import './globals.css';

export const metadata = {
  title: 'CAC Tagger',
  description: 'Soccer match event tagging platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 text-gray-100 antialiased">{children}</body>
    </html>
  );
}
