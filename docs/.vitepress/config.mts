import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "remoteStorage.js",
  description: "",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Guide', link: '/' },
      { text: 'Reference', link: '/api' },
    ],

    sidebar: [
      {
        text: 'Guide',
        link: '/',
        items: [
          { text: 'Welcome', link: '/' },
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
