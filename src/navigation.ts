import { getPermalink, getBlogPermalink, getAsset } from './utils/permalinks';

export const headerData = {
  links: [
    {
      text: 'Home',
      href: getPermalink('/'),
    },
    {
      text: 'Services',
      links: [
        {
          text: 'Websites & Apps',
          href: getPermalink('/services#web-app'),
        },
        {
          text: 'Branding & Graphics',
          href: getPermalink('/services#branding'),
        },
        {
          text: 'Growth & SEO',
          href: getPermalink('/services#growth'),
        },
      ],
    },
    {
      text: 'Maintenance Plans',
      href: getPermalink('/maintenance'),
    },
    {
      text: 'Our Work',
      href: getPermalink('/work'),
    },
    {
      text: 'About',
      href: getPermalink('/about'),
    },
    {
      text: 'Contact',
      href: getPermalink('/contact'),
    },
  ],
  actions: [{ text: 'Get a Quote', href: getPermalink('/contact'), variant: 'primary' }],
};

export const footerData = {
  links: [
    {
      title: 'Quick Links',
      links: [
        { text: 'Services', href: getPermalink('/services') },
        { text: 'Maintenance Plans', href: getPermalink('/maintenance') },
        { text: 'Contact Us', href: getPermalink('/contact') },
      ],
    },
    {
      title: 'Legal',
      links: [
        { text: 'Privacy Policy', href: getPermalink('/privacy') },
        { text: 'Terms & Conditions', href: getPermalink('/terms') },
      ],
    },
  ],
  socialLinks: [
    { ariaLabel: 'LinkedIn', icon: 'tabler:brand-linkedin', href: '#' },
    { ariaLabel: 'Instagram', icon: 'tabler:brand-instagram', href: '#' },
  ],
  footNote: `
    <span class="font-bold text-gray-800 dark:text-gray-200">UXHM.co.uk</span> · The A-Z Digital Partner for UK Small Businesses.
  `,
};