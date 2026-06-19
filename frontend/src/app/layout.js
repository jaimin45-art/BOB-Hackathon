import './globals.css';

export const metadata = {
  title: 'BoB Identity Trust Platform | Bank of Baroda',
  description: 'Continuous Trust. Frictionless Banking. — Privacy-first identity trust framework for Bank of Baroda.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
