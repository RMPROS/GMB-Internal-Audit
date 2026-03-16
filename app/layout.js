export const metadata = {
  title: 'GMB Audit Tool — Internal',
  description: 'Internal Google My Business audit tool',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, fontFamily: 'sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
