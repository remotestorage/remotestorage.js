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
        text: 'remoteStorage.js', link: '/',
        items: [
        ]
      },
      {
        text: 'Guide',
        items: [
          { text: 'Why use this?', link: '/why' },
          {
            text: 'Getting started', link: '/getting-started',
            collapsed: true,
            items: [
              { text: 'Adding rs.js to an app', link: '/getting-started/how-to-add' },
              { text: 'Initialization & configuration', link: '/getting-started/initialize-and-configure' },
              { text: 'Using the connect widget add-on', link: '/getting-started/connect-widget' },
              { text: 'Handling events', link: '/getting-started/events' },
              { text: 'Offering Dropbox and Google Drive options', link: '/getting-started/dropbox-and-google-drive' },
              { text: 'Reading and writing data', link: '/getting-started/read-and-write-data' },
            ]
          },
        ]
      },
      {
        text: 'JavaScript API', link: '/api',
        items: [
          { text: 'RemoteStorage', link: '/api/remotestorage/classes/RemoteStorage' },
          { text: 'BaseClient', link: '/api/baseclient/classes/BaseClient' },
          { text: 'Access', link: '/api/access/classes/Access' },
          { text: 'Caching', link: '/api/caching/classes/Caching' },
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/remotestorage/remotestorage.js' }
    ]
  }
})
