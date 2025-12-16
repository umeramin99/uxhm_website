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
        { text: 'Our Work', href: getPermalink('/work') },
        { text: 'About Us', href: getPermalink('/about') },
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
  socialLinks: [
    { ariaLabel: 'LinkedIn', icon: 'tabler:brand-linkedin', href: 'https://www.linkedin.com/company/uxhm/' },
    { ariaLabel: 'LinkedIn', icon: 'tabler:brand-whatsapp', href: '#' },
    { ariaLabel: 'Facebook', icon: 'tabler:brand-facebook', href: '#' },
    { ariaLabel: 'Instagram', icon: 'tabler:brand-instagram', href: '#' },
    { ariaLabel: 'TikTok', icon: 'tabler:brand-tiktok', href: '#' },
    { ariaLabel: 'TikTok', icon: 'tabler:brand-x', href: '#' },
    { ariaLabel: 'Google', icon: 'tabler:brand-google-maps', href: '#' },
    { ariaLabel: 'Behance', icon: 'tabler:brand-behance', href: '#' },



  ],
  footNote: `
    <span class="font-bold text-gray-800 dark:text-gray-200">uxhm.co.uk</span> · © 2025 UXHM.&nbsp; All rights reserved.&nbsp; <span class="font-bold text-gray-800 dark:text-gray-200">UXHM</span> is a trading name of <span class="font-bold text-gray-800 dark:text-gray-200">Hira Saeed</span> .
  `,
};