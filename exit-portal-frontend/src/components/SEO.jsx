import React from 'react';
import { Helmet } from 'react-helmet-async';

const defaultDescription = 'KL University Exit Portal for administrators and students. Upload results, manage categories and courses, and view analytics and progress toward exit requirements.';
const defaultImage = '/kllogo.svg';
const siteName = 'KL University Exit Portal';

export default function SEO({
  title = siteName,
  description = defaultDescription,
  image = defaultImage,
  canonicalPath = '',
  robots = 'index, follow',
  titleTemplate,
}) {
  const origin = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : '';
  const path = canonicalPath || (typeof window !== 'undefined' ? window.location.pathname : '/');
  const canonicalUrl = origin ? `${origin}${path}` : path;
  const fullTitle = titleTemplate ? titleTemplate.replace('%s', title) : (title && title !== siteName ? `${title}` : siteName);
  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl || '/'} />
      <meta name="robots" content={robots} />

      {/* Open Graph */}
      <meta property="og:site_name" content={siteName} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={image} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
}
