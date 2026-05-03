import './globals.css';

export const metadata = {
  title: 'CAC TAGGER',
  description: 'Soccer match event tagging platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-[#F9FAFB] text-black antialiased">{children}</body>
    </html>
  );
}
