import { getPermalink, getBlogPermalink } from './utils/permalinks';

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
          href: '/services#web-app',
          reload: true,
        },
        {
          text: 'Branding & Graphics',
          href: '/services#branding',
          reload: true,
        },
        {
          text: 'Growth & SEO',
          href: '/services#growth',
          reload: true,
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
      text: 'Blog',
      href: getBlogPermalink(),
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
        { text: 'Our Work', href: getPermalink('/work') },
        { text: 'Blog', href: getBlogPermalink() },
        { text: 'About Us', href: getPermalink('/about') },
        { text: 'Brand Guidelines', href: getPermalink('/brand-guidelines') },
        { text: 'Contact Us', href: getPermalink('/contact') },
      ],
    },
    {
      title: 'Legal',
      links: [
        { text: 'Privacy Policy', href: getPermalink('/privacy') },
        { text: 'Terms & Conditions', href: getPermalink('/terms') },
        { text: 'Cookies Policy', href: getPermalink('/cookies') },
      ],
    },
  ],
  // Only real, working links. Dead "#" social icons were removed — broken links on
  // your own site hurt trust (especially for a web agency). Add a platform back here
  // ONLY once you have a live profile URL for it, and make ariaLabel match the icon.
  socialLinks: [
    { ariaLabel: 'LinkedIn', icon: 'tabler:brand-linkedin', href: 'https://www.linkedin.com/company/uxhm/' },
    { ariaLabel: 'Email', icon: 'tabler:mail', href: 'mailto:hello@uxhm.co.uk' },
  ],
  footNote: `
    <span class="font-bold text-gray-800 dark:text-gray-200">uxhm.co.uk</span> · © ${new Date().getFullYear()} UXHM.&nbsp; All rights reserved.&nbsp; <span class="font-bold text-gray-800 dark:text-gray-200">UXHM</span> is a trading name of <span class="font-bold text-gray-800 dark:text-gray-200">Hira Saeed</span>.
  `,
};