import Head from 'next/head';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>GMB Audit Tool — Internal</title>
        <meta name="description" content="Internal Google My Business audit tool" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
