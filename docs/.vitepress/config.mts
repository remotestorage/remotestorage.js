import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Documentation",
  description: "",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'remoteStorage.js', link: '/' },
    ],

    sidebar: [
      {
        text: 'remoteStorage.js',
        link: '/',
        items: [
        ]
      },
      {
        text: 'Guide',
        items: [
          { text: 'Why use this?', link: '/why' },
          { text: 'Getting started', link: '/getting-started' },
        ]
      },
      {
        text: 'JavaScript API',
        link: '/api',
        items: [
          { text: 'RemoteStorage', link: '/api/remotestorage/classes/RemoteStorage' },
          { text: 'BaseClient', link: '/api/baseclient/classes/BaseClient' },
          { text: 'Access', link: '/api/access/classes/Access' },
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/remotestorage/remotestorage.js' }
    ]
  }
})
