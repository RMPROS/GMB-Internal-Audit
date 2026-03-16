import { Manrope } from 'next/font/google';

const manrope = Manrope({ subsets: ['latin'], weight: ['400','500','600','700','800'] });

export const metadata = {
  title: 'GMB Audit Tool — Internal',
  description: 'Internal Google My Business audit tool for Rental Marketing Pros',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={manrope.className} style={{ margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  );
}
