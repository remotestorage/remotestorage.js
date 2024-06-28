import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "remoteStorage.js",
  description: "",
  themeConfig: {
    logo: '/logo.svg',

    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'remoteStorage.js', link: '/rs.js/index' }
    ],

    sidebar: {
      '/rs.js/': [
        {
          text: 'remoteStorage.js',
          items: [
            { text: 'Welcome', link: '/rs.js/index' },
          ]
        },
        {
          text: 'JavaScript API',
          items: [
            { text: 'RemoteStorage', link: '/rs.js/api/remotestorage/classes/RemoteStorage' },
            { text: 'BaseClient', link: '/rs.js/api/baseclient/classes/BaseClient' },
            { text: 'Access', link: '/rs.js/api/access/classes/Access' },
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/remotestorage/remotestorage.js' }
    ]
  }
})
